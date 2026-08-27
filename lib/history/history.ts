export const HISTORY_YEARS_SQL = `
SELECT DISTINCT CAST(years.value AS INTEGER) AS listening_year
FROM albums AS a
INNER JOIN listener_album_summaries AS s
  ON s.canonical_album_id = a.canonical_album_id
INNER JOIN json_each(s.listening_years_json) AS years
WHERE
  a.is_current = 1
  AND a.archive_member = 1
  AND s.archive_member = 1
ORDER BY listening_year DESC
`;

export const HISTORY_YEAR_SQL = `
SELECT
  a.canonical_album_id,
  a.title,
  a.primary_artist_name,
  a.original_release_date,
  a.artwork_url,
  s.first_meaningful_listen_at,
  s.last_meaningful_listen_at,
  s.full_session_count,
  COUNT(session.session_id) AS year_meaningful_session_count,
  SUM(CASE WHEN session.evidence_status = 'full' THEN 1 ELSE 0 END) AS year_full_play_count,
  SUM(CASE WHEN session.evidence_status = 'near_complete' THEN 1 ELSE 0 END) AS year_near_complete_count,
  CASE
    WHEN substr(s.first_meaningful_listen_at, 1, 4) = ? THEN 1
    ELSE 0
  END AS first_heard_in_year
FROM albums AS a
INNER JOIN listener_album_summaries AS s
  ON s.canonical_album_id = a.canonical_album_id
INNER JOIN album_sessions AS session
  ON session.canonical_album_id = a.canonical_album_id
  AND session.evidence_status IN ('full', 'near_complete')
  AND session.started_at >= ?
  AND session.started_at < ?
WHERE
  a.is_current = 1
  AND a.archive_member = 1
  AND s.archive_member = 1
GROUP BY
  a.canonical_album_id,
  a.title,
  a.primary_artist_name,
  a.original_release_date,
  a.artwork_url,
  s.first_meaningful_listen_at,
  s.last_meaningful_listen_at,
  s.full_session_count
ORDER BY
  year_meaningful_session_count DESC,
  year_full_play_count DESC,
  a.primary_artist_name COLLATE NOCASE ASC,
  a.title COLLATE NOCASE ASC,
  a.canonical_album_id ASC
`;

interface D1ResultLike<T> {
  results: T[];
}

type D1BindingValue = string | number | null;

interface D1PreparedStatementLike {
  bind(...values: D1BindingValue[]): D1PreparedStatementLike;
  all<T>(): Promise<D1ResultLike<T>>;
}

export interface HistoryDatabase {
  prepare(sql: string): D1PreparedStatementLike;
}

interface HistoryYearRow {
  listening_year: number;
}

export interface HistoryAlbumRow {
  canonical_album_id: string;
  title: string;
  primary_artist_name: string;
  original_release_date: string | null;
  artwork_url: string | null;
  first_meaningful_listen_at: string | null;
  last_meaningful_listen_at: string | null;
  full_session_count: number;
  year_meaningful_session_count: number;
  year_full_play_count: number;
  year_near_complete_count: number;
  first_heard_in_year: number;
}

export interface HistoryAlbum {
  canonicalAlbumId: string;
  title: string;
  artistName: string;
  originalReleaseDate: string | null;
  releaseYear: number | null;
  artworkUrl: string | null;
  firstMeaningfulListenAt: string | null;
  lastMeaningfulListenAt: string | null;
  lifetimeFullPlayCount: number;
  yearMeaningfulSessionCount: number;
  yearFullPlayCount: number;
  yearNearCompleteCount: number;
  firstHeardInYear: boolean;
}

export interface HistoryYearView {
  year: number;
  albums: HistoryAlbum[];
  totals: {
    albums: number;
    firstHeard: number;
    revisited: number;
    fullPlays: number;
  };
}

export async function loadHistoryYears(database: HistoryDatabase): Promise<number[]> {
  const result = await database.prepare(HISTORY_YEARS_SQL).all<HistoryYearRow>();
  return result.results
    .map((row) => Number(row.listening_year))
    .filter((year) => Number.isInteger(year))
    .sort((a, b) => b - a);
}

export async function loadHistoryYear(database: HistoryDatabase, year: number): Promise<HistoryYearView> {
  if (!Number.isInteger(year)) return emptyHistoryYear(year);

  const start = `${year}-01-01T00:00:00.000Z`;
  const end = `${year + 1}-01-01T00:00:00.000Z`;
  const result = await database
    .prepare(HISTORY_YEAR_SQL)
    .bind(String(year), start, end)
    .all<HistoryAlbumRow>();

  const albums = result.results.map(mapHistoryAlbumRow);
  return {
    year,
    albums,
    totals: {
      albums: albums.length,
      firstHeard: albums.filter((album) => album.firstHeardInYear).length,
      revisited: albums.filter((album) => !album.firstHeardInYear).length,
      fullPlays: albums.reduce((sum, album) => sum + album.yearFullPlayCount, 0),
    },
  };
}

export function resolveHistoryYear(rawYear: string | null | undefined, availableYears: number[]): number | null {
  if (availableYears.length === 0) return null;
  const parsed = normalizeHistoryYear(rawYear);
  return parsed !== null && availableYears.includes(parsed) ? parsed : availableYears[0];
}

export function normalizeHistoryYear(value: string | null | undefined): number | null {
  const normalized = value?.trim() ?? "";
  if (!/^\d{4}$/.test(normalized)) return null;
  const year = Number(normalized);
  return year >= 1900 && year <= 2100 ? year : null;
}

export function mapHistoryAlbumRow(row: HistoryAlbumRow): HistoryAlbum {
  return {
    canonicalAlbumId: row.canonical_album_id,
    title: row.title,
    artistName: row.primary_artist_name,
    originalReleaseDate: row.original_release_date,
    releaseYear: parseReleaseYear(row.original_release_date),
    artworkUrl: row.artwork_url,
    firstMeaningfulListenAt: row.first_meaningful_listen_at,
    lastMeaningfulListenAt: row.last_meaningful_listen_at,
    lifetimeFullPlayCount: Number(row.full_session_count),
    yearMeaningfulSessionCount: Number(row.year_meaningful_session_count),
    yearFullPlayCount: Number(row.year_full_play_count),
    yearNearCompleteCount: Number(row.year_near_complete_count),
    firstHeardInYear: Number(row.first_heard_in_year) === 1,
  };
}

function emptyHistoryYear(year: number): HistoryYearView {
  return {
    year,
    albums: [],
    totals: { albums: 0, firstHeard: 0, revisited: 0, fullPlays: 0 },
  };
}

function parseReleaseYear(value: string | null): number | null {
  if (!value) return null;
  const match = /^(\d{4})/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  return Number.isInteger(year) ? year : null;
}
