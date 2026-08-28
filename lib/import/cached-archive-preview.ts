import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  MUSIC_TYPES,
  type MusicType,
  type MusicTypeTaxonomyReport,
} from "../taxonomy/music-types.ts";
import type { AlbumSession, SessionizationReport } from "./album-sessionizer.ts";
import {
  normalizeLabel,
  type AlbumResolutionResult,
  type SpotifyAlbumSummary,
  type SpotifyCatalogProvider,
  type SpotifyTrackLookup,
  type SpotifyTrackSummary,
  type StageThreeArtifacts,
} from "./album-resolver.ts";
import {
  reconcileImportedArchive,
  renderArchiveImportSql,
  type ArchiveReconciliationArtifacts,
  type ArchiveReconciliationResult,
} from "./archive-reconciler.ts";
import type {
  SpotifyAlbumEnrichmentProvider,
  SpotifyAlbumFetchResult,
  SpotifyEnrichmentResult,
  SpotifyEnrichmentReport,
} from "./spotify-enrichment.ts";

interface SpotifyCatalogCache {
  version: 1;
  market: string;
  tracks: Record<string, SpotifyTrackLookup | null>;
  searches: Record<string, SpotifyAlbumSummary[]>;
  albumTracks: Record<string, SpotifyTrackSummary[]>;
}

interface SpotifyEnrichmentCache {
  version: 1;
  market: string;
  albums: Record<string, SpotifyAlbumFetchResult | null>;
}

export interface CachedCatalogStats {
  tracks: number;
  searches: number;
  albumTrackLists: number;
}

export interface CachedCatalogProviderHandle {
  provider: SpotifyCatalogProvider;
  stats: CachedCatalogStats;
}

export interface CachedEnrichmentProviderHandle {
  provider: SpotifyAlbumEnrichmentProvider;
  albumEntries: number;
}

export interface CachedArchivePreviewManifest {
  version: 1;
  preview: true;
  local_only: true;
  generated_at: string;
  market: string;
  cache: CachedCatalogStats & {
    enrichmentAlbums: number;
  };
  totals: {
    source_albums: number;
    resolved_source_albums: number;
    review_source_albums: number;
    canonical_albums: number;
    library_members: number;
  };
  coverage: {
    artwork: number;
    music_type: 0;
  };
  warnings: string[];
}

export async function createCachedSpotifyCatalogProvider(options: {
  cachePath: string;
  market: string;
}): Promise<CachedCatalogProviderHandle> {
  const market = options.market.toUpperCase();
  if (!/^[A-Z]{2}$/.test(market)) {
    throw new Error("Spotify market must be a two-letter ISO country code such as US.");
  }

  const raw = JSON.parse(await readFile(options.cachePath, "utf8")) as unknown;
  const cache = parseCatalogCache(raw, market);
  const stats: CachedCatalogStats = {
    tracks: Object.keys(cache.tracks).length,
    searches: Object.keys(cache.searches).length,
    albumTrackLists: Object.keys(cache.albumTracks).length,
  };

  const provider: SpotifyCatalogProvider = {
    async getTrack(trackId) {
      return Object.prototype.hasOwnProperty.call(cache.tracks, trackId)
        ? cache.tracks[trackId] ?? null
        : null;
    },
    async searchAlbums(query) {
      const limit = Math.max(1, Math.min(10, Math.trunc(query.limit)));
      const key = `${searchKey(query.artist, query.album)}\u241f${limit}`;
      return Object.prototype.hasOwnProperty.call(cache.searches, key)
        ? cache.searches[key] ?? []
        : [];
    },
    async getAlbumTracks(albumId) {
      return Object.prototype.hasOwnProperty.call(cache.albumTracks, albumId)
        ? cache.albumTracks[albumId] ?? []
        : [];
    },
  };

  return { provider, stats };
}

export async function createCachedSpotifyEnrichmentProvider(options: {
  cachePath: string;
  market: string;
}): Promise<CachedEnrichmentProviderHandle> {
  const market = options.market.toUpperCase();
  if (!/^[A-Z]{2}$/.test(market)) {
    throw new Error("Spotify market must be a two-letter ISO country code such as US.");
  }

  const cache = await readEnrichmentCache(options.cachePath, market);
  const provider: SpotifyAlbumEnrichmentProvider = {
    async getAlbum(spotifyAlbumId) {
      return Object.prototype.hasOwnProperty.call(cache.albums, spotifyAlbumId)
        ? cache.albums[spotifyAlbumId] ?? null
        : null;
    },
  };

  return { provider, albumEntries: Object.keys(cache.albums).length };
}

export function buildCachedArchivePreview(options: {
  stageThree: StageThreeArtifacts;
  resolution: AlbumResolutionResult;
  market: string;
  cacheStats: CachedCatalogStats;
  enrichment?: SpotifyEnrichmentResult;
  enrichmentCacheEntries?: number;
  generatedAt?: string;
}): { result: ArchiveReconciliationResult; manifest: CachedArchivePreviewManifest } {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const acceptedCount = options.resolution.canonicalAlbums.filter(
    (album) => album.review_status === "accepted",
  ).length;
  const enrichment = options.enrichment ?? emptyEnrichment(acceptedCount, options.market);

  const emptyMusicTypeCounts = Object.fromEntries(
    MUSIC_TYPES.map((musicType) => [musicType, 0]),
  ) as Record<MusicType, number>;
  const taxonomyReport: MusicTypeTaxonomyReport = {
    reportVersion: 1,
    taxonomyVersion: 1,
    mappingVersion: 1,
    ok: true,
    totals: {
      enrichedAlbums: enrichment.albums.length,
      classifiedAlbums: 0,
      automaticClassifications: 0,
      manualOverrides: 0,
      unclassifiedNoGenres: enrichment.albums.length,
      unclassifiedUnmapped: 0,
      unclassifiedAmbiguous: 0,
      detailedGenres: 0,
      mappedGenres: 0,
      ambiguousGenres: 0,
      unmappedGenres: 0,
      orphanManualOverrides: 0,
    },
    byMusicType: emptyMusicTypeCounts,
    reconciliation: {
      albumBalance: true,
      uniqueCanonicalAlbumIds: true,
      uniqueOverrideTargets: true,
      overrideTargetsKnown: true,
    },
  };

  const artifacts: ArchiveReconciliationArtifacts = {
    sessionizationReport: options.stageThree.report as unknown as SessionizationReport,
    sessions: options.stageThree.sessions as unknown as AlbumSession[],
    canonicalAlbums: options.resolution.canonicalAlbums,
    editions: options.resolution.editions,
    resolutionLinks: options.resolution.links,
    resolutionReport: options.resolution.report,
    enrichedAlbums: enrichment.albums,
    enrichedArtists: enrichment.artists,
    enrichedTracks: enrichment.tracks,
    enrichmentReport: enrichment.report,
    musicTypeClassifications: [],
    genreCatalog: [],
    taxonomyReport,
  };

  const result = reconcileImportedArchive(artifacts);
  const editionById = new Map(
    result.snapshot.editions.map((edition) => [edition.edition_id, edition] as const),
  );

  result.snapshot.albums = result.snapshot.albums.map((album) => {
    if (album.spotify_url) return album;
    const preferred = album.preferred_edition_id
      ? editionById.get(album.preferred_edition_id) ?? null
      : null;
    return {
      ...album,
      spotify_url: preferred
        ? `https://open.spotify.com/album/${encodeURIComponent(preferred.spotify_album_id)}`
        : null,
    };
  });
  result.snapshot.artists = result.snapshot.artists.map((artist) => ({
    ...artist,
    spotify_url: artist.spotify_url ?? `https://open.spotify.com/artist/${encodeURIComponent(artist.spotify_artist_id)}`,
  }));
  result.importSql = renderArchiveImportSql(result.snapshot);

  const albumsWithArtwork = result.snapshot.albums.filter((album) => album.artwork_url).length;
  const manifest: CachedArchivePreviewManifest = {
    version: 1,
    preview: true,
    local_only: true,
    generated_at: generatedAt,
    market: options.market,
    cache: {
      ...options.cacheStats,
      enrichmentAlbums: options.enrichmentCacheEntries ?? enrichment.albums.length,
    },
    totals: {
      source_albums: options.resolution.report.totals.provisionalSourceAlbums,
      resolved_source_albums: options.resolution.report.totals.resolvedSourceAlbums,
      review_source_albums: options.resolution.report.totals.reviewSourceAlbums,
      canonical_albums: options.resolution.canonicalAlbums.length,
      library_members: result.report.totals.libraryMembers,
    },
    coverage: {
      artwork: result.snapshot.albums.length === 0 ? 0 : albumsWithArtwork / result.snapshot.albums.length,
      music_type: 0,
    },
    warnings: [
      "LOCAL PREVIEW ONLY — do not load this archive into remote or production D1.",
      "Album identities are based only on Spotify catalog responses already present in spotify-resolution-cache.json.",
      "Spotify enrichment cache entries are consumed locally when present; uncached albums keep the accepted quiet artwork slot.",
      "Missing cache entries are treated conservatively rather than triggering network calls.",
      "Genre and Music Type remain incomplete until the final 1.05–1.06 pipeline completes.",
    ],
  };

  return { result, manifest };
}

export async function writeCachedArchivePreviewManifest(
  outputDir: string,
  manifest: CachedArchivePreviewManifest,
): Promise<void> {
  await writeFile(
    path.join(outputDir, "preview-manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );
}

function emptyEnrichment(acceptedCount: number, market: string): SpotifyEnrichmentResult {
  const report: SpotifyEnrichmentReport = {
    reportVersion: 1,
    enrichmentVersion: 1,
    provider: "spotify",
    market,
    ok: true,
    totals: {
      acceptedCanonicalAlbums: acceptedCount,
      enrichmentTargets: acceptedCount,
      enrichedAlbums: 0,
      failedAlbums: acceptedCount,
      enrichedArtists: 0,
      enrichedTracks: 0,
      albumsWithArtwork: 0,
      albumsWithSpotifyUrl: 0,
      albumsWithCompleteTrackListing: 0,
      albumsWithoutGenreMetadata: 0,
    },
    reconciliation: {
      targetBalance: true,
      uniqueAlbumIds: true,
      uniqueArtistIds: true,
      uniqueTrackIds: true,
    },
  };
  return { albums: [], artists: [], tracks: [], failures: [], report };
}

function parseCatalogCache(value: unknown, market: string): SpotifyCatalogCache {
  if (!isRecord(value) || value.version !== 1) {
    throw new Error("Spotify resolution cache must be a version 1 object.");
  }
  if (value.market !== market) {
    throw new Error(`Spotify resolution cache market is ${String(value.market)}, expected ${market}.`);
  }
  if (!isRecord(value.tracks) || !isRecord(value.searches) || !isRecord(value.albumTracks)) {
    throw new Error("Spotify resolution cache has an unexpected shape.");
  }
  return value as unknown as SpotifyCatalogCache;
}

async function readEnrichmentCache(cachePath: string, market: string): Promise<SpotifyEnrichmentCache> {
  let rawText: string;
  try {
    rawText = await readFile(cachePath, "utf8");
  } catch (error: unknown) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return { version: 1, market, albums: {} };
    }
    throw error;
  }
  const value = JSON.parse(rawText) as unknown;
  if (!isRecord(value) || value.version !== 1) {
    throw new Error("Spotify enrichment cache must be a version 1 object.");
  }
  if (value.market !== market) {
    throw new Error(`Spotify enrichment cache market is ${String(value.market)}, expected ${market}.`);
  }
  if (!isRecord(value.albums)) {
    throw new Error("Spotify enrichment cache has an unexpected shape.");
  }
  return value as unknown as SpotifyEnrichmentCache;
}

function searchKey(artist: string, album: string): string {
  return `${normalizeLabel(artist)}\u241f${normalizeLabel(album)}`;
}

function isNodeError(value: unknown): value is NodeJS.ErrnoException {
  return value instanceof Error && "code" in value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
