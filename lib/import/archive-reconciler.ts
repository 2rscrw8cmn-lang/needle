import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AlbumSession, SessionizationReport } from "./album-sessionizer.ts";
import type {
  AlbumResolutionLink,
  AlbumResolutionReport,
  CanonicalAlbum,
  SpotifyAlbumEdition,
} from "./album-resolver.ts";
import type {
  SpotifyAlbumEnrichment,
  SpotifyArtistEnrichment,
  SpotifyEnrichmentReport,
  SpotifyTrackEnrichment,
} from "./spotify-enrichment.ts";
import type {
  AlbumMusicTypeClassification,
  GenreCatalogEntry,
  MusicType,
  MusicTypeTaxonomyReport,
} from "../taxonomy/music-types.ts";

export const LISTENER_SUMMARY_VERSION = 1 as const;
export const RUNTIME_ARCHIVE_VERSION = 1 as const;
export const ARCHIVE_IMPORT_VERSION = 1 as const;
export const WORKBOOK_LIBRARY_REFERENCE = {
  candidateAlbums: 402,
  defaultLibraryMembers: 337,
  confirmedCompleteAtLeastTwice: 243,
  confirmedCompleteOnce: 23,
  nearComplete: 71,
} as const;

export interface ArchiveReconciliationArtifacts {
  sessionizationReport: SessionizationReport;
  sessions: AlbumSession[];
  canonicalAlbums: CanonicalAlbum[];
  editions: SpotifyAlbumEdition[];
  resolutionLinks: AlbumResolutionLink[];
  resolutionReport: AlbumResolutionReport;
  enrichedAlbums: SpotifyAlbumEnrichment[];
  enrichedArtists: SpotifyArtistEnrichment[];
  enrichedTracks: SpotifyTrackEnrichment[];
  enrichmentReport: SpotifyEnrichmentReport;
  musicTypeClassifications: AlbumMusicTypeClassification[];
  genreCatalog: GenreCatalogEntry[];
  taxonomyReport: MusicTypeTaxonomyReport;
}

export interface ListenerAlbumSummary {
  canonical_album_id: string;
  archive_member: boolean;
  archive_rule: "full_or_near_complete_v1";
  first_meaningful_listen_at: string | null;
  last_meaningful_listen_at: string | null;
  qualifying_session_count: number;
  full_session_count: number;
  near_complete_session_count: number;
  sparse_session_count: number;
  review_session_count: number;
  total_session_count: number;
  distinct_listening_months: number;
  distinct_listening_years: number;
  listening_months: string[];
  listening_years: number[];
  evidence_span_days: number | null;
  source_album_count: number;
  revisit_inputs: {
    repeat_qualifying_sessions: boolean;
    spans_multiple_months: boolean;
    spans_multiple_years: boolean;
    spans_at_least_one_year: boolean;
  };
}

export interface RuntimeArtist {
  spotify_artist_id: string;
  name: string;
  spotify_url: string | null;
}

export interface RuntimeAlbum {
  canonical_album_id: string;
  title: string;
  primary_artist_id: string;
  primary_artist_name: string;
  original_release_date: string | null;
  preferred_edition_id: string | null;
  catalog_confidence: CanonicalAlbum["catalog_confidence"];
  catalog_review_status: CanonicalAlbum["review_status"];
  artwork_url: string | null;
  spotify_url: string | null;
  music_type: MusicType | null;
  music_type_status: AlbumMusicTypeClassification["status"] | null;
  taxonomy_version: number | null;
  mapping_version: number | null;
  archive_member: boolean;
}

export interface RuntimeAlbumEdition {
  edition_id: string;
  canonical_album_id: string;
  spotify_album_id: string;
  title: string;
  release_date: string | null;
  edition_type: SpotifyAlbumEdition["edition_type"];
  total_tracks: number;
  is_preferred: boolean;
  match_confidence: SpotifyAlbumEdition["match_confidence"];
  edition_ambiguity: boolean;
}

export interface RuntimeTrack {
  spotify_track_id: string;
  canonical_album_id: string;
  edition_id: string;
  spotify_album_id: string;
  name: string;
  disc_number: number;
  track_number: number;
  duration_ms: number;
  explicit: boolean;
  spotify_url: string | null;
  artist_ids: string[];
}

export interface RuntimeAlbumSession {
  session_id: string;
  canonical_album_id: string;
  started_at: string;
  ended_at: string;
  session_minutes: number;
  evidence_status: AlbumSession["evidence_status"];
  meaningful_unique_tracks: number;
  credible_unique_tracks: number;
  local_coverage: number;
  missing_local_track_count: number;
}

export interface RuntimeGenre {
  genre_key: string;
  name: string;
  music_type: MusicType | null;
  mapping_status: GenreCatalogEntry["mapping_status"];
}

export interface RuntimeAlbumGenre {
  canonical_album_id: string;
  genre_key: string;
}

export interface RuntimeArchiveSnapshot {
  version: 1;
  import_batch_id: string;
  artists: RuntimeArtist[];
  albums: RuntimeAlbum[];
  editions: RuntimeAlbumEdition[];
  tracks: RuntimeTrack[];
  sessions: RuntimeAlbumSession[];
  summaries: ListenerAlbumSummary[];
  genres: RuntimeGenre[];
  album_genres: RuntimeAlbumGenre[];
}

export interface ArchiveReconciliationReport {
  reportVersion: 1;
  summaryVersion: 1;
  runtimeArchiveVersion: 1;
  archiveImportVersion: 1;
  importBatchId: string;
  ok: boolean;
  totals: {
    sourceSessions: number;
    mappedSessions: number;
    unresolvedSessions: number;
    canonicalAlbums: number;
    acceptedCanonicalAlbums: number;
    catalogReviewCanonicalAlbums: number;
    libraryMembers: number;
    nonLibraryCanonicalAlbums: number;
    enrichedAlbums: number;
    albumsWithArtwork: number;
    classifiedMusicTypes: number;
    unclassifiedMusicTypes: number;
    runtimeArtists: number;
    runtimeEditions: number;
    runtimeTracks: number;
    runtimeGenres: number;
  };
  coverage: {
    sourceAlbumResolutionRate: number;
    albumEnrichmentRate: number;
    artworkCoverageRate: number;
    musicTypeClassificationRate: number;
  };
  workbookReference: {
    candidateAlbums: number;
    defaultLibraryMembers: number;
    actualLibraryMembers: number;
    libraryMemberDelta: number;
  };
  reconciliation: {
    stageReportsOk: boolean;
    importBatchMatches: boolean;
    sessionAttributionBalance: boolean;
    canonicalSummaryBalance: boolean;
    libraryRuleExact: boolean;
    uniqueCanonicalAlbumIds: boolean;
    uniqueSummaryAlbumIds: boolean;
    uniqueRuntimeEditionIds: boolean;
    uniqueRuntimeTrackIds: boolean;
    editionAlbumIdsKnown: boolean;
    enrichmentAlbumIdsKnown: boolean;
    taxonomyAlbumIdsKnown: boolean;
    runtimeSessionsMinimized: boolean;
  };
  notes: string[];
}

export interface ArchiveReconciliationResult {
  summaries: ListenerAlbumSummary[];
  snapshot: RuntimeArchiveSnapshot;
  report: ArchiveReconciliationReport;
  importSql: string;
}

export async function readArchiveReconciliationArtifacts(inputDir: string): Promise<ArchiveReconciliationArtifacts> {
  const [
    sessionizationReport,
    sessions,
    canonicalAlbums,
    editions,
    resolutionLinks,
    resolutionReport,
    enrichedAlbums,
    enrichedArtists,
    enrichedTracks,
    enrichmentReport,
    musicTypeClassifications,
    genreCatalog,
    taxonomyReport,
  ] = await Promise.all([
    readJson(path.join(inputDir, "sessionization-report.json")),
    readJson(path.join(inputDir, "album-sessions.json")),
    readJson(path.join(inputDir, "canonical-albums.json")),
    readJson(path.join(inputDir, "spotify-album-editions.json")),
    readJson(path.join(inputDir, "album-resolution-links.json")),
    readJson(path.join(inputDir, "album-resolution-report.json")),
    readJson(path.join(inputDir, "spotify-album-enrichment.json")),
    readJson(path.join(inputDir, "spotify-artist-enrichment.json")),
    readJson(path.join(inputDir, "spotify-track-enrichment.json")),
    readJson(path.join(inputDir, "spotify-enrichment-report.json")),
    readJson(path.join(inputDir, "album-music-type-classifications.json")),
    readJson(path.join(inputDir, "genre-catalog.json")),
    readJson(path.join(inputDir, "music-type-taxonomy-report.json")),
  ]);

  assertReportLike(sessionizationReport, "sessionization-report.json");
  assertArray(sessions, "album-sessions.json");
  assertArray(canonicalAlbums, "canonical-albums.json");
  assertArray(editions, "spotify-album-editions.json");
  assertArray(resolutionLinks, "album-resolution-links.json");
  assertReportLike(resolutionReport, "album-resolution-report.json");
  assertArray(enrichedAlbums, "spotify-album-enrichment.json");
  assertArray(enrichedArtists, "spotify-artist-enrichment.json");
  assertArray(enrichedTracks, "spotify-track-enrichment.json");
  assertReportLike(enrichmentReport, "spotify-enrichment-report.json");
  assertArray(musicTypeClassifications, "album-music-type-classifications.json");
  assertArray(genreCatalog, "genre-catalog.json");
  assertReportLike(taxonomyReport, "music-type-taxonomy-report.json");

  return {
    sessionizationReport: sessionizationReport as unknown as SessionizationReport,
    sessions: sessions as unknown as AlbumSession[],
    canonicalAlbums: canonicalAlbums as unknown as CanonicalAlbum[],
    editions: editions as unknown as SpotifyAlbumEdition[],
    resolutionLinks: resolutionLinks as unknown as AlbumResolutionLink[],
    resolutionReport: resolutionReport as unknown as AlbumResolutionReport,
    enrichedAlbums: enrichedAlbums as unknown as SpotifyAlbumEnrichment[],
    enrichedArtists: enrichedArtists as unknown as SpotifyArtistEnrichment[],
    enrichedTracks: enrichedTracks as unknown as SpotifyTrackEnrichment[],
    enrichmentReport: enrichmentReport as unknown as SpotifyEnrichmentReport,
    musicTypeClassifications: musicTypeClassifications as unknown as AlbumMusicTypeClassification[],
    genreCatalog: genreCatalog as unknown as GenreCatalogEntry[],
    taxonomyReport: taxonomyReport as unknown as MusicTypeTaxonomyReport,
  };
}

export function reconcileImportedArchive(artifacts: ArchiveReconciliationArtifacts): ArchiveReconciliationResult {
  const canonicalIds = new Set(artifacts.canonicalAlbums.map((album) => album.canonical_album_id));
  const linkBySourceKey = new Map(artifacts.resolutionLinks.map((link) => [link.source_album_key, link] as const));
  const sessionsByCanonical = new Map<string, AlbumSession[]>();
  const unresolvedSessions: AlbumSession[] = [];

  for (const session of artifacts.sessions) {
    const link = linkBySourceKey.get(session.source_album_key);
    const canonicalId = link?.canonical_album_id ?? null;
    if (!canonicalId || !canonicalIds.has(canonicalId)) {
      unresolvedSessions.push(session);
      continue;
    }
    const current = sessionsByCanonical.get(canonicalId) ?? [];
    current.push(session);
    sessionsByCanonical.set(canonicalId, current);
  }

  const summaries = [...artifacts.canonicalAlbums]
    .sort(compareCanonicalAlbums)
    .map((album) => buildListenerSummary(album, sessionsByCanonical.get(album.canonical_album_id) ?? []));
  const summaryByAlbum = new Map(summaries.map((summary) => [summary.canonical_album_id, summary] as const));

  const enrichmentByAlbum = new Map(
    artifacts.enrichedAlbums.map((album) => [album.canonical_album_id, album] as const),
  );
  const classificationByAlbum = new Map(
    artifacts.musicTypeClassifications.map((item) => [item.canonical_album_id, item] as const),
  );

  const runtimeAlbums: RuntimeAlbum[] = artifacts.canonicalAlbums
    .map((album) => {
      const enrichment = enrichmentByAlbum.get(album.canonical_album_id) ?? null;
      const classification = classificationByAlbum.get(album.canonical_album_id) ?? null;
      const summary = summaryByAlbum.get(album.canonical_album_id)!;
      return {
        canonical_album_id: album.canonical_album_id,
        title: album.title,
        primary_artist_id: album.primary_artist_id,
        primary_artist_name: album.primary_artist_name,
        original_release_date: album.original_release_date,
        preferred_edition_id: album.preferred_edition_id,
        catalog_confidence: album.catalog_confidence,
        catalog_review_status: album.review_status,
        artwork_url: enrichment?.primary_artwork_url ?? null,
        spotify_url: enrichment?.spotify_url ?? null,
        music_type: classification?.music_type ?? null,
        music_type_status: classification?.status ?? null,
        taxonomy_version: classification?.taxonomy_version ?? null,
        mapping_version: classification?.mapping_version ?? null,
        archive_member: summary.archive_member,
      };
    })
    .sort((a, b) => a.canonical_album_id.localeCompare(b.canonical_album_id));

  const runtimeArtists = buildRuntimeArtists(artifacts);
  const runtimeEditions = artifacts.editions
    .filter((edition) => canonicalIds.has(edition.canonical_album_id))
    .map<RuntimeAlbumEdition>((edition) => ({
      edition_id: edition.edition_id,
      canonical_album_id: edition.canonical_album_id,
      spotify_album_id: edition.spotify_album_id,
      title: edition.title,
      release_date: edition.release_date,
      edition_type: edition.edition_type,
      total_tracks: edition.total_tracks,
      is_preferred: edition.is_preferred,
      match_confidence: edition.match_confidence,
      edition_ambiguity: edition.edition_ambiguity,
    }))
    .sort((a, b) => a.edition_id.localeCompare(b.edition_id));
  const editionBySpotifyAlbumId = new Map(runtimeEditions.map((edition) => [edition.spotify_album_id, edition] as const));

  const runtimeTracks = artifacts.enrichedTracks
    .flatMap<RuntimeTrack>((track) => {
      const edition = editionBySpotifyAlbumId.get(track.spotify_album_id);
      if (!edition) return [];
      return [{
        spotify_track_id: track.spotify_track_id,
        canonical_album_id: edition.canonical_album_id,
        edition_id: edition.edition_id,
        spotify_album_id: track.spotify_album_id,
        name: track.name,
        disc_number: track.disc_number,
        track_number: track.track_number,
        duration_ms: track.duration_ms,
        explicit: track.explicit,
        spotify_url: track.spotify_url,
        artist_ids: [...track.artist_ids].sort(),
      }];
    })
    .sort(compareRuntimeTracks);

  const runtimeSessions = [...sessionsByCanonical.entries()]
    .flatMap(([canonicalAlbumId, sessions]) => sessions.map((session) => minimizeSession(canonicalAlbumId, session)))
    .sort(compareRuntimeSessions);

  const runtimeGenres = artifacts.genreCatalog
    .map<RuntimeGenre>((genre) => ({
      genre_key: genre.normalized_name,
      name: genre.name,
      music_type: genre.music_type,
      mapping_status: genre.mapping_status,
    }))
    .sort((a, b) => a.genre_key.localeCompare(b.genre_key));
  const knownGenreKeys = new Set(runtimeGenres.map((genre) => genre.genre_key));
  const albumGenres = artifacts.musicTypeClassifications
    .flatMap<RuntimeAlbumGenre>((classification) => classification.detailed_genres
      .filter((genre) => knownGenreKeys.has(genre.normalized_name) && canonicalIds.has(classification.canonical_album_id))
      .map((genre) => ({
        canonical_album_id: classification.canonical_album_id,
        genre_key: genre.normalized_name,
      })))
    .sort((a, b) => a.canonical_album_id.localeCompare(b.canonical_album_id) || a.genre_key.localeCompare(b.genre_key));

  const snapshot: RuntimeArchiveSnapshot = {
    version: RUNTIME_ARCHIVE_VERSION,
    import_batch_id: artifacts.resolutionReport.importBatchId,
    artists: runtimeArtists,
    albums: runtimeAlbums,
    editions: runtimeEditions,
    tracks: runtimeTracks,
    sessions: runtimeSessions,
    summaries,
    genres: runtimeGenres,
    album_genres: dedupeAlbumGenres(albumGenres),
  };

  const report = buildReconciliationReport({
    artifacts,
    summaries,
    snapshot,
    unresolvedSessions,
    canonicalIds,
    enrichmentByAlbum,
    classificationByAlbum,
  });
  const importSql = renderArchiveImportSql(snapshot);
  return { summaries, snapshot, report, importSql };
}

export async function writeArchiveReconciliationOutputs(options: {
  outputDir: string;
  result: ArchiveReconciliationResult;
}): Promise<void> {
  await mkdir(options.outputDir, { recursive: true });
  await Promise.all([
    writeJson(path.join(options.outputDir, "listener-album-summaries.json"), options.result.summaries),
    writeJson(path.join(options.outputDir, "runtime-archive.json"), options.result.snapshot),
    writeJson(path.join(options.outputDir, "archive-reconciliation-report.json"), options.result.report),
    writeFile(path.join(options.outputDir, "archive-import.sql"), options.result.importSql, "utf8"),
  ]);
  await writeFile(
    path.join(options.outputDir, "archive-reconciliation-report.md"),
    `${renderArchiveReconciliationReportMarkdown(options.result.report)}\n`,
    "utf8",
  );
}

export function renderArchiveReconciliationReportMarkdown(report: ArchiveReconciliationReport): string {
  return [
    "# Needle Phase 1 Archive Reconciliation",
    "",
    `- Import batch: **${report.importBatchId}**`,
    `- Result: **${report.ok ? "PASS" : "FAIL"}**`,
    `- Listener summary version: **${report.summaryVersion}**`,
    `- Runtime archive version: **${report.runtimeArchiveVersion}**`,
    "",
    "## Archive counts",
    "",
    "| Metric | Count |",
    "| --- | ---: |",
    `| Canonical albums | ${report.totals.canonicalAlbums} |`,
    `| Accepted catalog albums | ${report.totals.acceptedCanonicalAlbums} |`,
    `| Catalog-review albums | ${report.totals.catalogReviewCanonicalAlbums} |`,
    `| Default Library members (D-009) | ${report.totals.libraryMembers} |`,
    `| Non-Library canonical albums | ${report.totals.nonLibraryCanonicalAlbums} |`,
    `| Source sessions | ${report.totals.sourceSessions} |`,
    `| Canonical-attributed sessions | ${report.totals.mappedSessions} |`,
    `| Unresolved sessions | ${report.totals.unresolvedSessions} |`,
    "",
    "## Coverage",
    "",
    `- Source album resolution: **${formatPercent(report.coverage.sourceAlbumResolutionRate)}**`,
    `- Spotify enrichment: **${formatPercent(report.coverage.albumEnrichmentRate)}**`,
    `- Artwork: **${formatPercent(report.coverage.artworkCoverageRate)}**`,
    `- Music Type classification: **${formatPercent(report.coverage.musicTypeClassificationRate)}**`,
    "",
    "## Workbook calibration",
    "",
    `- Workbook-derived default Library reference: **${report.workbookReference.defaultLibraryMembers}**`,
    `- Needle default Library members: **${report.workbookReference.actualLibraryMembers}**`,
    `- Delta: **${signed(report.workbookReference.libraryMemberDelta)}**`,
    "",
    "The workbook is a calibration reference, not a target to tune toward. Any delta is reported explicitly and should be explained from canonical edition collapse, catalog review, or encoded session rules before Phase 2 is approved against the real archive.",
    "",
    "## Runtime/privacy boundary",
    "",
    "`runtime-archive.json` and the generated D1 import contain canonical catalog records, minimized album sessions, listener summaries, taxonomy data, and provider metadata. They do not contain raw playback events, source event IDs, IP/device/country fields, or the Spotify export itself.",
    "",
    "`personal_album_state` is never deleted by the generated import. Albums missing from a later import are marked inactive rather than deleted so personal state remains attached if the album returns in a future reimport.",
    "",
    "## Notes",
    "",
    ...report.notes.map((note) => `- ${note}`),
  ].join("\n");
}

export function renderArchiveImportSql(snapshot: RuntimeArchiveSnapshot): string {
  const statements: string[] = [
    "PRAGMA foreign_keys = ON;",
    `INSERT INTO import_batches (import_batch_id, archive_version, imported_at) VALUES (${sql(snapshot.import_batch_id)}, ${ARCHIVE_IMPORT_VERSION}, CURRENT_TIMESTAMP) ON CONFLICT(import_batch_id) DO UPDATE SET archive_version = excluded.archive_version, imported_at = excluded.imported_at;`,
    "UPDATE artists SET is_current = 0;",
    "UPDATE albums SET is_current = 0;",
    "DELETE FROM album_genres;",
    "DELETE FROM genres;",
    "DELETE FROM album_sessions;",
    "DELETE FROM listener_album_summaries;",
    "DELETE FROM tracks;",
    "DELETE FROM album_editions;",
  ];

  for (const artist of snapshot.artists) {
    statements.push(
      `INSERT INTO artists (spotify_artist_id, name, spotify_url, is_current, import_batch_id) VALUES (${sql(artist.spotify_artist_id)}, ${sql(artist.name)}, ${sql(artist.spotify_url)}, 1, ${sql(snapshot.import_batch_id)}) ON CONFLICT(spotify_artist_id) DO UPDATE SET name = excluded.name, spotify_url = excluded.spotify_url, is_current = 1, import_batch_id = excluded.import_batch_id;`,
    );
  }
  for (const album of snapshot.albums) {
    statements.push(
      `INSERT INTO albums (canonical_album_id, title, primary_artist_id, primary_artist_name, original_release_date, preferred_edition_id, catalog_confidence, catalog_review_status, artwork_url, spotify_url, music_type, music_type_status, taxonomy_version, mapping_version, archive_member, is_current, import_batch_id) VALUES (${sql(album.canonical_album_id)}, ${sql(album.title)}, ${sql(album.primary_artist_id)}, ${sql(album.primary_artist_name)}, ${sql(album.original_release_date)}, ${sql(album.preferred_edition_id)}, ${sql(album.catalog_confidence)}, ${sql(album.catalog_review_status)}, ${sql(album.artwork_url)}, ${sql(album.spotify_url)}, ${sql(album.music_type)}, ${sql(album.music_type_status)}, ${sqlNumber(album.taxonomy_version)}, ${sqlNumber(album.mapping_version)}, ${bool(album.archive_member)}, 1, ${sql(snapshot.import_batch_id)}) ON CONFLICT(canonical_album_id) DO UPDATE SET title = excluded.title, primary_artist_id = excluded.primary_artist_id, primary_artist_name = excluded.primary_artist_name, original_release_date = excluded.original_release_date, preferred_edition_id = excluded.preferred_edition_id, catalog_confidence = excluded.catalog_confidence, catalog_review_status = excluded.catalog_review_status, artwork_url = excluded.artwork_url, spotify_url = excluded.spotify_url, music_type = excluded.music_type, music_type_status = excluded.music_type_status, taxonomy_version = excluded.taxonomy_version, mapping_version = excluded.mapping_version, archive_member = excluded.archive_member, is_current = 1, import_batch_id = excluded.import_batch_id;`,
    );
  }
  for (const edition of snapshot.editions) {
    statements.push(
      `INSERT INTO album_editions (edition_id, canonical_album_id, spotify_album_id, title, release_date, edition_type, total_tracks, is_preferred, match_confidence, edition_ambiguity, import_batch_id) VALUES (${sql(edition.edition_id)}, ${sql(edition.canonical_album_id)}, ${sql(edition.spotify_album_id)}, ${sql(edition.title)}, ${sql(edition.release_date)}, ${sql(edition.edition_type)}, ${edition.total_tracks}, ${bool(edition.is_preferred)}, ${sql(edition.match_confidence)}, ${bool(edition.edition_ambiguity)}, ${sql(snapshot.import_batch_id)});`,
    );
  }
  for (const track of snapshot.tracks) {
    statements.push(
      `INSERT INTO tracks (spotify_track_id, canonical_album_id, edition_id, spotify_album_id, name, disc_number, track_number, duration_ms, explicit, spotify_url, artist_ids_json, import_batch_id) VALUES (${sql(track.spotify_track_id)}, ${sql(track.canonical_album_id)}, ${sql(track.edition_id)}, ${sql(track.spotify_album_id)}, ${sql(track.name)}, ${track.disc_number}, ${track.track_number}, ${track.duration_ms}, ${bool(track.explicit)}, ${sql(track.spotify_url)}, ${sql(JSON.stringify(track.artist_ids))}, ${sql(snapshot.import_batch_id)});`,
    );
  }
  for (const session of snapshot.sessions) {
    statements.push(
      `INSERT INTO album_sessions (session_id, canonical_album_id, started_at, ended_at, session_minutes, evidence_status, meaningful_unique_tracks, credible_unique_tracks, local_coverage, missing_local_track_count, import_batch_id) VALUES (${sql(session.session_id)}, ${sql(session.canonical_album_id)}, ${sql(session.started_at)}, ${sql(session.ended_at)}, ${session.session_minutes}, ${sql(session.evidence_status)}, ${session.meaningful_unique_tracks}, ${session.credible_unique_tracks}, ${session.local_coverage}, ${session.missing_local_track_count}, ${sql(snapshot.import_batch_id)});`,
    );
  }
  for (const summary of snapshot.summaries) {
    statements.push(
      `INSERT INTO listener_album_summaries (canonical_album_id, archive_member, archive_rule, first_meaningful_listen_at, last_meaningful_listen_at, qualifying_session_count, full_session_count, near_complete_session_count, sparse_session_count, review_session_count, total_session_count, distinct_listening_months, distinct_listening_years, listening_months_json, listening_years_json, evidence_span_days, source_album_count, repeat_qualifying_sessions, spans_multiple_months, spans_multiple_years, spans_at_least_one_year, import_batch_id) VALUES (${sql(summary.canonical_album_id)}, ${bool(summary.archive_member)}, ${sql(summary.archive_rule)}, ${sql(summary.first_meaningful_listen_at)}, ${sql(summary.last_meaningful_listen_at)}, ${summary.qualifying_session_count}, ${summary.full_session_count}, ${summary.near_complete_session_count}, ${summary.sparse_session_count}, ${summary.review_session_count}, ${summary.total_session_count}, ${summary.distinct_listening_months}, ${summary.distinct_listening_years}, ${sql(JSON.stringify(summary.listening_months))}, ${sql(JSON.stringify(summary.listening_years))}, ${sqlNumber(summary.evidence_span_days)}, ${summary.source_album_count}, ${bool(summary.revisit_inputs.repeat_qualifying_sessions)}, ${bool(summary.revisit_inputs.spans_multiple_months)}, ${bool(summary.revisit_inputs.spans_multiple_years)}, ${bool(summary.revisit_inputs.spans_at_least_one_year)}, ${sql(snapshot.import_batch_id)});`,
    );
  }
  for (const genre of snapshot.genres) {
    statements.push(
      `INSERT INTO genres (genre_key, name, music_type, mapping_status, import_batch_id) VALUES (${sql(genre.genre_key)}, ${sql(genre.name)}, ${sql(genre.music_type)}, ${sql(genre.mapping_status)}, ${sql(snapshot.import_batch_id)});`,
    );
  }
  for (const albumGenre of snapshot.album_genres) {
    statements.push(
      `INSERT INTO album_genres (canonical_album_id, genre_key, import_batch_id) VALUES (${sql(albumGenre.canonical_album_id)}, ${sql(albumGenre.genre_key)}, ${sql(snapshot.import_batch_id)});`,
    );
  }

  return `${statements.join("\n")}\n`;
}

function buildListenerSummary(album: CanonicalAlbum, sessions: AlbumSession[]): ListenerAlbumSummary {
  const sorted = [...sessions].sort(compareSourceSessions);
  const full = sorted.filter((session) => session.evidence_status === "full");
  const near = sorted.filter((session) => session.evidence_status === "near_complete");
  const sparse = sorted.filter((session) => session.evidence_status === "sparse");
  const review = sorted.filter((session) => session.evidence_status === "review");
  const qualifying = [...full, ...near].sort(compareSourceSessions);
  const listeningMonths = sortedUnique(qualifying.map((session) => session.started_at.slice(0, 7)));
  const listeningYears = sortedUniqueNumbers(
    qualifying.map((session) => Number(session.started_at.slice(0, 4))).filter(Number.isFinite),
  );
  const first = qualifying[0]?.started_at ?? null;
  const last = qualifying.length > 0 ? qualifying[qualifying.length - 1].ended_at : null;
  const evidenceSpanDays = first && last ? Math.max(0, Math.floor((Date.parse(last) - Date.parse(first)) / 86_400_000)) : null;
  const archiveMember = qualifying.length > 0;

  return {
    canonical_album_id: album.canonical_album_id,
    archive_member: archiveMember,
    archive_rule: "full_or_near_complete_v1",
    first_meaningful_listen_at: first,
    last_meaningful_listen_at: last,
    qualifying_session_count: qualifying.length,
    full_session_count: full.length,
    near_complete_session_count: near.length,
    sparse_session_count: sparse.length,
    review_session_count: review.length,
    total_session_count: sorted.length,
    distinct_listening_months: listeningMonths.length,
    distinct_listening_years: listeningYears.length,
    listening_months: listeningMonths,
    listening_years: listeningYears,
    evidence_span_days: evidenceSpanDays,
    source_album_count: album.source_album_keys.length,
    revisit_inputs: {
      repeat_qualifying_sessions: qualifying.length >= 2,
      spans_multiple_months: listeningMonths.length >= 2,
      spans_multiple_years: listeningYears.length >= 2,
      spans_at_least_one_year: (evidenceSpanDays ?? 0) >= 365,
    },
  };
}

function buildRuntimeArtists(artifacts: ArchiveReconciliationArtifacts): RuntimeArtist[] {
  const artists = new Map<string, RuntimeArtist>();
  for (const artist of artifacts.enrichedArtists) {
    artists.set(artist.spotify_artist_id, {
      spotify_artist_id: artist.spotify_artist_id,
      name: artist.name,
      spotify_url: artist.spotify_url,
    });
  }
  for (const album of artifacts.canonicalAlbums) {
    if (!artists.has(album.primary_artist_id)) {
      artists.set(album.primary_artist_id, {
        spotify_artist_id: album.primary_artist_id,
        name: album.primary_artist_name,
        spotify_url: null,
      });
    }
  }
  return [...artists.values()].sort((a, b) => a.name.localeCompare(b.name) || a.spotify_artist_id.localeCompare(b.spotify_artist_id));
}

function minimizeSession(canonicalAlbumId: string, session: AlbumSession): RuntimeAlbumSession {
  return {
    session_id: session.session_id,
    canonical_album_id: canonicalAlbumId,
    started_at: session.started_at,
    ended_at: session.ended_at,
    session_minutes: session.session_minutes,
    evidence_status: session.evidence_status,
    meaningful_unique_tracks: session.meaningful_unique_tracks,
    credible_unique_tracks: session.credible_unique_tracks,
    local_coverage: session.local_coverage,
    missing_local_track_count: session.missing_local_track_count,
  };
}

function buildReconciliationReport(options: {
  artifacts: ArchiveReconciliationArtifacts;
  summaries: ListenerAlbumSummary[];
  snapshot: RuntimeArchiveSnapshot;
  unresolvedSessions: AlbumSession[];
  canonicalIds: Set<string>;
  enrichmentByAlbum: Map<string, SpotifyAlbumEnrichment>;
  classificationByAlbum: Map<string, AlbumMusicTypeClassification>;
}): ArchiveReconciliationReport {
  const { artifacts, summaries, snapshot, unresolvedSessions, canonicalIds, enrichmentByAlbum, classificationByAlbum } = options;
  const libraryMembers = summaries.filter((summary) => summary.archive_member).length;
  const accepted = artifacts.canonicalAlbums.filter((album) => album.review_status === "accepted").length;
  const catalogReview = artifacts.canonicalAlbums.length - accepted;
  const resolvedSourceAlbums = artifacts.resolutionLinks.filter((link) => link.canonical_album_id !== null).length;
  const enrichedCanonicalIds = [...enrichmentByAlbum.keys()];
  const classified = artifacts.musicTypeClassifications.filter((item) => item.music_type !== null).length;
  const mappedSessions = snapshot.sessions.length;
  const stageReportsOk = Boolean(
    artifacts.sessionizationReport.ok && artifacts.resolutionReport.ok && artifacts.enrichmentReport.ok && artifacts.taxonomyReport.ok,
  );
  const importBatchMatches = artifacts.sessionizationReport.importBatchId === artifacts.resolutionReport.importBatchId;
  const sessionAttributionBalance = mappedSessions + unresolvedSessions.length === artifacts.sessions.length;
  const canonicalSummaryBalance = summaries.length === artifacts.canonicalAlbums.length;
  const libraryRuleExact = summaries.every(
    (summary) => summary.archive_member === (summary.full_session_count + summary.near_complete_session_count > 0),
  );
  const uniqueCanonicalAlbumIds = unique(artifacts.canonicalAlbums.map((album) => album.canonical_album_id));
  const uniqueSummaryAlbumIds = unique(summaries.map((summary) => summary.canonical_album_id));
  const uniqueRuntimeEditionIds = unique(snapshot.editions.map((edition) => edition.edition_id));
  const uniqueRuntimeTrackIds = unique(snapshot.tracks.map((track) => track.spotify_track_id));
  const editionAlbumIdsKnown = snapshot.editions.every((edition) => canonicalIds.has(edition.canonical_album_id));
  const enrichmentAlbumIdsKnown = enrichedCanonicalIds.every((canonicalAlbumId) => canonicalIds.has(canonicalAlbumId));
  const taxonomyAlbumIdsKnown = [...classificationByAlbum.keys()].every((canonicalAlbumId) => canonicalIds.has(canonicalAlbumId));
  const runtimeSessionsMinimized = snapshot.sessions.every(
    (session) => !("event_ids" in session) && !("source_refs" in session) && !("source_album_key" in session),
  );

  const reconciliation = {
    stageReportsOk,
    importBatchMatches,
    sessionAttributionBalance,
    canonicalSummaryBalance,
    libraryRuleExact,
    uniqueCanonicalAlbumIds,
    uniqueSummaryAlbumIds,
    uniqueRuntimeEditionIds,
    uniqueRuntimeTrackIds,
    editionAlbumIdsKnown,
    enrichmentAlbumIdsKnown,
    taxonomyAlbumIdsKnown,
    runtimeSessionsMinimized,
  };

  const report: ArchiveReconciliationReport = {
    reportVersion: 1,
    summaryVersion: LISTENER_SUMMARY_VERSION,
    runtimeArchiveVersion: RUNTIME_ARCHIVE_VERSION,
    archiveImportVersion: ARCHIVE_IMPORT_VERSION,
    importBatchId: artifacts.resolutionReport.importBatchId,
    ok: Object.values(reconciliation).every(Boolean),
    totals: {
      sourceSessions: artifacts.sessions.length,
      mappedSessions,
      unresolvedSessions: unresolvedSessions.length,
      canonicalAlbums: artifacts.canonicalAlbums.length,
      acceptedCanonicalAlbums: accepted,
      catalogReviewCanonicalAlbums: catalogReview,
      libraryMembers,
      nonLibraryCanonicalAlbums: artifacts.canonicalAlbums.length - libraryMembers,
      enrichedAlbums: artifacts.enrichedAlbums.length,
      albumsWithArtwork: artifacts.enrichedAlbums.filter((album) => album.primary_artwork_url !== null).length,
      classifiedMusicTypes: classified,
      unclassifiedMusicTypes: artifacts.musicTypeClassifications.length - classified,
      runtimeArtists: snapshot.artists.length,
      runtimeEditions: snapshot.editions.length,
      runtimeTracks: snapshot.tracks.length,
      runtimeGenres: snapshot.genres.length,
    },
    coverage: {
      sourceAlbumResolutionRate: rate(resolvedSourceAlbums, artifacts.resolutionLinks.length),
      albumEnrichmentRate: rate(artifacts.enrichedAlbums.length, artifacts.canonicalAlbums.length),
      artworkCoverageRate: rate(
        artifacts.enrichedAlbums.filter((album) => album.primary_artwork_url !== null).length,
        artifacts.canonicalAlbums.length,
      ),
      musicTypeClassificationRate: rate(classified, artifacts.canonicalAlbums.length),
    },
    workbookReference: {
      candidateAlbums: WORKBOOK_LIBRARY_REFERENCE.candidateAlbums,
      defaultLibraryMembers: WORKBOOK_LIBRARY_REFERENCE.defaultLibraryMembers,
      actualLibraryMembers: libraryMembers,
      libraryMemberDelta: libraryMembers - WORKBOOK_LIBRARY_REFERENCE.defaultLibraryMembers,
    },
    reconciliation,
    notes: buildNotes({
      artifacts,
      libraryMembers,
      unresolvedSessions: unresolvedSessions.length,
      classified,
    }),
  };
  return report;
}

function buildNotes(options: {
  artifacts: ArchiveReconciliationArtifacts;
  libraryMembers: number;
  unresolvedSessions: number;
  classified: number;
}): string[] {
  const notes: string[] = [];
  const delta = options.libraryMembers - WORKBOOK_LIBRARY_REFERENCE.defaultLibraryMembers;
  if (delta === 0) notes.push("Default Library membership matches the workbook-derived 337-album calibration reference.");
  else notes.push(`Default Library membership differs from the workbook-derived reference by ${signed(delta)} album(s); keep this delta explicit and inspect canonical collapse/review evidence before final Phase 1 approval.`);
  if (options.unresolvedSessions > 0) notes.push(`${options.unresolvedSessions} session(s) remain outside a canonical album because their source album identity is unresolved; their evidence is preserved in the private import artifacts but is not copied into runtime D1 tables.`);
  const unclassified = options.artifacts.canonicalAlbums.length - options.classified;
  if (unclassified > 0) notes.push(`${unclassified} canonical album(s) do not currently have a Music Type classification. This is coverage debt, not a reconciliation failure.`);
  if (options.artifacts.enrichedAlbums.length < options.artifacts.canonicalAlbums.length) notes.push("Spotify enrichment does not cover every canonical album. Valid canonical/history records remain intact when provider metadata is missing.");
  notes.push("PersonalAlbumState is outside generated artifacts and is not deleted or overwritten by archive-import.sql.");
  return notes;
}

function dedupeAlbumGenres(values: RuntimeAlbumGenre[]): RuntimeAlbumGenre[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = `${value.canonical_album_id}\u241f${value.genre_key}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function compareCanonicalAlbums(a: CanonicalAlbum, b: CanonicalAlbum): number {
  return a.canonical_album_id.localeCompare(b.canonical_album_id);
}

function compareSourceSessions(a: AlbumSession, b: AlbumSession): number {
  return a.started_at.localeCompare(b.started_at) || a.session_id.localeCompare(b.session_id);
}

function compareRuntimeSessions(a: RuntimeAlbumSession, b: RuntimeAlbumSession): number {
  return a.started_at.localeCompare(b.started_at) || a.session_id.localeCompare(b.session_id);
}

function compareRuntimeTracks(a: RuntimeTrack, b: RuntimeTrack): number {
  return a.canonical_album_id.localeCompare(b.canonical_album_id) ||
    a.disc_number - b.disc_number ||
    a.track_number - b.track_number ||
    a.spotify_track_id.localeCompare(b.spotify_track_id);
}

function rate(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Number((numerator / denominator).toFixed(6));
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

function sortedUnique(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function sortedUniqueNumbers(values: number[]): number[] {
  return [...new Set(values)].sort((a, b) => a - b);
}

function unique(values: string[]): boolean {
  return new Set(values).size === values.length;
}

function bool(value: boolean): string {
  return value ? "1" : "0";
}

function sqlNumber(value: number | null): string {
  return value === null ? "NULL" : String(value);
}

function sql(value: string | null): string {
  return value === null ? "NULL" : `'${value.replaceAll("'", "''")}'`;
}

async function readJson(filePath: string): Promise<unknown> {
  return JSON.parse(await readFile(filePath, "utf8")) as unknown;
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function assertArray(value: unknown, fileName: string): asserts value is unknown[] {
  if (!Array.isArray(value)) throw new Error(`${fileName} must contain a JSON array.`);
}

function assertReportLike(value: unknown, fileName: string): asserts value is Record<string, unknown> {
  if (!isRecord(value) || typeof value.ok !== "boolean") throw new Error(`${fileName} has an unexpected report shape.`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
