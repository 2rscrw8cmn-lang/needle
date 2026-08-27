export const LIBRARY_COVER_WALL_SQL = `
SELECT
  a.canonical_album_id,
  a.title,
  a.primary_artist_name,
  a.original_release_date,
  a.artwork_url,
  a.music_type,
  s.first_meaningful_listen_at,
  s.last_meaningful_listen_at,
  s.qualifying_session_count
FROM albums AS a
INNER JOIN listener_album_summaries AS s
  ON s.canonical_album_id = a.canonical_album_id
WHERE
  a.is_current = 1
  AND a.archive_member = 1
  AND s.archive_member = 1
ORDER BY
  a.primary_artist_name COLLATE NOCASE ASC,
  a.title COLLATE NOCASE ASC,
  a.canonical_album_id ASC
`;

interface D1ResultLike<T> {
  results: T[];
}

interface D1PreparedStatementLike {
  all<T>(): Promise<D1ResultLike<T>>;
}

export interface LibraryDatabase {
  prepare(sql: string): D1PreparedStatementLike;
}

export interface LibraryAlbumRow {
  canonical_album_id: string;
  title: string;
  primary_artist_name: string;
  original_release_date: string | null;
  artwork_url: string | null;
  music_type: string | null;
  first_meaningful_listen_at: string | null;
  last_meaningful_listen_at: string | null;
  qualifying_session_count: number;
}

export interface LibraryAlbum {
  canonicalAlbumId: string;
  title: string;
  artistName: string;
  originalReleaseDate: string | null;
  releaseYear: number | null;
  artworkUrl: string | null;
  musicType: string | null;
  firstMeaningfulListenAt: string | null;
  lastMeaningfulListenAt: string | null;
  qualifyingSessionCount: number;
}

export async function loadLibraryAlbums(database: LibraryDatabase): Promise<LibraryAlbum[]> {
  const result = await database.prepare(LIBRARY_COVER_WALL_SQL).all<LibraryAlbumRow>();
  return result.results.map(mapLibraryAlbumRow);
}

export function mapLibraryAlbumRow(row: LibraryAlbumRow): LibraryAlbum {
  return {
    canonicalAlbumId: row.canonical_album_id,
    title: row.title,
    artistName: row.primary_artist_name,
    originalReleaseDate: row.original_release_date,
    releaseYear: parseReleaseYear(row.original_release_date),
    artworkUrl: row.artwork_url,
    musicType: row.music_type,
    firstMeaningfulListenAt: row.first_meaningful_listen_at,
    lastMeaningfulListenAt: row.last_meaningful_listen_at,
    qualifyingSessionCount: row.qualifying_session_count,
  };
}

function parseReleaseYear(value: string | null): number | null {
  if (!value) return null;
  const match = /^(\d{4})/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  return Number.isInteger(year) ? year : null;
}
