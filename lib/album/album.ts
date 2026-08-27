export const ALBUM_SESSION_LIMIT = 100;

export const ALBUM_DETAIL_SQL = `
SELECT
  a.canonical_album_id,
  a.title,
  a.primary_artist_name,
  a.original_release_date,
  a.artwork_url,
  a.spotify_url,
  a.music_type,
  a.catalog_review_status,
  s.first_meaningful_listen_at,
  s.last_meaningful_listen_at,
  s.qualifying_session_count,
  s.full_session_count,
  s.near_complete_session_count,
  s.sparse_session_count,
  s.review_session_count,
  s.total_session_count,
  s.distinct_listening_months,
  s.distinct_listening_years,
  s.listening_years_json,
  s.evidence_span_days
FROM albums AS a
INNER JOIN listener_album_summaries AS s
  ON s.canonical_album_id = a.canonical_album_id
WHERE
  a.canonical_album_id = ?
  AND a.is_current = 1
LIMIT 1
`;

export const ALBUM_SESSION_SQL = `
SELECT
  session_id,
  canonical_album_id,
  started_at,
  ended_at,
  session_minutes,
  evidence_status,
  meaningful_unique_tracks,
  credible_unique_tracks,
  local_coverage,
  missing_local_track_count
FROM album_sessions
WHERE canonical_album_id = ?
ORDER BY started_at DESC, session_id DESC
LIMIT ${ALBUM_SESSION_LIMIT}
`;

interface D1ResultLike<T> {
  results: T[];
}

type D1BindingValue = string | number | null;

interface D1PreparedStatementLike {
  bind(...values: D1BindingValue[]): D1PreparedStatementLike;
  all<T>(): Promise<D1ResultLike<T>>;
}

export interface AlbumDatabase {
  prepare(sql: string): D1PreparedStatementLike;
}

export interface AlbumDetailRow {
  canonical_album_id: string;
  title: string;
  primary_artist_name: string;
  original_release_date: string | null;
  artwork_url: string | null;
  spotify_url: string | null;
  music_type: string | null;
  catalog_review_status: "accepted" | "review";
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
  listening_years_json: string;
  evidence_span_days: number | null;
}

export type AlbumEvidenceStatus = "full" | "near_complete" | "sparse" | "review";

export interface AlbumSessionRow {
  session_id: string;
  canonical_album_id: string;
  started_at: string;
  ended_at: string;
  session_minutes: number;
  evidence_status: AlbumEvidenceStatus;
  meaningful_unique_tracks: number;
  credible_unique_tracks: number;
  local_coverage: number;
  missing_local_track_count: number;
}

export interface AlbumSessionEvidence {
  sessionId: string;
  startedAt: string;
  endedAt: string;
  sessionMinutes: number;
  evidenceStatus: AlbumEvidenceStatus;
  evidenceLabel: string;
  meaningfulUniqueTracks: number;
  credibleUniqueTracks: number;
}

export interface AlbumDetail {
  canonicalAlbumId: string;
  title: string;
  artistName: string;
  originalReleaseDate: string | null;
  releaseYear: number | null;
  artworkUrl: string | null;
  spotifyUrl: string | null;
  musicType: string | null;
  catalogReviewStatus: "accepted" | "review";
  firstMeaningfulListenAt: string | null;
  lastMeaningfulListenAt: string | null;
  qualifyingSessionCount: number;
  fullSessionCount: number;
  nearCompleteSessionCount: number;
  sparseSessionCount: number;
  reviewSessionCount: number;
  totalSessionCount: number;
  distinctListeningMonths: number;
  distinctListeningYears: number;
  listeningYears: number[];
  evidenceSpanDays: number | null;
  sessions: AlbumSessionEvidence[];
  sessionLimit: number;
}

export async function loadAlbumDetail(
  database: AlbumDatabase,
  rawAlbumId: string | null | undefined,
): Promise<AlbumDetail | null> {
  const albumId = normalizeAlbumId(rawAlbumId);
  if (!albumId) return null;

  const detailResult = await database
    .prepare(ALBUM_DETAIL_SQL)
    .bind(albumId)
    .all<AlbumDetailRow>();
  const row = detailResult.results[0];
  if (!row) return null;

  const sessionResult = await database
    .prepare(ALBUM_SESSION_SQL)
    .bind(albumId)
    .all<AlbumSessionRow>();

  return mapAlbumDetailRow(row, sessionResult.results);
}

export function normalizeAlbumId(value: string | null | undefined): string {
  const normalized = value?.trim() ?? "";
  return normalized.length <= 200 ? normalized : "";
}

export function mapAlbumDetailRow(row: AlbumDetailRow, sessions: AlbumSessionRow[]): AlbumDetail {
  return {
    canonicalAlbumId: row.canonical_album_id,
    title: row.title,
    artistName: row.primary_artist_name,
    originalReleaseDate: row.original_release_date,
    releaseYear: parseReleaseYear(row.original_release_date),
    artworkUrl: row.artwork_url,
    spotifyUrl: row.spotify_url,
    musicType: row.music_type,
    catalogReviewStatus: row.catalog_review_status,
    firstMeaningfulListenAt: row.first_meaningful_listen_at,
    lastMeaningfulListenAt: row.last_meaningful_listen_at,
    qualifyingSessionCount: row.qualifying_session_count,
    fullSessionCount: row.full_session_count,
    nearCompleteSessionCount: row.near_complete_session_count,
    sparseSessionCount: row.sparse_session_count,
    reviewSessionCount: row.review_session_count,
    totalSessionCount: row.total_session_count,
    distinctListeningMonths: row.distinct_listening_months,
    distinctListeningYears: row.distinct_listening_years,
    listeningYears: parseListeningYears(row.listening_years_json),
    evidenceSpanDays: row.evidence_span_days,
    sessions: sessions.map(mapAlbumSessionRow),
    sessionLimit: ALBUM_SESSION_LIMIT,
  };
}

export function mapAlbumSessionRow(row: AlbumSessionRow): AlbumSessionEvidence {
  return {
    sessionId: row.session_id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    sessionMinutes: row.session_minutes,
    evidenceStatus: row.evidence_status,
    evidenceLabel: albumEvidenceLabel(row.evidence_status),
    meaningfulUniqueTracks: row.meaningful_unique_tracks,
    credibleUniqueTracks: row.credible_unique_tracks,
  };
}

export function albumEvidenceLabel(status: AlbumEvidenceStatus): string {
  switch (status) {
    case "full":
      return "Front-to-back listen";
    case "near_complete":
      return "Nearly complete listen";
    case "sparse":
      return "Brief appearance";
    case "review":
      return "Listening evidence";
  }
}

function parseReleaseYear(value: string | null): number | null {
  if (!value) return null;
  const match = /^(\d{4})/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  return Number.isInteger(year) ? year : null;
}

function parseListeningYears(value: string): number[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((year): year is number => Number.isInteger(year))
      .sort((a, b) => a - b);
  } catch {
    return [];
  }
}
