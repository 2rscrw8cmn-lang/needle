import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  SpotifyEnrichmentQuotaExceededError,
  type SpotifyAlbumDetail,
  type SpotifyAlbumEnrichmentProvider,
  type SpotifyAlbumFetchResult,
  type SpotifyArtistMetadata,
  type SpotifyImageMetadata,
  type SpotifyTrackMetadata,
} from "./spotify-enrichment.ts";

interface SpotifyEnrichmentCache {
  version: 1;
  market: string;
  albums: Record<string, SpotifyAlbumFetchResult | null>;
}

export interface LiveSpotifyEnrichmentOptions {
  clientId: string;
  clientSecret: string;
  market: string;
  cachePath: string;
  fetchImpl?: typeof fetch;
  now?: () => Date;
}

export interface SpotifyEnrichmentFixture {
  version: 1;
  albums: Record<string, SpotifyAlbumFetchResult | null>;
}

export async function createLiveSpotifyEnrichmentProvider(
  options: LiveSpotifyEnrichmentOptions,
): Promise<SpotifyAlbumEnrichmentProvider> {
  if (!options.clientId || !options.clientSecret) {
    throw new Error("Spotify enrichment requires SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET.");
  }
  if (!/^[A-Z]{2}$/.test(options.market)) {
    throw new Error("Spotify market must be a two-letter ISO country code such as US.");
  }
  const cache = await readCache(options.cachePath, options.market);
  return new LiveSpotifyEnrichmentProvider(options, cache);
}

export async function createFixtureSpotifyEnrichmentProvider(
  fixturePath: string,
): Promise<SpotifyAlbumEnrichmentProvider> {
  const raw = JSON.parse(await readFile(fixturePath, "utf8")) as unknown;
  assertFixture(raw);
  return {
    async getAlbum(spotifyAlbumId) {
      return raw.albums[spotifyAlbumId] ?? null;
    },
  };
}

class LiveSpotifyEnrichmentProvider implements SpotifyAlbumEnrichmentProvider {
  private accessToken: string | null = null;
  private accessTokenExpiresAt = 0;
  private quotaError: SpotifyEnrichmentQuotaExceededError | null = null;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => Date;

  constructor(
    private readonly options: LiveSpotifyEnrichmentOptions,
    private readonly cache: SpotifyEnrichmentCache,
  ) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? (() => new Date());
  }

  async getAlbum(spotifyAlbumId: string): Promise<SpotifyAlbumFetchResult | null> {
    if (Object.prototype.hasOwnProperty.call(this.cache.albums, spotifyAlbumId)) {
      return this.cache.albums[spotifyAlbumId] ?? null;
    }
    this.assertQuotaAvailable();

    const url = new URL(`https://api.spotify.com/v1/albums/${encodeURIComponent(spotifyAlbumId)}`);
    url.searchParams.set("market", this.options.market);
    const raw = await this.requestJson(url, { allowNotFound: true });
    if (raw === null) {
      this.cache.albums[spotifyAlbumId] = null;
      await this.persistCache();
      return null;
    }

    const album = parseAlbumDetail(raw);
    if (album.tracks.length < album.total_tracks) {
      let offset = album.tracks.length;
      while (offset < album.total_tracks) {
        const trackUrl = new URL(`https://api.spotify.com/v1/albums/${encodeURIComponent(spotifyAlbumId)}/tracks`);
        trackUrl.searchParams.set("market", this.options.market);
        trackUrl.searchParams.set("limit", "50");
        trackUrl.searchParams.set("offset", String(offset));
        const pageRaw = await this.requestJson(trackUrl, { allowNotFound: true });
        if (pageRaw === null) break;
        const page = parseTrackPage(pageRaw);
        if (page.items.length === 0) break;
        album.tracks.push(...page.items);
        offset += page.items.length;
        if (!page.hasNext) break;
        if (offset > 1000) throw new Error(`Spotify album track pagination exceeded safety limit for ${spotifyAlbumId}.`);
      }
    }

    album.tracks = dedupeTracks(album.tracks);
    const result: SpotifyAlbumFetchResult = {
      fetched_at: this.now().toISOString(),
      album,
    };
    this.cache.albums[spotifyAlbumId] = result;
    await this.persistCache();
    return result;
  }

  private assertQuotaAvailable(): void {
    if (this.quotaError) throw this.quotaError;
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
          const retryAt = retryAfter > 0 ? new Date(this.now().getTime() + retryAfter * 1000).toISOString() : null;
          this.quotaError = new SpotifyEnrichmentQuotaExceededError(retryAfter, retryAt);
          throw this.quotaError;
        }
        await sleep(Math.min(60, Math.max(1, retryAfter)) * 1000);
        continue;
      }
      if (response.status >= 500 && attempt < 4) {
        await sleep(Math.min(8000, 500 * 2 ** attempt));
        continue;
      }
      if (!response.ok) {
        throw new Error(`Spotify enrichment request failed with HTTP ${response.status} for ${url.pathname}.`);
      }
      return (await response.json()) as unknown;
    }
    throw new Error(`Spotify enrichment request exhausted retries for ${url.pathname}.`);
  }

  private async persistCache(): Promise<void> {
    await mkdir(path.dirname(this.options.cachePath), { recursive: true });
    const temporary = `${this.options.cachePath}.tmp`;
    await writeFile(temporary, `${JSON.stringify(this.cache, null, 2)}\n`, "utf8");
    await rename(temporary, this.options.cachePath);
  }
}

async function readCache(cachePath: string, market: string): Promise<SpotifyEnrichmentCache> {
  try {
    const raw = JSON.parse(await readFile(cachePath, "utf8")) as unknown;
    if (
      isRecord(raw) &&
      raw.version === 1 &&
      raw.market === market &&
      isRecord(raw.albums)
    ) {
      return raw as unknown as SpotifyEnrichmentCache;
    }
  } catch {
    // A missing or stale cache is expected on the first enrichment run.
  }
  return { version: 1, market, albums: {} };
}

function parseAlbumDetail(value: unknown): SpotifyAlbumDetail {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.name !== "string" ||
    !["album", "single", "compilation"].includes(value.album_type as string) ||
    !Number.isInteger(value.total_tracks) ||
    !Array.isArray(value.artists) ||
    !Array.isArray(value.images) ||
    !isRecord(value.tracks)
  ) {
    throw new Error("Spotify album enrichment response has an unexpected shape.");
  }
  return {
    id: value.id,
    name: value.name,
    album_type: value.album_type as SpotifyAlbumDetail["album_type"],
    release_date: typeof value.release_date === "string" ? value.release_date : null,
    release_date_precision: isReleasePrecision(value.release_date_precision) ? value.release_date_precision : null,
    total_tracks: value.total_tracks as number,
    spotify_url: spotifyExternalUrl(value),
    images: value.images.map(parseImage).filter((image): image is SpotifyImageMetadata => image !== null),
    artists: value.artists.map(parseArtist),
    tracks: parseTrackPage(value.tracks).items,
  };
}

function parseTrackPage(value: unknown): { items: SpotifyTrackMetadata[]; hasNext: boolean } {
  if (!isRecord(value) || !Array.isArray(value.items)) {
    throw new Error("Spotify album track page has an unexpected shape.");
  }
  return {
    items: value.items.map(parseTrack),
    hasNext: value.next !== null && value.next !== undefined,
  };
}

function parseTrack(value: unknown): SpotifyTrackMetadata {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.name !== "string" ||
    !Number.isInteger(value.disc_number) ||
    !Number.isInteger(value.track_number) ||
    !Number.isInteger(value.duration_ms) ||
    typeof value.explicit !== "boolean" ||
    !Array.isArray(value.artists)
  ) {
    throw new Error("Spotify track enrichment object has an unexpected shape.");
  }
  return {
    id: value.id,
    name: value.name,
    disc_number: value.disc_number as number,
    track_number: value.track_number as number,
    duration_ms: value.duration_ms as number,
    explicit: value.explicit,
    spotify_url: spotifyExternalUrl(value),
    artists: value.artists.map(parseArtist),
  };
}

function parseArtist(value: unknown): SpotifyArtistMetadata {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.name !== "string") {
    throw new Error("Spotify simplified artist object has an unexpected shape.");
  }
  return {
    id: value.id,
    name: value.name,
    spotify_url: spotifyExternalUrl(value),
  };
}

function parseImage(value: unknown): SpotifyImageMetadata | null {
  if (!isRecord(value) || typeof value.url !== "string") return null;
  return {
    url: value.url,
    width: Number.isInteger(value.width) ? (value.width as number) : null,
    height: Number.isInteger(value.height) ? (value.height as number) : null,
  };
}

function spotifyExternalUrl(value: Record<string, any>): string | null {
  return isRecord(value.external_urls) && typeof value.external_urls.spotify === "string"
    ? value.external_urls.spotify
    : null;
}

function dedupeTracks(tracks: SpotifyTrackMetadata[]): SpotifyTrackMetadata[] {
  const seen = new Set<string>();
  return tracks.filter((track) => {
    if (seen.has(track.id)) return false;
    seen.add(track.id);
    return true;
  });
}

function isReleasePrecision(value: unknown): value is "year" | "month" | "day" {
  return value === "year" || value === "month" || value === "day";
}

function assertFixture(value: unknown): asserts value is SpotifyEnrichmentFixture {
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.albums)) {
    throw new Error("Spotify enrichment fixture must be a version 1 object with an albums map.");
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

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
