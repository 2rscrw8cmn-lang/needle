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
  s.qualifying_session_count,
  s.listening_years_json,
  s.repeat_qualifying_sessions
FROM albums AS a
INNER JOIN listener_album_summaries AS s
  ON s.canonical_album_id = a.canonical_album_id
`;

const LIBRARY_MEMBERSHIP = [
  "a.is_current = 1",
  "a.archive_member = 1",
  "s.archive_member = 1",
] as const;

const SORT_SQL = {
  artist: `
ORDER BY
  a.primary_artist_name COLLATE NOCASE ASC,
  a.title COLLATE NOCASE ASC,
  a.canonical_album_id ASC`,
  album: `
ORDER BY
  a.title COLLATE NOCASE ASC,
  a.primary_artist_name COLLATE NOCASE ASC,
  a.canonical_album_id ASC`,
  release: `
ORDER BY
  CASE WHEN a.original_release_date IS NULL THEN 1 ELSE 0 END ASC,
  CAST(substr(a.original_release_date, 1, 4) AS INTEGER) DESC,
  a.primary_artist_name COLLATE NOCASE ASC,
  a.title COLLATE NOCASE ASC,
  a.canonical_album_id ASC`,
  recent: `
ORDER BY
  CASE WHEN s.last_meaningful_listen_at IS NULL THEN 1 ELSE 0 END ASC,
  s.last_meaningful_listen_at DESC,
  a.primary_artist_name COLLATE NOCASE ASC,
  a.title COLLATE NOCASE ASC,
  a.canonical_album_id ASC`,
  first: `
ORDER BY
  CASE WHEN s.first_meaningful_listen_at IS NULL THEN 1 ELSE 0 END ASC,
  s.first_meaningful_listen_at ASC,
  a.primary_artist_name COLLATE NOCASE ASC,
  a.title COLLATE NOCASE ASC,
  a.canonical_album_id ASC`,
  revisited: `
ORDER BY
  s.qualifying_session_count DESC,
  s.distinct_listening_years DESC,
  s.last_meaningful_listen_at DESC,
  a.primary_artist_name COLLATE NOCASE ASC,
  a.title COLLATE NOCASE ASC,
  a.canonical_album_id ASC`,
} as const;

export const LIBRARY_SORTS = ["artist", "album", "release", "recent", "first", "revisited"] as const;
export type LibrarySort = (typeof LIBRARY_SORTS)[number];

export const LIBRARY_SORT_LABELS: Record<LibrarySort, string> = {
  artist: "Artist A–Z",
  album: "Album A–Z",
  release: "Release year · newest",
  recent: "Recently listened",
  first: "First heard",
  revisited: "Most revisited",
};

export const LIBRARY_COVER_WALL_SQL = `${LIBRARY_SELECT}
WHERE
  ${LIBRARY_MEMBERSHIP.join("\n  AND ")}
${SORT_SQL.artist}
`;

export const LIBRARY_SEARCH_SQL = `${LIBRARY_SELECT}
WHERE
  ${LIBRARY_MEMBERSHIP.join("\n  AND ")}
  AND (
    a.title LIKE ? ESCAPE '\\' COLLATE NOCASE
    OR a.primary_artist_name LIKE ? ESCAPE '\\' COLLATE NOCASE
  )
${SORT_SQL.artist}
`;

export const LIBRARY_COUNT_SQL = `
SELECT COUNT(*) AS album_count
FROM albums AS a
INNER JOIN listener_album_summaries AS s
  ON s.canonical_album_id = a.canonical_album_id
WHERE
  ${LIBRARY_MEMBERSHIP.join("\n  AND ")}
`;

const LIBRARY_FACET_SQL = `
SELECT
  a.original_release_date,
  s.listening_years_json
FROM albums AS a
INNER JOIN listener_album_summaries AS s
  ON s.canonical_album_id = a.canonical_album_id
WHERE
  ${LIBRARY_MEMBERSHIP.join("\n  AND ")}
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
  listening_years_json: string;
  repeat_qualifying_sessions: number;
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
  listeningYears: number[];
  repeated: boolean;
}

export interface LibraryQuery {
  search?: string | null;
  sort?: string | null;
  decade?: string | number | null;
  listeningYear?: string | number | null;
  repeatedOnly?: string | boolean | null;
}

export interface NormalizedLibraryQuery {
  search: string;
  sort: LibrarySort;
  decade: number | null;
  listeningYear: number | null;
  repeatedOnly: boolean;
}

export interface LibraryQueryPlan {
  sql: string;
  bindings: D1BindingValue[];
  query: NormalizedLibraryQuery;
}

export interface LibraryFacets {
  decades: number[];
  listeningYears: number[];
}

export function buildLibraryQuery(query: LibraryQuery = {}): LibraryQueryPlan {
  const normalized = normalizeLibraryQuery(query);
  const clauses: string[] = [...LIBRARY_MEMBERSHIP];
  const bindings: D1BindingValue[] = [];

  if (normalized.search) {
    clauses.push(`(
    a.title LIKE ? ESCAPE '\\' COLLATE NOCASE
    OR a.primary_artist_name LIKE ? ESCAPE '\\' COLLATE NOCASE
  )`);
    const pattern = librarySearchPattern(normalized.search);
    bindings.push(pattern, pattern);
  }

  if (normalized.decade !== null) {
    clauses.push("a.original_release_date IS NOT NULL");
    clauses.push("CAST(substr(a.original_release_date, 1, 4) AS INTEGER) >= ?");
    clauses.push("CAST(substr(a.original_release_date, 1, 4) AS INTEGER) < ?");
    bindings.push(normalized.decade, normalized.decade + 10);
  }

  if (normalized.listeningYear !== null) {
    clauses.push(`EXISTS (
    SELECT 1
    FROM json_each(s.listening_years_json) AS listening_year
    WHERE CAST(listening_year.value AS INTEGER) = ?
  )`);
    bindings.push(normalized.listeningYear);
  }

  if (normalized.repeatedOnly) {
    clauses.push("s.repeat_qualifying_sessions = 1");
  }

  return {
    sql: `${LIBRARY_SELECT}\nWHERE\n  ${clauses.join("\n  AND ")}\n${SORT_SQL[normalized.sort]}\n`,
    bindings,
    query: normalized,
  };
}

export async function loadLibraryAlbums(
  database: LibraryDatabase,
  query: LibraryQuery = {},
): Promise<LibraryAlbum[]> {
  const plan = buildLibraryQuery(query);
  const prepared = database.prepare(plan.sql);
  const statement = plan.bindings.length > 0 ? prepared.bind(...plan.bindings) : prepared;
  const result = await statement.all<LibraryAlbumRow>();
  return result.results.map(mapLibraryAlbumRow);
}

export async function countLibraryAlbums(database: LibraryDatabase): Promise<number> {
  const result = await database.prepare(LIBRARY_COUNT_SQL).all<{ album_count: number }>();
  return result.results[0]?.album_count ?? 0;
}

export async function loadLibraryFacets(database: LibraryDatabase): Promise<LibraryFacets> {
  const result = await database.prepare(LIBRARY_FACET_SQL).all<{
    original_release_date: string | null;
    listening_years_json: string;
  }>();
  const decades = new Set<number>();
  const listeningYears = new Set<number>();

  for (const row of result.results) {
    const releaseYear = parseReleaseYear(row.original_release_date);
    if (releaseYear !== null) decades.add(Math.floor(releaseYear / 10) * 10);
    for (const year of parseListeningYears(row.listening_years_json)) listeningYears.add(year);
  }

  return {
    decades: [...decades].sort((a, b) => b - a),
    listeningYears: [...listeningYears].sort((a, b) => b - a),
  };
}

export function normalizeLibraryQuery(query: LibraryQuery = {}): NormalizedLibraryQuery {
  return {
    search: normalizeLibrarySearch(query.search),
    sort: normalizeLibrarySort(query.sort),
    decade: normalizeLibraryDecade(query.decade),
    listeningYear: normalizeLibraryListeningYear(query.listeningYear),
    repeatedOnly: query.repeatedOnly === true || query.repeatedOnly === "1",
  };
}

export function normalizeLibrarySearch(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

export function normalizeLibrarySort(value: string | null | undefined): LibrarySort {
  return LIBRARY_SORTS.includes(value as LibrarySort) ? (value as LibrarySort) : "artist";
}

export function normalizeLibraryDecade(value: string | number | null | undefined): number | null {
  const parsed = parseInteger(value);
  return parsed !== null && parsed >= 1800 && parsed <= 2100 && parsed % 10 === 0 ? parsed : null;
}

export function normalizeLibraryListeningYear(value: string | number | null | undefined): number | null {
  const parsed = parseInteger(value);
  return parsed !== null && parsed >= 1900 && parsed <= 2100 ? parsed : null;
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
    listeningYears: parseListeningYears(row.listening_years_json),
    repeated: row.repeat_qualifying_sessions === 1,
  };
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

function parseInteger(value: string | number | null | undefined): number | null {
  if (typeof value === "number") return Number.isInteger(value) ? value : null;
  if (typeof value !== "string" || !/^\d{4}$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}
