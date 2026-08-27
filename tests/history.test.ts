import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";

import {
  HISTORY_YEAR_SQL,
  HISTORY_YEARS_SQL,
  mapHistoryAlbumRow,
  normalizeHistoryYear,
  resolveHistoryYear,
  type HistoryAlbumRow,
} from "../lib/history/history";

function createDatabase() {
  const database = new DatabaseSync(":memory:");
  database.exec(readFileSync("migrations/0000_scaffold.sql", "utf8"));
  database.exec(readFileSync("migrations/0001_archive.sql", "utf8"));

  database.exec(`
    INSERT INTO artists (spotify_artist_id, name, spotify_url, is_current, import_batch_id) VALUES
      ('artist_a', 'Alpha Artist', NULL, 1, 'fixture'),
      ('artist_b', 'Beta Artist', NULL, 1, 'fixture'),
      ('artist_old', 'Old Artist', NULL, 0, 'fixture');

    INSERT INTO albums (
      canonical_album_id, title, primary_artist_id, primary_artist_name,
      original_release_date, preferred_edition_id, catalog_confidence,
      catalog_review_status, artwork_url, spotify_url, music_type,
      music_type_status, taxonomy_version, mapping_version,
      archive_member, is_current, import_batch_id
    ) VALUES
      ('alb_a', 'Alpha Record', 'artist_a', 'Alpha Artist', '1999-02-03', NULL, 'high', 'accepted', 'https://i.scdn.co/image/alpha', NULL, NULL, NULL, NULL, NULL, 1, 1, 'fixture'),
      ('alb_b', 'Beta Record', 'artist_b', 'Beta Artist', '2012', NULL, 'high', 'accepted', NULL, NULL, NULL, NULL, NULL, NULL, 1, 1, 'fixture'),
      ('alb_old', 'Old Record', 'artist_old', 'Old Artist', '1980', NULL, 'high', 'accepted', NULL, NULL, NULL, NULL, NULL, NULL, 1, 0, 'fixture');

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
      ('alb_a', 1, 'full_or_near_complete_v1', '2020-03-01T00:00:00.000Z', '2024-06-01T00:00:00.000Z', 3, 2, 1, 0, 0, 3, 3, 2, '["2020-03","2024-01","2024-06"]', '[2020,2024]', 1553, 1, 1, 1, 1, 1, 'fixture'),
      ('alb_b', 1, 'full_or_near_complete_v1', '2024-02-01T00:00:00.000Z', '2024-02-01T00:00:00.000Z', 1, 1, 0, 0, 0, 1, 1, 1, '["2024-02"]', '[2024]', 0, 1, 0, 0, 0, 0, 'fixture'),
      ('alb_old', 1, 'full_or_near_complete_v1', '2015-01-01T00:00:00.000Z', '2015-01-01T00:00:00.000Z', 1, 1, 0, 0, 0, 1, 1, 1, '["2015-01"]', '[2015]', 0, 1, 0, 0, 0, 0, 'fixture');

    INSERT INTO album_sessions (
      session_id, canonical_album_id, started_at, ended_at, session_minutes,
      evidence_status, meaningful_unique_tracks, credible_unique_tracks,
      local_coverage, missing_local_track_count, import_batch_id
    ) VALUES
      ('a_2020', 'alb_a', '2020-03-01T00:00:00.000Z', '2020-03-01T00:40:00.000Z', 40, 'full', 10, 10, 1, 0, 'fixture'),
      ('a_2024_1', 'alb_a', '2024-01-01T00:00:00.000Z', '2024-01-01T00:35:00.000Z', 35, 'near_complete', 9, 9, 0.9, 1, 'fixture'),
      ('a_2024_2', 'alb_a', '2024-06-01T00:00:00.000Z', '2024-06-01T00:42:00.000Z', 42, 'full', 10, 10, 1, 0, 'fixture'),
      ('a_sparse', 'alb_a', '2024-07-01T00:00:00.000Z', '2024-07-01T00:03:00.000Z', 3, 'sparse', 1, 1, 0.1, 9, 'fixture'),
      ('b_2024', 'alb_b', '2024-02-01T00:00:00.000Z', '2024-02-01T00:39:00.000Z', 39, 'full', 11, 11, 1, 0, 'fixture'),
      ('old_2015', 'alb_old', '2015-01-01T00:00:00.000Z', '2015-01-01T00:40:00.000Z', 40, 'full', 10, 10, 1, 0, 'fixture');
  `);

  return database;
}

describe("History", () => {
  it("derives available years only from current archive members", () => {
    const database = createDatabase();
    const rows = database.prepare(HISTORY_YEARS_SQL).all() as unknown as Array<{ listening_year: number }>;

    expect(rows.map((row) => Number(row.listening_year))).toEqual([2024, 2020]);
    database.close();
  });

  it("returns qualifying year evidence and excludes sparse sessions", () => {
    const database = createDatabase();
    const rows = database
      .prepare(HISTORY_YEAR_SQL)
      .all("2024", "2024-01-01T00:00:00.000Z", "2025-01-01T00:00:00.000Z") as unknown as HistoryAlbumRow[];

    expect(rows.map((row) => row.canonical_album_id)).toEqual(["alb_a", "alb_b"]);
    expect(Number(rows[0].year_qualifying_session_count)).toBe(2);
    expect(Number(rows[1].year_qualifying_session_count)).toBe(1);
    expect(Number(rows[0].first_heard_in_year)).toBe(0);
    expect(Number(rows[1].first_heard_in_year)).toBe(1);
    database.close();
  });

  it("maps year rows into product-facing history", () => {
    const album = mapHistoryAlbumRow({
      canonical_album_id: "alb_a",
      title: "Alpha Record",
      primary_artist_name: "Alpha Artist",
      original_release_date: "1999-02-03",
      artwork_url: null,
      first_meaningful_listen_at: "2020-03-01T00:00:00.000Z",
      last_meaningful_listen_at: "2024-06-01T00:00:00.000Z",
      qualifying_session_count: 3,
      year_qualifying_session_count: 2,
      first_heard_in_year: 0,
    });

    expect(album).toMatchObject({
      canonicalAlbumId: "alb_a",
      releaseYear: 1999,
      lifetimeQualifyingSessionCount: 3,
      yearQualifyingSessionCount: 2,
      firstHeardInYear: false,
    });
  });

  it("normalizes and resolves URL years conservatively", () => {
    expect(normalizeHistoryYear("2024")).toBe(2024);
    expect(normalizeHistoryYear("24")).toBeNull();
    expect(normalizeHistoryYear("2201")).toBeNull();
    expect(resolveHistoryYear("2020", [2024, 2020])).toBe(2020);
    expect(resolveHistoryYear("2019", [2024, 2020])).toBe(2024);
    expect(resolveHistoryYear(undefined, [2024, 2020])).toBe(2024);
    expect(resolveHistoryYear("2024", [])).toBeNull();
  });
});
