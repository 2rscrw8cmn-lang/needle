import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  MUSIC_TYPES,
  type MusicType,
  type MusicTypeTaxonomyReport,
} from "../taxonomy/music-types.ts";
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
import type { SpotifyEnrichmentReport } from "./spotify-enrichment.ts";

interface SpotifyCatalogCache {
  version: 1;
  market: string;
  tracks: Record<string, SpotifyTrackLookup | null>;
  searches: Record<string, SpotifyAlbumSummary[]>;
  albumTracks: Record<string, SpotifyTrackSummary[]>;
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

export interface CachedArchivePreviewManifest {
  version: 1;
  preview: true;
  local_only: true;
  generated_at: string;
  market: string;
  cache: CachedCatalogStats;
  totals: {
    source_albums: number;
    resolved_source_albums: number;
    review_source_albums: number;
    canonical_albums: number;
    library_members: number;
  };
  coverage: {
    artwork: 0;
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
  const cache = parseCache(raw, market);
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

export function buildCachedArchivePreview(options: {
  stageThree: StageThreeArtifacts;
  resolution: AlbumResolutionResult;
  market: string;
  cacheStats: CachedCatalogStats;
  generatedAt?: string;
}): { result: ArchiveReconciliationResult; manifest: CachedArchivePreviewManifest } {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const acceptedCount = options.resolution.canonicalAlbums.filter(
    (album) => album.review_status === "accepted",
  ).length;

  const enrichmentReport: SpotifyEnrichmentReport = {
    reportVersion: 1,
    enrichmentVersion: 1,
    provider: "spotify",
    market: options.market,
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
      albumsWithoutGenreMetadata: acceptedCount,
    },
    reconciliation: {
      targetBalance: true,
      uniqueAlbumIds: true,
      uniqueArtistIds: true,
      uniqueTrackIds: true,
    },
  };

  const emptyMusicTypeCounts = Object.fromEntries(
    MUSIC_TYPES.map((musicType) => [musicType, 0]),
  ) as Record<MusicType, number>;
  const taxonomyReport: MusicTypeTaxonomyReport = {
    reportVersion: 1,
    taxonomyVersion: 1,
    mappingVersion: 1,
    ok: true,
    totals: {
      enrichedAlbums: 0,
      classifiedAlbums: 0,
      automaticClassifications: 0,
      manualOverrides: 0,
      unclassifiedNoGenres: 0,
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
    sessionizationReport: options.stageThree.report,
    sessions: options.stageThree.sessions,
    canonicalAlbums: options.resolution.canonicalAlbums,
    editions: options.resolution.editions,
    resolutionLinks: options.resolution.links,
    resolutionReport: options.resolution.report,
    enrichedAlbums: [],
    enrichedArtists: [],
    enrichedTracks: [],
    enrichmentReport,
    musicTypeClassifications: [],
    genreCatalog: [],
    taxonomyReport,
  };

  const result = reconcileImportedArchive(artifacts);
  const editionById = new Map(
    result.snapshot.editions.map((edition) => [edition.edition_id, edition] as const),
  );

  result.snapshot.albums = result.snapshot.albums.map((album) => {
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
    spotify_url: `https://open.spotify.com/artist/${encodeURIComponent(artist.spotify_artist_id)}`,
  }));
  result.importSql = renderArchiveImportSql(result.snapshot);

  const manifest: CachedArchivePreviewManifest = {
    version: 1,
    preview: true,
    local_only: true,
    generated_at: generatedAt,
    market: options.market,
    cache: options.cacheStats,
    totals: {
      source_albums: options.resolution.report.totals.provisionalSourceAlbums,
      resolved_source_albums: options.resolution.report.totals.resolvedSourceAlbums,
      review_source_albums: options.resolution.report.totals.reviewSourceAlbums,
      canonical_albums: options.resolution.canonicalAlbums.length,
      library_members: result.report.totals.libraryMembers,
    },
    coverage: {
      artwork: 0,
      music_type: 0,
    },
    warnings: [
      "LOCAL PREVIEW ONLY — do not load this archive into remote or production D1.",
      "Album identities are based only on Spotify catalog responses already present in spotify-resolution-cache.json.",
      "Missing cache entries are treated conservatively as unresolved/review rather than triggering network calls.",
      "Spotify artwork, detailed track enrichment, Genre, and Music Type remain incomplete until the final 1.04–1.06 pipeline completes.",
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

function parseCache(value: unknown, market: string): SpotifyCatalogCache {
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

function searchKey(artist: string, album: string): string {
  return `${normalizeLabel(artist)}\u241f${normalizeLabel(album)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
