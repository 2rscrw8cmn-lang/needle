export const EXPLORE_DECADES_SQL = `
SELECT
  CAST(substr(a.original_release_date, 1, 3) || '0' AS INTEGER) AS decade,
  COUNT(*) AS album_count
FROM albums AS a
INNER JOIN listener_album_summaries AS s
  ON s.canonical_album_id = a.canonical_album_id
WHERE
  a.is_current = 1
  AND a.archive_member = 1
  AND s.archive_member = 1
  AND substr(a.original_release_date, 1, 4) GLOB '[0-9][0-9][0-9][0-9]'
GROUP BY decade
ORDER BY decade DESC
`;

export const EXPLORE_ARTISTS_SQL = `
SELECT
  a.primary_artist_id,
  a.primary_artist_name,
  COUNT(*) AS album_count
FROM albums AS a
INNER JOIN listener_album_summaries AS s
  ON s.canonical_album_id = a.canonical_album_id
WHERE
  a.is_current = 1
  AND a.archive_member = 1
  AND s.archive_member = 1
GROUP BY a.primary_artist_id, a.primary_artist_name
ORDER BY album_count DESC, a.primary_artist_name COLLATE NOCASE ASC
LIMIT 24
`;

export const EXPLORE_CROSS_TIME_SQL = `
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
  AND s.distinct_listening_years >= 2
ORDER BY
  s.distinct_listening_years DESC,
  s.qualifying_session_count DESC,
  s.last_meaningful_listen_at DESC,
  a.primary_artist_name COLLATE NOCASE ASC,
  a.title COLLATE NOCASE ASC
LIMIT 12
`;

interface D1ResultLike<T> { results: T[]; }
interface D1PreparedStatementLike { all<T>(): Promise<D1ResultLike<T>>; }
export interface ExploreDatabase { prepare(sql: string): D1PreparedStatementLike; }

interface DecadeRow { decade: number; album_count: number; }
interface ArtistRow { primary_artist_id: string; primary_artist_name: string; album_count: number; }
interface CrossTimeRow {
  canonical_album_id: string;
  title: string;
  primary_artist_name: string;
  artwork_url: string | null;
  first_meaningful_listen_at: string | null;
  last_meaningful_listen_at: string | null;
  qualifying_session_count: number;
  distinct_listening_years: number;
}

export interface ExploreDecade { decade: number; albumCount: number; }
export interface ExploreArtist { artistId: string; name: string; albumCount: number; }
export interface ExploreCrossTimeAlbum {
  canonicalAlbumId: string;
  title: string;
  artistName: string;
  artworkUrl: string | null;
  firstMeaningfulListenAt: string | null;
  lastMeaningfulListenAt: string | null;
  qualifyingSessionCount: number;
  distinctListeningYears: number;
}

export interface ExploreView {
  decades: ExploreDecade[];
  artists: ExploreArtist[];
  crossTimeAlbums: ExploreCrossTimeAlbum[];
}

export async function loadExplore(database: ExploreDatabase): Promise<ExploreView> {
  const [decadesResult, artistsResult, crossTimeResult] = await Promise.all([
    database.prepare(EXPLORE_DECADES_SQL).all<DecadeRow>(),
    database.prepare(EXPLORE_ARTISTS_SQL).all<ArtistRow>(),
    database.prepare(EXPLORE_CROSS_TIME_SQL).all<CrossTimeRow>(),
  ]);

  return {
    decades: decadesResult.results.map((row) => ({
      decade: Number(row.decade),
      albumCount: Number(row.album_count),
    })),
    artists: artistsResult.results.map((row) => ({
      artistId: row.primary_artist_id,
      name: row.primary_artist_name,
      albumCount: Number(row.album_count),
    })),
    crossTimeAlbums: crossTimeResult.results.map((row) => ({
      canonicalAlbumId: row.canonical_album_id,
      title: row.title,
      artistName: row.primary_artist_name,
      artworkUrl: row.artwork_url,
      firstMeaningfulListenAt: row.first_meaningful_listen_at,
      lastMeaningfulListenAt: row.last_meaningful_listen_at,
      qualifyingSessionCount: Number(row.qualifying_session_count),
      distinctListeningYears: Number(row.distinct_listening_years),
    })),
  };
}
