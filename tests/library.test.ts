import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";

import {
  LIBRARY_COUNT_SQL,
  LIBRARY_COVER_WALL_SQL,
  LIBRARY_SEARCH_SQL,
  buildLibraryQuery,
  librarySearchPattern,
  mapLibraryAlbumRow,
  normalizeLibraryDecade,
  normalizeLibraryListeningYear,
  normalizeLibraryQuery,
  normalizeLibrarySearch,
  normalizeLibrarySort,
  type LibraryAlbumRow,
  type LibraryQuery,
} from "../lib/library/library";

function createDatabase() {
  const database = new DatabaseSync(":memory:");
  database.exec(readFileSync("migrations/0000_scaffold.sql", "utf8"));
  database.exec(readFileSync("migrations/0001_archive.sql", "utf8"));

  database.exec(`
    INSERT INTO artists (spotify_artist_id, name, spotify_url, is_current, import_batch_id) VALUES
      ('artist_a', 'Alpha Artist', NULL, 1, 'fixture'),
      ('artist_b', 'Beta Artist', NULL, 1, 'fixture'),
      ('artist_c', 'Sparse Artist', NULL, 1, 'fixture'),
      ('artist_d', 'Old Artist', NULL, 0, 'fixture');

    INSERT INTO albums (
      canonical_album_id, title, primary_artist_id, primary_artist_name,
      original_release_date, preferred_edition_id, catalog_confidence,
      catalog_review_status, artwork_url, spotify_url, music_type,
      music_type_status, taxonomy_version, mapping_version,
      archive_member, is_current, import_batch_id
    ) VALUES
      ('alb_b', 'Beta Record', 'artist_b', 'Beta Artist', '2004', NULL, 'high', 'accepted', NULL, NULL, 'Pop', 'classified', 1, 1, 1, 1, 'fixture'),
      ('alb_a', 'Alpha Record', 'artist_a', 'Alpha Artist', '1999-02-03', NULL, 'high', 'accepted', 'https://i.scdn.co/image/alpha', NULL, 'Rock', 'classified', 1, 1, 1, 1, 'fixture'),
      ('alb_sparse', 'Sparse Record', 'artist_c', 'Sparse Artist', '2010', NULL, 'medium', 'accepted', NULL, NULL, NULL, 'unclassified_no_genres', 1, 1, 0, 1, 'fixture'),
      ('alb_old', 'Old Record', 'artist_d', 'Old Artist', '1980', NULL, 'high', 'accepted', NULL, NULL, 'Rock', 'classified', 1, 1, 1, 0, 'fixture');

    INSERT INTO listener_album_summaries (
      canonical_album_id, archive_member, archive_rule,
      first_meaningful_listen_at, last_meaningful_listen_at,
      qualifying_session_count, full_session_count, near_complete_session_count,
      sparse_session_count, review_session_count, total_session_count,
      distinct_listening_months, distinct_listening_years,
      listening_months_json, listening_years_json, evidence_span_days,
      source_album_count, repeat_qualifying_sessions, spans_multiple_months,
      spans_multiple_years, spans_at_least_one_year, import_batch_id
    ) VALUES
      ('alb_a', 1, 'full_or_near_complete_v1', '2020-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z', 3, 2, 1, 0, 0, 3, 3, 3, '["2020-01","2022-01","2024-01"]', '[2020,2022,2024]', 1461, 1, 1, 1, 1, 1, 'fixture'),
      ('alb_b', 1, 'full_or_near_complete_v1', '2021-01-01T00:00:00.000Z', '2021-01-01T00:00:00.000Z', 1, 1, 0, 0, 0, 1, 1, 1, '["2021-01"]', '[2021]', 0, 1, 0, 0, 0, 0, 'fixture'),
      ('alb_sparse', 0, 'full_or_near_complete_v1', NULL, NULL, 0, 0, 0, 1, 0, 1, 0, 0, '[]', '[]', NULL, 1, 0, 0, 0, 0, 'fixture'),
      ('alb_old', 1, 'full_or_near_complete_v1', '2015-01-01T00:00:00.000Z', '2015-01-01T00:00:00.000Z', 1, 1, 0, 0, 0, 1, 1, 1, '["2015-01"]', '[2015]', 0, 1, 0, 0, 0, 0, 'fixture');
  `);

  return database;
}

function runLibraryQuery(database: DatabaseSync, query: LibraryQuery): LibraryAlbumRow[] {
  const plan = buildLibraryQuery(query);
  const statement = database.prepare(plan.sql);
  return (plan.bindings.length > 0
    ? statement.all(...plan.bindings)
    : statement.all()) as unknown as LibraryAlbumRow[];
}

describe("Library cover wall query", () => {
  it("returns only current D-009 archive members in deterministic artist/title order", () => {
    const database = createDatabase();
    const rows = database.prepare(LIBRARY_COVER_WALL_SQL).all() as unknown as LibraryAlbumRow[];

    expect(rows.map((row) => row.canonical_album_id)).toEqual(["alb_a", "alb_b"]);
    expect(rows.every((row) => row.qualifying_session_count > 0)).toBe(true);

    database.close();
  });

  it("counts only current D-009 archive members", () => {
    const database = createDatabase();
    const row = database.prepare(LIBRARY_COUNT_SQL).get() as { album_count: number };

    expect(row.album_count).toBe(2);
    database.close();
  });

  it("searches album title and artist case-insensitively while preserving membership", () => {
    const database = createDatabase();

    const byAlbum = database
      .prepare(LIBRARY_SEARCH_SQL)
      .all(librarySearchPattern("ALPHA"), librarySearchPattern("ALPHA")) as unknown as LibraryAlbumRow[];
    expect(byAlbum.map((row) => row.canonical_album_id)).toEqual(["alb_a"]);

    const byArtist = database
      .prepare(LIBRARY_SEARCH_SQL)
      .all(librarySearchPattern("beta artist"), librarySearchPattern("beta artist")) as unknown as LibraryAlbumRow[];
    expect(byArtist.map((row) => row.canonical_album_id)).toEqual(["alb_b"]);

    const hiddenSparse = database
      .prepare(LIBRARY_SEARCH_SQL)
      .all(librarySearchPattern("Sparse"), librarySearchPattern("Sparse")) as unknown as LibraryAlbumRow[];
    expect(hiddenSparse).toEqual([]);

    database.close();
  });

  it("composes search, decade, listening-year, and repeat filters without widening membership", () => {
    const database = createDatabase();

    expect(runLibraryQuery(database, { decade: 1990 }).map((row) => row.canonical_album_id)).toEqual(["alb_a"]);
    expect(runLibraryQuery(database, { listeningYear: 2021 }).map((row) => row.canonical_album_id)).toEqual(["alb_b"]);
    expect(runLibraryQuery(database, { repeatedOnly: true }).map((row) => row.canonical_album_id)).toEqual(["alb_a"]);
    expect(runLibraryQuery(database, { search: "record", decade: 1990, listeningYear: 2024, repeatedOnly: true })
      .map((row) => row.canonical_album_id)).toEqual(["alb_a"]);
    expect(runLibraryQuery(database, { search: "Sparse", repeatedOnly: true })).toEqual([]);

    database.close();
  });

  it("supports only whitelisted deterministic sort orders", () => {
    const database = createDatabase();

    expect(runLibraryQuery(database, { sort: "release" }).map((row) => row.canonical_album_id)).toEqual(["alb_b", "alb_a"]);
    expect(runLibraryQuery(database, { sort: "recent" }).map((row) => row.canonical_album_id)).toEqual(["alb_a", "alb_b"]);
    expect(runLibraryQuery(database, { sort: "first" }).map((row) => row.canonical_album_id)).toEqual(["alb_a", "alb_b"]);
    expect(runLibraryQuery(database, { sort: "revisited" }).map((row) => row.canonical_album_id)).toEqual(["alb_a", "alb_b"]);
    expect(normalizeLibrarySort("DROP TABLE albums")).toBe("artist");

    database.close();
  });

  it("normalizes URL-state values conservatively", () => {
    expect(normalizeLibrarySearch("  100%_\\mix  ")).toBe("100%_\\mix");
    expect(librarySearchPattern("100%_\\mix")).toBe("%100\\%\\_\\\\mix%");
    expect(normalizeLibraryDecade("1990")).toBe(1990);
    expect(normalizeLibraryDecade("1995")).toBeNull();
    expect(normalizeLibraryListeningYear("2024")).toBe(2024);
    expect(normalizeLibraryListeningYear("twenty24")).toBeNull();
    expect(normalizeLibraryQuery({ repeatedOnly: "1", sort: "recent", decade: "2000", listeningYear: "2021" }))
      .toMatchObject({ repeatedOnly: true, sort: "recent", decade: 2000, listeningYear: 2021 });
  });

  it("maps runtime rows into the UI contract without leaking database field names", () => {
    const mapped = mapLibraryAlbumRow({
      canonical_album_id: "alb_a",
      title: "Alpha Record",
      primary_artist_name: "Alpha Artist",
      original_release_date: "1999-02-03",
      artwork_url: "https://i.scdn.co/image/alpha",
      music_type: "Rock",
      first_meaningful_listen_at: "2020-01-01T00:00:00.000Z",
      last_meaningful_listen_at: "2024-01-01T00:00:00.000Z",
      qualifying_session_count: 3,
      listening_years_json: "[2020,2022,2024]",
      repeat_qualifying_sessions: 1,
    });

    expect(mapped).toEqual({
      canonicalAlbumId: "alb_a",
      title: "Alpha Record",
      artistName: "Alpha Artist",
      originalReleaseDate: "1999-02-03",
      releaseYear: 1999,
      artworkUrl: "https://i.scdn.co/image/alpha",
      musicType: "Rock",
      firstMeaningfulListenAt: "2020-01-01T00:00:00.000Z",
      lastMeaningfulListenAt: "2024-01-01T00:00:00.000Z",
      qualifyingSessionCount: 3,
      listeningYears: [2020, 2022, 2024],
      repeated: true,
    });
  });
});
