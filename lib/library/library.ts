const LIBRARY_SELECT = `
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
`;

const LIBRARY_MEMBERSHIP_WHERE = `
WHERE
  a.is_current = 1
  AND a.archive_member = 1
  AND s.archive_member = 1
`;

const LIBRARY_ORDER = `
ORDER BY
  a.primary_artist_name COLLATE NOCASE ASC,
  a.title COLLATE NOCASE ASC,
  a.canonical_album_id ASC
`;

export const LIBRARY_COVER_WALL_SQL = `${LIBRARY_SELECT}${LIBRARY_MEMBERSHIP_WHERE}${LIBRARY_ORDER}`;

export const LIBRARY_SEARCH_SQL = `${LIBRARY_SELECT}${LIBRARY_MEMBERSHIP_WHERE}
  AND (
    a.title LIKE ? ESCAPE '\\' COLLATE NOCASE
    OR a.primary_artist_name LIKE ? ESCAPE '\\' COLLATE NOCASE
  )
${LIBRARY_ORDER}`;

export const LIBRARY_COUNT_SQL = `
SELECT COUNT(*) AS album_count
FROM albums AS a
INNER JOIN listener_album_summaries AS s
  ON s.canonical_album_id = a.canonical_album_id
${LIBRARY_MEMBERSHIP_WHERE}
`;

interface D1ResultLike<T> {
  results: T[];
}

type D1BindingValue = string | number | null;

interface D1PreparedStatementLike {
  bind(...values: D1BindingValue[]): D1PreparedStatementLike;
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

export interface LibraryQuery {
  search?: string | null;
}

export async function loadLibraryAlbums(
  database: LibraryDatabase,
  query: LibraryQuery = {},
): Promise<LibraryAlbum[]> {
  const search = normalizeLibrarySearch(query.search);
  const statement = search
    ? database.prepare(LIBRARY_SEARCH_SQL).bind(librarySearchPattern(search), librarySearchPattern(search))
    : database.prepare(LIBRARY_COVER_WALL_SQL);
  const result = await statement.all<LibraryAlbumRow>();
  return result.results.map(mapLibraryAlbumRow);
}

export async function countLibraryAlbums(database: LibraryDatabase): Promise<number> {
  const result = await database.prepare(LIBRARY_COUNT_SQL).all<{ album_count: number }>();
  return result.results[0]?.album_count ?? 0;
}

export function normalizeLibrarySearch(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

export function librarySearchPattern(value: string): string {
  const escaped = value
    .replaceAll("\\", "\\\\")
    .replaceAll("%", "\\%")
    .replaceAll("_", "\\_");
  return `%${escaped}%`;
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
