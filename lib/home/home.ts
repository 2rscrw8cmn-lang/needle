const HOME_BASE_SELECT = `
SELECT
  a.canonical_album_id,
  a.title,
  a.primary_artist_name,
  a.artwork_url,
  s.first_meaningful_listen_at,
  s.last_meaningful_listen_at,
  s.full_session_count,
  s.qualifying_session_count,
  s.distinct_listening_years
FROM albums AS a
INNER JOIN listener_album_summaries AS s
  ON s.canonical_album_id = a.canonical_album_id
WHERE
  a.is_current = 1
  AND a.archive_member = 1
  AND s.archive_member = 1
`;

export const HOME_FEATURED_SQL = `${HOME_BASE_SELECT}
ORDER BY
  s.distinct_listening_years DESC,
  s.qualifying_session_count DESC,
  s.last_meaningful_listen_at DESC,
  a.primary_artist_name COLLATE NOCASE ASC,
  a.title COLLATE NOCASE ASC
LIMIT 1
`;

export const HOME_RECENT_SQL = `${HOME_BASE_SELECT}
  AND s.distinct_listening_years >= 2
ORDER BY
  s.last_meaningful_listen_at DESC,
  s.distinct_listening_years DESC,
  s.qualifying_session_count DESC,
  a.primary_artist_name COLLATE NOCASE ASC,
  a.title COLLATE NOCASE ASC
LIMIT 10
`;

export const HOME_STALE_SQL = `${HOME_BASE_SELECT}
ORDER BY
  CASE WHEN s.last_meaningful_listen_at IS NULL THEN 1 ELSE 0 END ASC,
  s.last_meaning_listen_at ASC,
  s.qualifying_session_count DESC,
  a.primary_artist_name COLLATE NOCASE ASC,
  a.title COLLATE NOCASE ASC
LIMIT 16
`.replace("s.last_meaning_listen_at", "s.last_meaningful_listen_at");

export const HOME_SHELF_SQL = `${HOME_BASE_SELECT}
ORDER BY
  CASE WHEN s.first_meaningful_listen_at IS NULL THEN 1 ELSE 0 END ASC,
  s.first_meaningful_listen_at ASC,
  a.primary_artist_name COLLATE NOCASE ASC,
  a.title COLLATE NOCASE ASC
LIMIT 24
`;

export const HOME_ROTATING_SQL = `${HOME_BASE_SELECT}
ORDER BY
  s.full_session_count DESC,
  s.distinct_listening_years DESC,
  s.qualifying_session_count DESC,
  a.primary_artist_name COLLATE NOCASE ASC,
  a.title COLLATE NOCASE ASC
LIMIT 16
`;

export const HOME_ARCHIVE_STATS_SQL = `
SELECT
  COUNT(*) AS archive_count,
  MIN(CAST(substr(s.first_meaningful_listen_at, 1, 4) AS INTEGER)) AS min_year,
  MAX(CAST(substr(s.last_meaningful_listen_at, 1, 4) AS INTEGER)) AS max_year
FROM albums AS a
INNER JOIN listener_album_summaries AS s
  ON s.canonical_album_id = a.canonical_album_id
WHERE
  a.is_current = 1
  AND a.archive_member = 1
  AND s.archive_member = 1
`;

export const HOME_HISTORY_SQL = `
WITH year_album AS (
  SELECT
    CAST(substr(session.started_at, 1, 4) AS INTEGER) AS listening_year,
    a.canonical_album_id,
    MAX(
      CASE
        WHEN substr(s.first_meaningful_listen_at, 1, 4) = substr(session.started_at, 1, 4) THEN 1
        ELSE 0
      END
    ) AS first_heard,
    SUM(CASE WHEN session.evidence_status = 'full' THEN 1 ELSE 0 END) AS full_plays
  FROM albums AS a
  INNER JOIN listener_album_summaries AS s
    ON s.canonical_album_id = a.canonical_album_id
  INNER JOIN album_sessions AS session
    ON session.canonical_album_id = a.canonical_album_id
  WHERE
    a.is_current = 1
    AND a.archive_member = 1
    AND s.archive_member = 1
    AND session.evidence_status IN ('full', 'near_complete')
  GROUP BY listening_year, a.canonical_album_id
)
SELECT
  listening_year,
  COUNT(*) AS album_count,
  SUM(first_heard) AS first_heard_count,
  SUM(CASE WHEN first_heard = 0 THEN 1 ELSE 0 END) AS returning_count,
  SUM(full_plays) AS full_play_count
FROM year_album
GROUP BY listening_year
ORDER BY listening_year ASC
`;

interface D1ResultLike<T> { results: T[]; }
interface D1PreparedStatementLike { all<T>(): Promise<D1ResultLike<T>>; }
export interface HomeDatabase { prepare(sql: string): D1PreparedStatementLike; }

export interface HomeAlbumRow {
  canonical_album_id: string;
  title: string;
  primary_artist_name: string;
  artwork_url: string | null;
  first_meaningful_listen_at: string | null;
  last_meaningful_listen_at: string | null;
  full_session_count: number;
  qualifying_session_count: number;
  distinct_listening_years: number;
}

interface HomeArchiveStatsRow {
  archive_count: number;
  min_year: number | null;
  max_year: number | null;
}

interface HomeHistoryRow {
  listening_year: number;
  album_count: number;
  first_heard_count: number;
  returning_count: number;
  full_play_count: number;
}

export interface HomeAlbum {
  canonicalAlbumId: string;
  title: string;
  artistName: string;
  artworkUrl: string | null;
  firstMeaningfulListenAt: string | null;
  lastMeaningfulListenAt: string | null;
  fullPlayCount: number;
  qualifyingSessionCount: number;
  distinctListeningYears: number;
}

export interface HomeArchiveStats {
  archiveCount: number;
  minYear: number | null;
  maxYear: number | null;
}

export interface HomeHistoryYear {
  year: number;
  albumCount: number;
  firstHeardCount: number;
  returningCount: number;
  fullPlayCount: number;
}

export interface HomeView {
  featured: HomeAlbum | null;
  recentlyRevisited: HomeAlbum[];
  worthAnotherListen: HomeAlbum[];
  shelf: HomeAlbum[];
  rotating: HomeAlbum[];
  archive: HomeArchiveStats;
  history: HomeHistoryYear[];
}

export async function loadHome(database: HomeDatabase): Promise<HomeView> {
  const [featuredResult, recentResult, staleResult, shelfResult, rotatingResult, statsResult, historyResult] = await Promise.all([
    database.prepare(HOME_FEATURED_SQL).all<HomeAlbumRow>(),
    database.prepare(HOME_RECENT_SQL).all<HomeAlbumRow>(),
    database.prepare(HOME_STALE_SQL).all<HomeAlbumRow>(),
    database.prepare(HOME_SHELF_SQL).all<HomeAlbumRow>(),
    database.prepare(HOME_ROTATING_SQL).all<HomeAlbumRow>(),
    database.prepare(HOME_ARCHIVE_STATS_SQL).all<HomeArchiveStatsRow>(),
    database.prepare(HOME_HISTORY_SQL).all<HomeHistoryRow>(),
  ]);

  const featured = featuredResult.results[0] ? mapHomeAlbumRow(featuredResult.results[0]) : null;
  const featuredId = featured?.canonicalAlbumId ?? null;
  const recentlyRevisited = recentResult.results
    .map(mapHomeAlbumRow)
    .filter((album) => album.canonicalAlbumId !== featuredId)
    .slice(0, 6);
  const usedIds = new Set([featuredId, ...recentlyRevisited.map((album) => album.canonicalAlbumId)].filter(Boolean));
  const worthAnotherListen = staleResult.results
    .map(mapHomeAlbumRow)
    .filter((album) => !usedIds.has(album.canonicalAlbumId))
    .slice(0, 6);
  const stats = statsResult.results[0];

  return {
    featured,
    recentlyRevisited,
    worthAnotherListen,
    shelf: shelfResult.results.map(mapHomeAlbumRow),
    rotating: rotatingResult.results.map(mapHomeAlbumRow),
    archive: {
      archiveCount: Number(stats?.archive_count ?? 0),
      minYear: integerOrNull(stats?.min_year),
      maxYear: integerOrNull(stats?.max_year),
    },
    history: historyResult.results
      .map((row) => ({
        year: Number(row.listening_year),
        albumCount: Number(row.album_count),
        firstHeardCount: Number(row.first_heard_count),
        returningCount: Number(row.returning_count),
        fullPlayCount: Number(row.full_play_count),
      }))
      .filter((row) => Number.isInteger(row.year)),
  };
}

export function resolveHomeIssueIndex(date: Date = new Date()): number {
  const utcDay = Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 86_400_000);
  return ((utcDay % 3) + 3) % 3;
}

export function homeIssueNumber(date: Date = new Date()): number {
  const start = Math.floor(Date.UTC(2026, 7, 28) / 86_400_000);
  const current = Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 86_400_000);
  return Math.max(1, current - start + 1);
}

export function mapHomeAlbumRow(row: HomeAlbumRow): HomeAlbum {
  return {
    canonicalAlbumId: row.canonical_album_id,
    title: row.title,
    artistName: row.primary_artist_name,
    artworkUrl: row.artwork_url,
    firstMeaningfulListenAt: row.first_meaningful_listen_at,
    lastMeaningfulListenAt: row.last_meaningful_listen_at,
    fullPlayCount: Number(row.full_session_count),
    qualifyingSessionCount: Number(row.qualifying_session_count),
    distinctListeningYears: Number(row.distinct_listening_years),
  };
}

function integerOrNull(value: number | null | undefined): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}
