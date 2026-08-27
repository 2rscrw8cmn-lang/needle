import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { CanonicalAlbum, SpotifyAlbumEdition } from "./album-resolver.ts";

export interface AlbumResolutionArtifacts {
  canonicalAlbums: CanonicalAlbum[];
  editions: SpotifyAlbumEdition[];
}

export interface SpotifyImageMetadata {
  url: string;
  width: number | null;
  height: number | null;
}

export interface SpotifyArtistMetadata {
  id: string;
  name: string;
  spotify_url: string | null;
}

export interface SpotifyTrackMetadata {
  id: string;
  name: string;
  disc_number: number;
  track_number: number;
  duration_ms: number;
  explicit: boolean;
  spotify_url: string | null;
  artists: SpotifyArtistMetadata[];
}

export interface SpotifyAlbumDetail {
  id: string;
  name: string;
  album_type: "album" | "single" | "compilation";
  release_date: string | null;
  release_date_precision: "year" | "month" | "day" | null;
  total_tracks: number;
  spotify_url: string | null;
  images: SpotifyImageMetadata[];
  artists: SpotifyArtistMetadata[];
  tracks: SpotifyTrackMetadata[];
}

export interface SpotifyAlbumFetchResult {
  fetched_at: string;
  album: SpotifyAlbumDetail;
}

export interface SpotifyAlbumEnrichmentProvider {
  getAlbum(spotifyAlbumId: string): Promise<SpotifyAlbumFetchResult | null>;
}

export class SpotifyEnrichmentQuotaExceededError extends Error {
  readonly code = "SPOTIFY_QUOTA_EXCEEDED";
  readonly retryAfterSeconds: number;
  readonly retryAt: string | null;

  constructor(retryAfterSeconds: number, retryAt: string | null) {
    const retry = retryAt
      ? ` Retry after ${retryAfterSeconds}s (approximately ${retryAt}).`
      : "";
    super(`Spotify Development Mode quota exhausted (QUOTA_EXCEEDED).${retry}`);
    this.name = "SpotifyEnrichmentQuotaExceededError";
    this.retryAfterSeconds = retryAfterSeconds;
    this.retryAt = retryAt;
  }
}

export interface SpotifyAlbumEnrichment {
  canonical_album_id: string;
  edition_id: string;
  spotify_album_id: string;
  name: string;
  album_type: SpotifyAlbumDetail["album_type"];
  release_date: string | null;
  release_date_precision: SpotifyAlbumDetail["release_date_precision"];
  total_tracks: number;
  spotify_url: string | null;
  images: SpotifyImageMetadata[];
  primary_artwork_url: string | null;
  artist_ids: string[];
  track_ids: string[];
  track_listing_complete: boolean;
  provider: "spotify";
  market: string;
  enriched_at: string;
}

export interface SpotifyArtistEnrichment {
  spotify_artist_id: string;
  name: string;
  spotify_url: string | null;
  genres: string[];
  genre_status: "unavailable_from_album_response";
  provider: "spotify";
  enriched_at: string;
}

export interface SpotifyTrackEnrichment {
  spotify_track_id: string;
  spotify_album_id: string;
  name: string;
  disc_number: number;
  track_number: number;
  duration_ms: number;
  explicit: boolean;
  spotify_url: string | null;
  artist_ids: string[];
  provider: "spotify";
  enriched_at: string;
}

export type SpotifyEnrichmentFailureReason =
  | "missing_preferred_edition"
  | "spotify_album_not_found"
  | "spotify_album_id_mismatch"
  | "provider_error";

export interface SpotifyEnrichmentFailure {
  canonical_album_id: string;
  edition_id: string | null;
  spotify_album_id: string | null;
  reason: SpotifyEnrichmentFailureReason;
  message: string;
}

export interface SpotifyEnrichmentReport {
  reportVersion: 1;
  enrichmentVersion: 1;
  provider: "spotify" | "fixture";
  market: string;
  ok: boolean;
  totals: {
    acceptedCanonicalAlbums: number;
    enrichmentTargets: number;
    enrichedAlbums: number;
    failedAlbums: number;
    enrichedArtists: number;
    enrichedTracks: number;
    albumsWithArtwork: number;
    albumsWithSpotifyUrl: number;
    albumsWithCompleteTrackListing: number;
    albumsWithoutGenreMetadata: number;
  };
  reconciliation: {
    targetBalance: boolean;
    uniqueAlbumIds: boolean;
    uniqueArtistIds: boolean;
    uniqueTrackIds: boolean;
  };
}

export interface SpotifyEnrichmentResult {
  albums: SpotifyAlbumEnrichment[];
  artists: SpotifyArtistEnrichment[];
  tracks: SpotifyTrackEnrichment[];
  failures: SpotifyEnrichmentFailure[];
  report: SpotifyEnrichmentReport;
}

export async function readAlbumResolutionArtifacts(inputDir: string): Promise<AlbumResolutionArtifacts> {
  const [canonicalAlbums, editions] = await Promise.all([
    readJson(path.join(inputDir, "canonical-albums.json")),
    readJson(path.join(inputDir, "spotify-album-editions.json")),
  ]);
  assertCanonicalAlbums(canonicalAlbums);
  assertEditions(editions);
  return { canonicalAlbums, editions };
}

export async function enrichResolvedAlbums(options: {
  artifacts: AlbumResolutionArtifacts;
  provider: SpotifyAlbumEnrichmentProvider;
  providerName?: "spotify" | "fixture";
  market: string;
}): Promise<SpotifyEnrichmentResult> {
  const editionById = new Map(options.artifacts.editions.map((edition) => [edition.edition_id, edition] as const));
  const accepted = options.artifacts.canonicalAlbums
    .filter((album) => album.review_status === "accepted")
    .sort(compareCanonicalAlbums);

  const albums: SpotifyAlbumEnrichment[] = [];
  const artists = new Map<string, SpotifyArtistEnrichment>();
  const tracks = new Map<string, SpotifyTrackEnrichment>();
  const failures: SpotifyEnrichmentFailure[] = [];

  for (const canonical of accepted) {
    if (!canonical.preferred_edition_id) {
      failures.push({
        canonical_album_id: canonical.canonical_album_id,
        edition_id: null,
        spotify_album_id: null,
        reason: "missing_preferred_edition",
        message: "Accepted canonical album has no preferred Spotify edition.",
      });
      continue;
    }

    const edition = editionById.get(canonical.preferred_edition_id);
    if (!edition) {
      failures.push({
        canonical_album_id: canonical.canonical_album_id,
        edition_id: canonical.preferred_edition_id,
        spotify_album_id: null,
        reason: "missing_preferred_edition",
        message: "Preferred edition ID is not present in spotify-album-editions.json.",
      });
      continue;
    }

    let fetched: SpotifyAlbumFetchResult | null;
    try {
      fetched = await options.provider.getAlbum(edition.spotify_album_id);
    } catch (error: unknown) {
      if (error instanceof SpotifyEnrichmentQuotaExceededError) throw error;
      failures.push({
        canonical_album_id: canonical.canonical_album_id,
        edition_id: edition.edition_id,
        spotify_album_id: edition.spotify_album_id,
        reason: "provider_error",
        message: error instanceof Error ? error.message : "Unknown Spotify provider error.",
      });
      continue;
    }

    if (!fetched) {
      failures.push({
        canonical_album_id: canonical.canonical_album_id,
        edition_id: edition.edition_id,
        spotify_album_id: edition.spotify_album_id,
        reason: "spotify_album_not_found",
        message: "Spotify returned no album for the resolved edition ID.",
      });
      continue;
    }
    if (fetched.album.id !== edition.spotify_album_id) {
      failures.push({
        canonical_album_id: canonical.canonical_album_id,
        edition_id: edition.edition_id,
        spotify_album_id: edition.spotify_album_id,
        reason: "spotify_album_id_mismatch",
        message: `Spotify returned album ${fetched.album.id} for requested album ${edition.spotify_album_id}.`,
      });
      continue;
    }

    const detail = fetched.album;
    const artistIds = sortedUnique(detail.artists.map((artist) => artist.id));
    const trackIds = detail.tracks.map((track) => track.id);
    albums.push({
      canonical_album_id: canonical.canonical_album_id,
      edition_id: edition.edition_id,
      spotify_album_id: detail.id,
      name: detail.name,
      album_type: detail.album_type,
      release_date: detail.release_date,
      release_date_precision: detail.release_date_precision,
      total_tracks: detail.total_tracks,
      spotify_url: detail.spotify_url,
      images: detail.images,
      primary_artwork_url: detail.images[0]?.url ?? null,
      artist_ids: artistIds,
      track_ids: trackIds,
      track_listing_complete: detail.tracks.length === detail.total_tracks,
      provider: "spotify",
      market: options.market,
      enriched_at: fetched.fetched_at,
    });

    for (const artist of detail.artists) {
      const current = artists.get(artist.id);
      const incoming: SpotifyArtistEnrichment = {
        spotify_artist_id: artist.id,
        name: artist.name,
        spotify_url: artist.spotify_url,
        genres: [],
        genre_status: "unavailable_from_album_response",
        provider: "spotify",
        enriched_at: fetched.fetched_at,
      };
      artists.set(artist.id, current ? mergeArtist(current, incoming) : incoming);
    }

    for (const track of detail.tracks) {
      for (const artist of track.artists) {
        const current = artists.get(artist.id);
        const incoming: SpotifyArtistEnrichment = {
          spotify_artist_id: artist.id,
          name: artist.name,
          spotify_url: artist.spotify_url,
          genres: [],
          genre_status: "unavailable_from_album_response",
          provider: "spotify",
          enriched_at: fetched.fetched_at,
        };
        artists.set(artist.id, current ? mergeArtist(current, incoming) : incoming);
      }
      const incoming: SpotifyTrackEnrichment = {
        spotify_track_id: track.id,
        spotify_album_id: detail.id,
        name: track.name,
        disc_number: track.disc_number,
        track_number: track.track_number,
        duration_ms: track.duration_ms,
        explicit: track.explicit,
        spotify_url: track.spotify_url,
        artist_ids: sortedUnique(track.artists.map((artist) => artist.id)),
        provider: "spotify",
        enriched_at: fetched.fetched_at,
      };
      const current = tracks.get(track.id);
      tracks.set(track.id, current ? mergeTrack(current, incoming) : incoming);
    }
  }

  const sortedAlbums = albums.sort((a, b) => a.canonical_album_id.localeCompare(b.canonical_album_id));
  const sortedArtists = [...artists.values()].sort((a, b) => a.name.localeCompare(b.name) || a.spotify_artist_id.localeCompare(b.spotify_artist_id));
  const sortedTracks = [...tracks.values()].sort((a, b) => a.spotify_album_id.localeCompare(b.spotify_album_id) || a.disc_number - b.disc_number || a.track_number - b.track_number || a.spotify_track_id.localeCompare(b.spotify_track_id));
  const sortedFailures = failures.sort((a, b) => a.canonical_album_id.localeCompare(b.canonical_album_id));

  const report: SpotifyEnrichmentReport = {
    reportVersion: 1,
    enrichmentVersion: 1,
    provider: options.providerName ?? "spotify",
    market: options.market,
    ok: true,
    totals: {
      acceptedCanonicalAlbums: accepted.length,
      enrichmentTargets: accepted.length,
      enrichedAlbums: sortedAlbums.length,
      failedAlbums: sortedFailures.length,
      enrichedArtists: sortedArtists.length,
      enrichedTracks: sortedTracks.length,
      albumsWithArtwork: sortedAlbums.filter((album) => album.primary_artwork_url).length,
      albumsWithSpotifyUrl: sortedAlbums.filter((album) => album.spotify_url).length,
      albumsWithCompleteTrackListing: sortedAlbums.filter((album) => album.track_listing_complete).length,
      albumsWithoutGenreMetadata: sortedAlbums.length,
    },
    reconciliation: {
      targetBalance: sortedAlbums.length + sortedFailures.length === accepted.length,
      uniqueAlbumIds: unique(sortedAlbums.map((album) => album.spotify_album_id)),
      uniqueArtistIds: unique(sortedArtists.map((artist) => artist.spotify_artist_id)),
      uniqueTrackIds: unique(sortedTracks.map((track) => track.spotify_track_id)),
    },
  };
  report.ok = Object.values(report.reconciliation).every(Boolean);
  return { albums: sortedAlbums, artists: sortedArtists, tracks: sortedTracks, failures: sortedFailures, report };
}

export async function writeSpotifyEnrichmentOutputs(options: {
  outputDir: string;
  result: SpotifyEnrichmentResult;
}): Promise<void> {
  await mkdir(options.outputDir, { recursive: true });
  const files: Array<[string, unknown]> = [
    ["spotify-album-enrichment.json", options.result.albums],
    ["spotify-artist-enrichment.json", options.result.artists],
    ["spotify-track-enrichment.json", options.result.tracks],
    ["spotify-enrichment-review.json", options.result.failures],
    ["spotify-enrichment-report.json", options.result.report],
  ];
  await Promise.all(
    files.map(([name, value]) => writeFile(path.join(options.outputDir, name), `${JSON.stringify(value, null, 2)}\n`, "utf8")),
  );
  await writeFile(
    path.join(options.outputDir, "spotify-enrichment-report.md"),
    `${renderSpotifyEnrichmentReportMarkdown(options.result.report)}\n`,
    "utf8",
  );
}

export function renderSpotifyEnrichmentReportMarkdown(report: SpotifyEnrichmentReport): string {
  return [
    "# Needle Spotify Enrichment",
    "",
    `- Provider: **${report.provider}**`,
    `- Market: **${report.market}**`,
    `- Result: **${report.ok ? "PASS" : "FAIL"}**`,
    "",
    "## Counts",
    "",
    "| Metric | Count |",
    "| --- | ---: |",
    `| Accepted canonical albums | ${report.totals.acceptedCanonicalAlbums} |`,
    `| Enriched albums | ${report.totals.enrichedAlbums} |`,
    `| Failed/missing albums | ${report.totals.failedAlbums} |`,
    `| Enriched artists | ${report.totals.enrichedArtists} |`,
    `| Enriched tracks | ${report.totals.enrichedTracks} |`,
    `| Albums with artwork | ${report.totals.albumsWithArtwork} |`,
    `| Albums with Spotify URL | ${report.totals.albumsWithSpotifyUrl} |`,
    `| Complete track listings | ${report.totals.albumsWithCompleteTrackListing} |`,
    "",
    "## Provider constraints",
    "",
    "Spotify album responses provide album artwork, outbound Spotify URLs, release metadata, simplified artist identity, and track metadata. Needle intentionally does not make additional artist requests solely for Spotify artist genres because that field is deprecated; genre absence remains explicit for 1.06 rather than being guessed.",
    "",
    "Spotify visual URLs are retained as provider references only. Needle does not mirror album artwork into R2 and must preserve Spotify attribution/linkback when displaying Spotify metadata or artwork.",
  ].join("\n");
}

function mergeArtist(existing: SpotifyArtistEnrichment, incoming: SpotifyArtistEnrichment): SpotifyArtistEnrichment {
  return {
    ...existing,
    name: existing.name || incoming.name,
    spotify_url: existing.spotify_url ?? incoming.spotify_url,
    enriched_at: existing.enriched_at < incoming.enriched_at ? existing.enriched_at : incoming.enriched_at,
  };
}

function mergeTrack(existing: SpotifyTrackEnrichment, incoming: SpotifyTrackEnrichment): SpotifyTrackEnrichment {
  return {
    ...existing,
    spotify_url: existing.spotify_url ?? incoming.spotify_url,
    artist_ids: sortedUnique([...existing.artist_ids, ...incoming.artist_ids]),
    enriched_at: existing.enriched_at < incoming.enriched_at ? existing.enriched_at : incoming.enriched_at,
  };
}

function compareCanonicalAlbums(a: CanonicalAlbum, b: CanonicalAlbum): number {
  return a.primary_artist_name.localeCompare(b.primary_artist_name) || a.title.localeCompare(b.title) || a.canonical_album_id.localeCompare(b.canonical_album_id);
}

function sortedUnique(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function unique(values: string[]): boolean {
  return new Set(values).size === values.length;
}

async function readJson(filePath: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as unknown;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "unknown read/parse failure";
    throw new Error(`Unable to read Spotify enrichment input ${path.basename(filePath)}: ${message}`);
  }
}

function assertCanonicalAlbums(value: unknown): asserts value is CanonicalAlbum[] {
  if (!Array.isArray(value)) throw new Error("1.04 artifact contract error: canonical-albums.json must be an array.");
  for (const album of value) {
    if (!isRecord(album) || typeof album.canonical_album_id !== "string" || typeof album.review_status !== "string") {
      throw new Error("1.04 artifact contract error: invalid canonical album.");
    }
  }
}

function assertEditions(value: unknown): asserts value is SpotifyAlbumEdition[] {
  if (!Array.isArray(value)) throw new Error("1.04 artifact contract error: spotify-album-editions.json must be an array.");
  for (const edition of value) {
    if (!isRecord(edition) || typeof edition.edition_id !== "string" || typeof edition.spotify_album_id !== "string") {
      throw new Error("1.04 artifact contract error: invalid Spotify album edition.");
    }
  }
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
