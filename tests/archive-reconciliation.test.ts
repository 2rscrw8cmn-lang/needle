import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import {
  reconcileImportedArchive,
  renderArchiveImportSql,
  type ArchiveReconciliationArtifacts,
  type RuntimeArchiveSnapshot,
} from "../lib/import/archive-reconciler.ts";
import type { AlbumSession, SessionizationReport } from "../lib/import/album-sessionizer.ts";
import type {
  AlbumResolutionReport,
  CanonicalAlbum,
  SpotifyAlbumEdition,
} from "../lib/import/album-resolver.ts";
import type {
  SpotifyAlbumEnrichment,
  SpotifyArtistEnrichment,
  SpotifyEnrichmentReport,
  SpotifyTrackEnrichment,
} from "../lib/import/spotify-enrichment.ts";
import {
  MUSIC_TYPES,
  type AlbumMusicTypeClassification,
  type MusicTypeTaxonomyReport,
} from "../lib/taxonomy/music-types.ts";

const importBatchId = "fixture-import-001";

function makeSession(options: {
  id: string;
  source: string;
  status: AlbumSession["evidence_status"];
  started: string;
  ended: string;
  minutes: number;
  meaningful?: number;
  credible?: number;
  coverage?: number;
  missing?: number;
}): AlbumSession {
  return {
    session_id: options.id,
    source_album_key: options.source,
    import_batch_id: importBatchId,
    artist_name: "Fixture Artist",
    album_name: "Fixture Album",
    started_at: options.started,
    ended_at: options.ended,
    session_minutes: options.minutes,
    event_count: 10,
    positive_event_count: 10,
    meaningful_event_count: 10,
    evidence_status: options.status,
    known_local_tracks: 10,
    meaningful_unique_tracks: options.meaningful ?? 10,
    credible_unique_tracks: options.credible ?? 10,
    trackdone_unique_tracks: options.credible ?? 10,
    local_coverage: options.coverage ?? 1,
    missing_local_track_count: options.missing ?? 0,
    session_track_keys: ["track-a"],
    meaningful_track_keys: ["track-a"],
    credible_track_keys: ["track-a"],
    trackdone_track_keys: ["track-a"],
    missing_local_track_keys: [],
    event_ids: [`event-${options.id}`],
    review_reasons: [],
  };
}

function emptyVotes(): Record<(typeof MUSIC_TYPES)[number], number> {
  return Object.fromEntries(MUSIC_TYPES.map((musicType) => [musicType, 0])) as Record<(typeof MUSIC_TYPES)[number], number>;
}

function fixtureArtifacts(): ArchiveReconciliationArtifacts {
  const sessions: AlbumSession[] = [
    makeSession({
      id: "session-alpha-2020",
      source: "source-alpha-standard",
      status: "full",
      started: "2020-01-10T10:00:00.000Z",
      ended: "2020-01-10T10:40:00.000Z",
      minutes: 40,
    }),
    makeSession({
      id: "session-alpha-2022",
      source: "source-alpha-standard",
      status: "near_complete",
      started: "2022-03-12T10:00:00.000Z",
      ended: "2022-03-12T10:35:00.000Z",
      minutes: 35,
      meaningful: 9,
      credible: 9,
      coverage: 0.9,
      missing: 1,
    }),
    makeSession({
      id: "session-alpha-deluxe-2024",
      source: "source-alpha-deluxe",
      status: "full",
      started: "2024-06-15T10:00:00.000Z",
      ended: "2024-06-15T10:45:00.000Z",
      minutes: 45,
    }),
    makeSession({
      id: "session-beta-sparse",
      source: "source-beta",
      status: "sparse",
      started: "2021-05-01T12:00:00.000Z",
      ended: "2021-05-01T12:10:00.000Z",
      minutes: 10,
      meaningful: 2,
      credible: 2,
      coverage: 0.2,
      missing: 8,
    }),
    makeSession({
      id: "session-gamma-unresolved",
      source: "source-gamma",
      status: "full",
      started: "2023-09-01T09:00:00.000Z",
      ended: "2023-09-01T09:40:00.000Z",
      minutes: 40,
    }),
  ];

  const sessionizationReport: SessionizationReport = {
    reportVersion: 1,
    sessionizationVersion: 1,
    importBatchId,
    ok: true,
    rules: {
      sessionGapMs: 900000,
      meaningfulPlayMs: 30000,
      minLocalTracks: 5,
      nearCompleteMinCoverage: 0.8,
      nearCompleteMaxMissing: 2,
      minCandidateQualifyingSessions: 2,
    },
    totals: {
      normalizedEvents: 50,
      zeroMsEvents: 0,
      zeroMsEventsInRuns: 0,
      zeroMsEventsIgnored: 0,
      positiveEvents: 50,
      positiveEventsAssigned: 50,
      sourceSessionRuns: 5,
      provisionalCandidateAlbums: 4,
      candidateSessions: 5,
      fullSessions: 3,
      nearCompleteSessions: 1,
      sparseSessions: 1,
      reviewSessions: 0,
      qualifyingSessions: 4,
    },
    reconciliation: {
      matchesNormalizationReport: true,
      positiveEventsBalance: true,
      zeroMsEventsBalance: true,
    },
    workbookReference: {
      candidateAlbums: 402,
      qualifyingSessions: 2012,
      fullSessions: 1324,
      nearCompleteSessions: 688,
      candidateAlbumDelta: -398,
      qualifyingSessionDelta: -2008,
      fullSessionDelta: -1321,
      nearCompleteSessionDelta: -687,
    },
  };

  const canonicalAlbums: CanonicalAlbum[] = [
    {
      canonical_album_id: "alb_alpha",
      title: "Alpha Record",
      primary_artist_id: "artist_alpha",
      primary_artist_name: "Alpha Artist",
      original_release_date: "2019-01-01",
      preferred_edition_id: "edn_alpha",
      catalog_confidence: "high",
      review_status: "accepted",
      source_album_keys: ["source-alpha-deluxe", "source-alpha-standard"],
    },
    {
      canonical_album_id: "alb_beta",
      title: "Beta Record",
      primary_artist_id: "artist_beta",
      primary_artist_name: "Beta Artist",
      original_release_date: "2021",
      preferred_edition_id: "edn_beta",
      catalog_confidence: "medium",
      review_status: "accepted",
      source_album_keys: ["source-beta"],
    },
  ];

  const editions: SpotifyAlbumEdition[] = [
    {
      edition_id: "edn_alpha",
      canonical_album_id: "alb_alpha",
      spotify_album_id: "sp_alb_alpha",
      title: "Alpha Record",
      primary_artist_id: "artist_alpha",
      primary_artist_name: "Alpha Artist",
      release_date: "2019-01-01",
      album_type: "album",
      edition_type: "standard",
      total_tracks: 10,
      is_preferred: true,
      match_confidence: "high",
      edition_ambiguity: false,
      resolution_score: 0.98,
      title_similarity: 1,
      artist_similarity: 1,
      track_overlap_rate: 1,
      observed_probe_share: 1,
      sources: ["track_probe", "search"],
    },
    {
      edition_id: "edn_alpha_deluxe",
      canonical_album_id: "alb_alpha",
      spotify_album_id: "sp_alb_alpha_deluxe",
      title: "Alpha Record (Deluxe)",
      primary_artist_id: "artist_alpha",
      primary_artist_name: "Alpha Artist",
      release_date: "2020-01-01",
      album_type: "album",
      edition_type: "deluxe",
      total_tracks: 12,
      is_preferred: false,
      match_confidence: "high",
      edition_ambiguity: false,
      resolution_score: 0.9,
      title_similarity: 1,
      artist_similarity: 1,
      track_overlap_rate: 0.8,
      observed_probe_share: 0.5,
      sources: ["track_probe"],
    },
    {
      edition_id: "edn_beta",
      canonical_album_id: "alb_beta",
      spotify_album_id: "sp_alb_beta",
      title: "Beta Record",
      primary_artist_id: "artist_beta",
      primary_artist_name: "Beta Artist",
      release_date: "2021",
      album_type: "album",
      edition_type: "standard",
      total_tracks: 8,
      is_preferred: true,
      match_confidence: "medium",
      edition_ambiguity: false,
      resolution_score: 0.8,
      title_similarity: 1,
      artist_similarity: 1,
      track_overlap_rate: 0.7,
      observed_probe_share: 0.5,
      sources: ["search"],
    },
  ];

  const resolutionReport: AlbumResolutionReport = {
    reportVersion: 1,
    resolutionVersion: 1,
    importBatchId,
    provider: "fixture",
    ok: true,
    totals: {
      provisionalSourceAlbums: 4,
      resolvedSourceAlbums: 3,
      reviewSourceAlbums: 1,
      canonicalAlbums: 2,
      spotifyEditions: 3,
      ambiguousSourceAlbums: 0,
      highConfidenceSourceAlbums: 2,
      mediumConfidenceSourceAlbums: 1,
      noConfidenceSourceAlbums: 1,
      providerErrorAlbums: 0,
    },
    reconciliation: {
      sourceAlbumLinksBalance: true,
      sourceAlbumKeysUnique: true,
      stableCanonicalIdsUnique: true,
      stableEditionIdsUnique: true,
    },
    workbookReference: {
      candidateAlbums: 402,
      acceptedStandardMatches: 349,
      reviewCandidates: 53,
      candidateAlbumDelta: -398,
      resolvedAlbumDelta: -346,
      reviewAlbumDelta: -52,
    },
  };

  const enrichedAlbums: SpotifyAlbumEnrichment[] = [
    {
      canonical_album_id: "alb_alpha",
      edition_id: "edn_alpha",
      spotify_album_id: "sp_alb_alpha",
      name: "Alpha Record",
      album_type: "album",
      release_date: "2019-01-01",
      release_date_precision: "day",
      total_tracks: 10,
      spotify_url: "https://open.spotify.test/album/alpha",
      images: [{ url: "https://image.test/alpha.jpg", width: 640, height: 640 }],
      primary_artwork_url: "https://image.test/alpha.jpg",
      artist_ids: ["artist_alpha"],
      track_ids: ["track_alpha_1", "track_alpha_2"],
      track_listing_complete: false,
      provider: "spotify",
      market: "US",
      enriched_at: "2026-08-27T00:00:00.000Z",
    },
    {
      canonical_album_id: "alb_beta",
      edition_id: "edn_beta",
      spotify_album_id: "sp_alb_beta",
      name: "Beta Record",
      album_type: "album",
      release_date: "2021",
      release_date_precision: "year",
      total_tracks: 8,
      spotify_url: "https://open.spotify.test/album/beta",
      images: [],
      primary_artwork_url: null,
      artist_ids: ["artist_beta"],
      track_ids: ["track_beta_1"],
      track_listing_complete: false,
      provider: "spotify",
      market: "US",
      enriched_at: "2026-08-27T00:00:00.000Z",
    },
  ];

  const enrichedArtists: SpotifyArtistEnrichment[] = [
    {
      spotify_artist_id: "artist_alpha",
      name: "Alpha Artist",
      spotify_url: "https://open.spotify.test/artist/alpha",
      genres: ["alternative rock"],
      genre_status: "unavailable_from_album_response",
      provider: "spotify",
      enriched_at: "2026-08-27T00:00:00.000Z",
    },
    {
      spotify_artist_id: "artist_beta",
      name: "Beta Artist",
      spotify_url: "https://open.spotify.test/artist/beta",
      genres: [],
      genre_status: "unavailable_from_album_response",
      provider: "spotify",
      enriched_at: "2026-08-27T00:00:00.000Z",
    },
  ];

  const enrichedTracks: SpotifyTrackEnrichment[] = [
    {
      spotify_track_id: "track_alpha_1",
      spotify_album_id: "sp_alb_alpha",
      name: "Alpha One",
      disc_number: 1,
      track_number: 1,
      duration_ms: 180000,
      explicit: false,
      spotify_url: "https://open.spotify.test/track/alpha1",
      artist_ids: ["artist_alpha"],
      provider: "spotify",
      enriched_at: "2026-08-27T00:00:00.000Z",
    },
    {
      spotify_track_id: "track_alpha_2",
      spotify_album_id: "sp_alb_alpha",
      name: "Alpha Two",
      disc_number: 1,
      track_number: 2,
      duration_ms: 200000,
      explicit: false,
      spotify_url: "https://open.spotify.test/track/alpha2",
      artist_ids: ["artist_alpha"],
      provider: "spotify",
      enriched_at: "2026-08-27T00:00:00.000Z",
    },
    {
      spotify_track_id: "track_beta_1",
      spotify_album_id: "sp_alb_beta",
      name: "Beta One",
      disc_number: 1,
      track_number: 1,
      duration_ms: 210000,
      explicit: true,
      spotify_url: "https://open.spotify.test/track/beta1",
      artist_ids: ["artist_beta"],
      provider: "spotify",
      enriched_at: "2026-08-27T00:00:00.000Z",
    },
  ];

  const enrichmentReport: SpotifyEnrichmentReport = {
    reportVersion: 1,
    enrichmentVersion: 1,
    provider: "fixture",
    market: "US",
    ok: true,
    totals: {
      acceptedCanonicalAlbums: 2,
      enrichmentTargets: 2,
      enrichedAlbums: 2,
      failedAlbums: 0,
      enrichedArtists: 2,
      enrichedTracks: 3,
      albumsWithArtwork: 1,
      albumsWithSpotifyUrl: 2,
      albumsWithCompleteTrackListing: 0,
      albumsWithoutGenreMetadata: 2,
    },
    reconciliation: {
      targetBalance: true,
      uniqueAlbumIds: true,
      uniqueArtistIds: true,
      uniqueTrackIds: true,
    },
  };

  const alphaVotes = emptyVotes();
  alphaVotes.Rock = 1;
  const betaVotes = emptyVotes();
  const musicTypeClassifications: AlbumMusicTypeClassification[] = [
    {
      canonical_album_id: "alb_alpha",
      spotify_album_id: "sp_alb_alpha",
      detailed_genres: [{
        name: "alternative rock",
        normalized_name: "alternative rock",
        sources: [{
          provider: "spotify",
          spotify_artist_id: "artist_alpha",
          enriched_at: "2026-08-27T00:00:00.000Z",
        }],
      }],
      music_type: "Rock",
      automatic_music_type: "Rock",
      status: "classified",
      classification_source: "mapping_v1",
      taxonomy_version: 1,
      mapping_version: 1,
      votes: alphaVotes,
      matched_genres: [{
        genre: "alternative rock",
        normalized_genre: "alternative rock",
        music_type: "Rock",
        rule_id: "rock.v1",
        matched_phrase: "alternative rock",
        candidate_types: ["Rock"],
      }],
      ambiguous_genres: [],
      unmapped_genres: [],
      manual_override: null,
    },
    {
      canonical_album_id: "alb_beta",
      spotify_album_id: "sp_alb_beta",
      detailed_genres: [],
      music_type: null,
      automatic_music_type: null,
      status: "unclassified_no_genres",
      classification_source: null,
      taxonomy_version: 1,
      mapping_version: 1,
      votes: betaVotes,
      matched_genres: [],
      ambiguous_genres: [],
      unmapped_genres: [],
      manual_override: null,
    },
  ];

  const byMusicType = emptyVotes();
  byMusicType.Rock = 1;
  const taxonomyReport: MusicTypeTaxonomyReport = {
    reportVersion: 1,
    taxonomyVersion: 1,
    mappingVersion: 1,
    ok: true,
    totals: {
      enrichedAlbums: 2,
      classifiedAlbums: 1,
      automaticClassifications: 1,
      manualOverrides: 0,
      unclassifiedNoGenres: 1,
      unclassifiedUnmapped: 0,
      unclassifiedAmbiguous: 0,
      detailedGenres: 1,
      mappedGenres: 1,
      ambiguousGenres: 0,
      unmappedGenres: 0,
      orphanManualOverrides: 0,
    },
    byMusicType,
    reconciliation: {
      albumBalance: true,
      uniqueCanonicalAlbumIds: true,
      uniqueOverrideTargets: true,
      overrideTargetsKnown: true,
    },
  };

  return {
    sessionizationReport,
    sessions,
    canonicalAlbums,
    editions,
    resolutionLinks: [
      {
        source_album_key: "source-alpha-standard",
        source_artist_name: "Alpha Artist",
        source_album_name: "Alpha Record",
        resolution_status: "resolved",
        canonical_album_id: "alb_alpha",
        preferred_edition_id: "edn_alpha",
        proposed_preferred_edition_id: "edn_alpha",
        candidate_edition_ids: ["edn_alpha"],
        match_confidence: "high",
        edition_ambiguity: false,
        review_reasons: [],
      },
      {
        source_album_key: "source-alpha-deluxe",
        source_artist_name: "Alpha Artist",
        source_album_name: "Alpha Record (Deluxe)",
        resolution_status: "resolved",
        canonical_album_id: "alb_alpha",
        preferred_edition_id: "edn_alpha",
        proposed_preferred_edition_id: "edn_alpha",
        candidate_edition_ids: ["edn_alpha", "edn_alpha_deluxe"],
        match_confidence: "high",
        edition_ambiguity: false,
        review_reasons: [],
      },
      {
        source_album_key: "source-beta",
        source_artist_name: "Beta Artist",
        source_album_name: "Beta Record",
        resolution_status: "resolved",
        canonical_album_id: "alb_beta",
        preferred_edition_id: "edn_beta",
        proposed_preferred_edition_id: "edn_beta",
        candidate_edition_ids: ["edn_beta"],
        match_confidence: "medium",
        edition_ambiguity: false,
        review_reasons: [],
      },
      {
        source_album_key: "source-gamma",
        source_artist_name: "Gamma Artist",
        source_album_name: "Gamma Record",
        resolution_status: "review",
        canonical_album_id: null,
        preferred_edition_id: null,
        proposed_preferred_edition_id: null,
        candidate_edition_ids: [],
        match_confidence: "none",
        edition_ambiguity: false,
        review_reasons: ["no_catalog_candidates"],
      },
    ],
    resolutionReport,
    enrichedAlbums,
    enrichedArtists,
    enrichedTracks,
    enrichmentReport,
    musicTypeClassifications,
    genreCatalog: [{
      name: "alternative rock",
      normalized_name: "alternative rock",
      music_type: "Rock",
      rule_id: "rock.v1",
      mapping_status: "mapped",
      spotify_artist_ids: ["artist_alpha"],
      canonical_album_ids: ["alb_alpha"],
    }],
    taxonomyReport,
  };
}

describe("archive reconciliation", () => {
  it("collapses edition-level source sessions into canonical listener summaries and applies D-009 exactly", () => {
    const result = reconcileImportedArchive(fixtureArtifacts());
    expect(result.report.ok).toBe(true);
    expect(result.report.totals.unresolvedSessions).toBe(1);
    expect(result.report.totals.libraryMembers).toBe(1);

    const alpha = result.summaries.find((summary) => summary.canonical_album_id === "alb_alpha")!;
    expect(alpha.archive_member).toBe(true);
    expect(alpha.full_session_count).toBe(2);
    expect(alpha.near_complete_session_count).toBe(1);
    expect(alpha.qualifying_session_count).toBe(3);
    expect(alpha.source_album_count).toBe(2);
    expect(alpha.listening_years).toEqual([2020, 2022, 2024]);
    expect(alpha.distinct_listening_months).toBe(3);
    expect(alpha.evidence_span_days).toBe(1618);
    expect(alpha.revisit_inputs).toEqual({
      repeat_qualifying_sessions: true,
      spans_multiple_months: true,
      spans_multiple_years: true,
      spans_at_least_one_year: true,
    });

    const beta = result.summaries.find((summary) => summary.canonical_album_id === "alb_beta")!;
    expect(beta.archive_member).toBe(false);
    expect(beta.qualifying_session_count).toBe(0);
    expect(beta.sparse_session_count).toBe(1);
    expect(beta.first_meaningful_listen_at).toBeNull();
  });

  it("minimizes runtime history and keeps unresolved source evidence out of D1 payloads", () => {
    const result = reconcileImportedArchive(fixtureArtifacts());
    expect(result.snapshot.sessions).toHaveLength(4);
    expect(result.snapshot.sessions.some((session) => session.session_id === "session-gamma-unresolved")).toBe(false);
    const serialized = JSON.stringify(result.snapshot);
    expect(serialized).not.toContain("event_ids");
    expect(serialized).not.toContain("source_refs");
    expect(serialized).not.toContain("source_album_key");
  });

  it("generates an idempotent D1 import that preserves PersonalAlbumState even if an album leaves the current archive", () => {
    const result = reconcileImportedArchive(fixtureArtifacts());
    const database = new DatabaseSync(":memory:");
    database.exec(readFileSync("migrations/0000_scaffold.sql", "utf8"));
    database.exec(readFileSync("migrations/0001_archive.sql", "utf8"));
    database.exec(result.importSql);
    database.exec("INSERT INTO personal_album_state (canonical_album_id, favorite, revisit, notes) VALUES ('alb_alpha', 1, 1, 'keep this note');");

    database.exec(result.importSql);
    let state = database.prepare("SELECT favorite, revisit, notes FROM personal_album_state WHERE canonical_album_id = 'alb_alpha'").get() as Record<string, unknown>;
    expect(state).toEqual({ favorite: 1, revisit: 1, notes: "keep this note" });

    const withoutAlpha: RuntimeArchiveSnapshot = {
      ...result.snapshot,
      albums: result.snapshot.albums.filter((album) => album.canonical_album_id !== "alb_alpha"),
      editions: result.snapshot.editions.filter((edition) => edition.canonical_album_id !== "alb_alpha"),
      tracks: result.snapshot.tracks.filter((track) => track.canonical_album_id !== "alb_alpha"),
      sessions: result.snapshot.sessions.filter((session) => session.canonical_album_id !== "alb_alpha"),
      summaries: result.snapshot.summaries.filter((summary) => summary.canonical_album_id !== "alb_alpha"),
      album_genres: result.snapshot.album_genres.filter((link) => link.canonical_album_id !== "alb_alpha"),
    };
    database.exec(renderArchiveImportSql(withoutAlpha));
    state = database.prepare("SELECT favorite, revisit, notes FROM personal_album_state WHERE canonical_album_id = 'alb_alpha'").get() as Record<string, unknown>;
    expect(state).toEqual({ favorite: 1, revisit: 1, notes: "keep this note" });
    const album = database.prepare("SELECT is_current FROM albums WHERE canonical_album_id = 'alb_alpha'").get() as Record<string, unknown>;
    expect(album.is_current).toBe(0);
    database.close();
  });

  it("keeps workbook differences explicit without treating them as structural failures", () => {
    const result = reconcileImportedArchive(fixtureArtifacts());
    expect(result.report.workbookReference.defaultLibraryMembers).toBe(337);
    expect(result.report.workbookReference.actualLibraryMembers).toBe(1);
    expect(result.report.workbookReference.libraryMemberDelta).toBe(-336);
    expect(result.report.ok).toBe(true);
    expect(result.report.notes.some((note) => note.includes("-336"))).toBe(true);
  });
});
