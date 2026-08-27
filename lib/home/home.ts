const HOME_BASE_SELECT = `
SELECT
  a.canonical_album_id,
  a.title,
  a.primary_artist_name,
  a.artwork_url,
  s.first_meaningful_listen_at,
  s.last_meaningful_listen_at,
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
  s.last_meaningful_listen_at ASC,
  s.qualifying_session_count DESC,
  a.primary_artist_name COLLATE NOCASE ASC,
  a.title COLLATE NOCASE ASC
LIMIT 16
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
  qualifying_session_count: number;
  distinct_listening_years: number;
}

export interface HomeAlbum {
  canonicalAlbumId: string;
  title: string;
  artistName: string;
  artworkUrl: string | null;
  firstMeaningfulListenAt: string | null;
  lastMeaningfulListenAt: string | null;
  qualifyingSessionCount: number;
  distinctListeningYears: number;
}

export interface HomeView {
  featured: HomeAlbum | null;
  recentlyRevisited: HomeAlbum[];
  worthAnotherListen: HomeAlbum[];
}

export async function loadHome(database: HomeDatabase): Promise<HomeView> {
  const [featuredResult, recentResult, staleResult] = await Promise.all([
    database.prepare(HOME_FEATURED_SQL).all<HomeAlbumRow>(),
    database.prepare(HOME_RECENT_SQL).all<HomeAlbumRow>(),
    database.prepare(HOME_STALE_SQL).all<HomeAlbumRow>(),
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

  return { featured, recentlyRevisited, worthAnotherListen };
}

export function mapHomeAlbumRow(row: HomeAlbumRow): HomeAlbum {
  return {
    canonicalAlbumId: row.canonical_album_id,
    title: row.title,
    artistName: row.primary_artist_name,
    artworkUrl: row.artwork_url,
    firstMeaningfulListenAt: row.first_meaningful_listen_at,
    lastMeaningfulListenAt: row.last_meaningful_listen_at,
    qualifyingSessionCount: Number(row.qualifying_session_count),
    distinctListeningYears: Number(row.distinct_listening_years),
  };
}
