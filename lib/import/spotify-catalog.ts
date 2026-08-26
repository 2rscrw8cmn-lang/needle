import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  normalizeLabel,
  type SpotifyAlbumSummary,
  type SpotifyCatalogProvider,
  type SpotifyTrackLookup,
  type SpotifyTrackSummary,
} from "./album-resolver.ts";

interface SpotifyCatalogCache {
  version: 1;
  market: string;
  tracks: Record<string, SpotifyTrackLookup | null>;
  searches: Record<string, SpotifyAlbumSummary[]>;
  albumTracks: Record<string, SpotifyTrackSummary[]>;
}

export interface SpotifyQuotaState {
  reason: "QUOTA_EXCEEDED";
  retryAfterSeconds: number;
  retryAt: string | null;
}

export interface LiveSpotifyCatalogProviderHandle extends SpotifyCatalogProvider {
  getQuotaState(): SpotifyQuotaState | null;
}

export interface LiveSpotifyCatalogOptions {
  clientId: string;
  clientSecret: string;
  market: string;
  cachePath: string;
  fetchImpl?: typeof fetch;
}

export interface FixtureCatalogFile {
  version: 1;
  tracks?: Record<string, SpotifyTrackLookup | null>;
  searches?: Array<{
    artist: string;
    album: string;
    results: SpotifyAlbumSummary[];
  }>;
  albumTracks?: Record<string, SpotifyTrackSummary[]>;
}

export async function createLiveSpotifyCatalogProvider(
  options: LiveSpotifyCatalogOptions,
): Promise<LiveSpotifyCatalogProviderHandle> {
  if (!options.clientId || !options.clientSecret) {
    throw new Error("Spotify catalog resolution requires SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET.");
  }
  if (!/^[A-Z]{2}$/.test(options.market)) {
    throw new Error("Spotify market must be a two-letter ISO country code such as US.");
  }
  return new LiveSpotifyCatalogProvider(options, await readCache(options.cachePath, options.market));
}

export async function createFixtureSpotifyCatalogProvider(
  fixturePath: string,
): Promise<SpotifyCatalogProvider> {
  const raw = JSON.parse(await readFile(fixturePath, "utf8")) as unknown;
  assertFixture(raw);
  const searches = new Map<string, SpotifyAlbumSummary[]>();
  for (const entry of raw.searches ?? []) searches.set(searchKey(entry.artist, entry.album), entry.results);
  return {
    async getTrack(trackId) {
      return raw.tracks?.[trackId] ?? null;
    },
    async searchAlbums(query) {
      return searches.get(searchKey(query.artist, query.album)) ?? [];
    },
    async getAlbumTracks(albumId) {
      return raw.albumTracks?.[albumId] ?? [];
    },
  };
}

class LiveSpotifyCatalogProvider implements LiveSpotifyCatalogProviderHandle {
  private accessToken: string | null = null;
  private accessTokenExpiresAt = 0;
  private quotaState: SpotifyQuotaState | null = null;
  private readonly fetchImpl: typeof fetch;
  private readonly options: LiveSpotifyCatalogOptions;
  private readonly cache: SpotifyCatalogCache;

  constructor(options: LiveSpotifyCatalogOptions, cache: SpotifyCatalogCache) {
    this.options = options;
    this.cache = cache;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  getQuotaState(): SpotifyQuotaState | null {
    return this.quotaState ? { ...this.quotaState } : null;
  }

  async getTrack(trackId: string): Promise<SpotifyTrackLookup | null> {
    if (Object.prototype.hasOwnProperty.call(this.cache.tracks, trackId)) {
      return this.cache.tracks[trackId] ?? null;
    }
    this.assertQuotaAvailable();
    const url = new URL(`https://api.spotify.com/v1/tracks/${encodeURIComponent(trackId)}`);
    url.searchParams.set("market", this.options.market);
    const response = await this.requestJson(url, { allowNotFound: true });
    const parsed = response === null ? null : parseTrackLookup(response);
    this.cache.tracks[trackId] = parsed;
    await this.persistCache();
    return parsed;
  }

  async searchAlbums(query: {
    artist: string;
    album: string;
    limit: number;
  }): Promise<SpotifyAlbumSummary[]> {
    const limit = Math.max(1, Math.min(10, Math.trunc(query.limit)));
    const key = `${searchKey(query.artist, query.album)}\u241f${limit}`;
    if (Object.prototype.hasOwnProperty.call(this.cache.searches, key)) {
      return this.cache.searches[key] ?? [];
    }
    this.assertQuotaAvailable();
    const url = new URL("https://api.spotify.com/v1/search");
    url.searchParams.set("q", `album:\"${query.album}\" artist:\"${query.artist}\"`);
    url.searchParams.set("type", "album");
    url.searchParams.set("market", this.options.market);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("offset", "0");
    const albums = parseSearchAlbums(await this.requestJson(url));
    this.cache.searches[key] = albums;
    await this.persistCache();
    return albums;
  }

  async getAlbumTracks(albumId: string): Promise<SpotifyTrackSummary[]> {
    if (Object.prototype.hasOwnProperty.call(this.cache.albumTracks, albumId)) {
      return this.cache.albumTracks[albumId] ?? [];
    }
    this.assertQuotaAvailable();
    const tracks: SpotifyTrackSummary[] = [];
    let offset = 0;
    for (;;) {
      const url = new URL(`https://api.spotify.com/v1/albums/${encodeURIComponent(albumId)}/tracks`);
      url.searchParams.set("market", this.options.market);
      url.searchParams.set("limit", "50");
      url.searchParams.set("offset", String(offset));
      const response = await this.requestJson(url, { allowNotFound: true });
      if (response === null) break;
      const page = parseTrackPage(response);
      tracks.push(...page.items);
      if (!page.hasNext || page.items.length === 0) break;
      offset += page.items.length;
      if (offset > 1000) {
        throw new Error(`Spotify album track pagination exceeded safety limit for ${albumId}.`);
      }
    }
    this.cache.albumTracks[albumId] = tracks;
    await this.persistCache();
    return tracks;
  }

  private assertQuotaAvailable(): void {
    if (this.quotaState) throw new Error(formatQuotaMessage(this.quotaState));
  }

  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.accessToken && now < this.accessTokenExpiresAt - 30_000) return this.accessToken;
    const credentials = Buffer.from(`${this.options.clientId}:${this.options.clientSecret}`).toString("base64");
    const response = await this.fetchImpl("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    if (!response.ok) throw new Error(`Spotify token request failed with HTTP ${response.status}.`);
    const raw = (await response.json()) as unknown;
    if (!isRecord(raw) || typeof raw.access_token !== "string" || typeof raw.expires_in !== "number") {
      throw new Error("Spotify token response has an unexpected shape.");
    }
    this.accessToken = raw.access_token;
    this.accessTokenExpiresAt = now + raw.expires_in * 1000;
    return raw.access_token;
  }

  private async requestJson(
    url: URL,
    options: { allowNotFound?: boolean } = {},
  ): Promise<unknown | null> {
    this.assertQuotaAvailable();
    let refreshedAfterUnauthorized = false;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await this.fetchImpl(url, {
        headers: { Authorization: `Bearer ${await this.getAccessToken()}` },
      });
      if (response.status === 404 && options.allowNotFound) return null;
      if (response.status === 401 && !refreshedAfterUnauthorized) {
        this.accessToken = null;
        this.accessTokenExpiresAt = 0;
        refreshedAfterUnauthorized = true;
        continue;
      }
      if (response.status === 429) {
        const retryAfter = parseRetryAfter(response.headers.get("retry-after"));
        const body = await readJsonResponse(response);
        if (spotifyErrorReason(body) === "QUOTA_EXCEEDED") {
          this.quotaState = {
            reason: "QUOTA_EXCEEDED",
            retryAfterSeconds: retryAfter,
            retryAt: retryAfter > 0 ? new Date(Date.now() + retryAfter * 1000).toISOString() : null,
          };
          throw new Error(formatQuotaMessage(this.quotaState));
        }
        await sleep(Math.min(60, Math.max(1, retryAfter)) * 1000);
        continue;
      }
      if (response.status >= 500 && attempt < 4) {
        await sleep(Math.min(8000, 500 * 2 ** attempt));
        continue;
      }
      if (!response.ok) {
        throw new Error(`Spotify catalog request failed with HTTP ${response.status} for ${url.pathname}.`);
      }
      return (await response.json()) as unknown;
    }
    throw new Error(`Spotify catalog request exhausted retries for ${url.pathname}.`);
  }

  private async persistCache(): Promise<void> {
    await mkdir(path.dirname(this.options.cachePath), { recursive: true });
    const temporary = `${this.options.cachePath}.tmp`;
    await writeFile(temporary, `${JSON.stringify(this.cache, null, 2)}\n`, "utf8");
    await rename(temporary, this.options.cachePath);
  }
}

async function readCache(cachePath: string, market: string): Promise<SpotifyCatalogCache> {
  try {
    const raw = JSON.parse(await readFile(cachePath, "utf8")) as unknown;
    if (
      isRecord(raw) &&
      raw.version === 1 &&
      raw.market === market &&
      isRecord(raw.tracks) &&
      isRecord(raw.searches) &&
      isRecord(raw.albumTracks)
    ) {
      return raw as unknown as SpotifyCatalogCache;
    }
  } catch {
    // Missing/stale cache is expected on first run or after a market change.
  }
  return { version: 1, market, tracks: {}, searches: {}, albumTracks: {} };
}

function parseTrackLookup(value: unknown): SpotifyTrackLookup {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.name !== "string") {
    throw new Error("Spotify track response has an unexpected shape.");
  }
  return { id: value.id, name: value.name, album: parseAlbumSummary(value.album) };
}

function parseSearchAlbums(value: unknown): SpotifyAlbumSummary[] {
  if (!isRecord(value) || !isRecord(value.albums) || !Array.isArray(value.albums.items)) {
    throw new Error("Spotify album search response has an unexpected shape.");
  }
  return value.albums.items.map(parseAlbumSummary);
}

function parseAlbumSummary(value: unknown): SpotifyAlbumSummary {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.name !== "string" ||
    !["album", "single", "compilation"].includes(value.album_type as string) ||
    !Number.isInteger(value.total_tracks) ||
    !Array.isArray(value.artists)
  ) {
    throw new Error("Spotify album object has an unexpected shape.");
  }
  const artists = value.artists.map((artist: unknown) => {
    if (!isRecord(artist) || typeof artist.id !== "string" || typeof artist.name !== "string") {
      throw new Error("Spotify album artist object has an unexpected shape.");
    }
    return { id: artist.id, name: artist.name };
  });
  return {
    id: value.id,
    name: value.name,
    album_type: value.album_type as SpotifyAlbumSummary["album_type"],
    total_tracks: value.total_tracks as number,
    release_date: typeof value.release_date === "string" ? value.release_date : null,
    artists,
  };
}

function parseTrackPage(value: unknown): { items: SpotifyTrackSummary[]; hasNext: boolean } {
  if (!isRecord(value) || !Array.isArray(value.items)) {
    throw new Error("Spotify album tracks response has an unexpected shape.");
  }
  const items = value.items.map((track: unknown) => {
    if (!isRecord(track) || typeof track.id !== "string" || typeof track.name !== "string") {
      throw new Error("Spotify simplified track object has an unexpected shape.");
    }
    return { id: track.id, name: track.name };
  });
  return { items, hasNext: value.next !== null && value.next !== undefined };
}

function searchKey(artist: string, album: string): string {
  return `${normalizeLabel(artist)}\u241f${normalizeLabel(album)}`;
}

function assertFixture(value: unknown): asserts value is FixtureCatalogFile {
  if (!isRecord(value) || value.version !== 1) throw new Error("Catalog fixture must be a version 1 object.");
  if (value.tracks !== undefined && !isRecord(value.tracks)) {
    throw new Error("Catalog fixture tracks must be an object.");
  }
  if (value.searches !== undefined && !Array.isArray(value.searches)) {
    throw new Error("Catalog fixture searches must be an array.");
  }
  if (value.albumTracks !== undefined && !isRecord(value.albumTracks)) {
    throw new Error("Catalog fixture albumTracks must be an object.");
  }
}

function parseRetryAfter(value: string | null): number {
  const parsed = Number(value ?? "1");
  return Math.max(1, Number.isFinite(parsed) ? Math.ceil(parsed) : 1);
}

async function readJsonResponse(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

function spotifyErrorReason(value: unknown): string | null {
  return isRecord(value) && isRecord(value.error) && typeof value.error.reason === "string"
    ? value.error.reason
    : null;
}

function formatQuotaMessage(state: SpotifyQuotaState): string {
  const retry = state.retryAt
    ? ` Retry after ${state.retryAfterSeconds}s (approximately ${state.retryAt}).`
    : "";
  return `Spotify Development Mode quota exhausted (QUOTA_EXCEEDED).${retry}`;
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
