import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";

import {
  ALBUM_DETAIL_SQL,
  ALBUM_SESSION_LIMIT,
  ALBUM_SESSION_SQL,
  albumEvidenceLabel,
  mapAlbumDetailRow,
  normalizeAlbumId,
  type AlbumDetailRow,
  type AlbumSessionRow,
} from "../lib/album/album";

function createDatabase() {
  const database = new DatabaseSync(":memory:");
  database.exec(readFileSync("migrations/0000_scaffold.sql", "utf8"));
  database.exec(readFileSync("migrations/0001_archive.sql", "utf8"));

  database.exec(`
    INSERT INTO artists (spotify_artist_id, name, spotify_url, is_current, import_batch_id) VALUES
      ('artist_a', 'Alpha Artist', NULL, 1, 'fixture'),
      ('artist_old', 'Old Artist', NULL, 0, 'fixture');

    INSERT INTO albums (
      canonical_album_id, title, primary_artist_id, primary_artist_name,
      original_release_date, preferred_edition_id, catalog_confidence,
      catalog_review_status, artwork_url, spotify_url, music_type,
      music_type_status, taxonomy_version, mapping_version,
      archive_member, is_current, import_batch_id
    ) VALUES
      ('alb_a', 'Alpha Record', 'artist_a', 'Alpha Artist', '1999-02-03', NULL, 'high', 'accepted', 'https://i.scdn.co/image/alpha', 'https://open.spotify.com/album/alpha', 'Rock', 'classified', 1, 1, 1, 1, 'fixture'),
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
      ('alb_a', 1, 'full_or_near_complete_v1', '2020-01-01T00:00:00.000Z', '2024-02-01T00:00:00.000Z', 3, 2, 1, 1, 0, 4, 4, 3, '["2020-01","2022-01","2024-01","2024-02"]', '[2020,2022,2024]', 1492, 1, 1, 1, 1, 1, 'fixture'),
      ('alb_old', 1, 'full_or_near_complete_v1', '2015-01-01T00:00:00.000Z', '2015-01-01T00:00:00.000Z', 1, 1, 0, 0, 0, 1, 1, 1, '["2015-01"]', '[2015]', 0, 1, 0, 0, 0, 0, 'fixture');

    INSERT INTO album_sessions (
      session_id, canonical_album_id, started_at, ended_at, session_minutes,
      evidence_status, meaningful_unique_tracks, credible_unique_tracks,
      local_coverage, missing_local_track_count, import_batch_id
    ) VALUES
      ('ses_old', 'alb_a', '2020-01-01T00:00:00.000Z', '2020-01-01T00:40:00.000Z', 40, 'full', 10, 10, 1, 0, 'fixture'),
      ('ses_sparse', 'alb_a', '2024-01-15T00:00:00.000Z', '2024-01-15T00:03:00.000Z', 3, 'sparse', 1, 1, 0.1, 9, 'fixture'),
      ('ses_new', 'alb_a', '2024-02-01T00:00:00.000Z', '2024-02-01T00:36:00.000Z', 36, 'near_complete', 9, 9, 0.9, 1, 'fixture');
  `);

  return database;
}

describe("Album detail", () => {
  it("loads only current canonical albums", () => {
    const database = createDatabase();

    const current = database.prepare(ALBUM_DETAIL_SQL).get("alb_a") as AlbumDetailRow | undefined;
    const inactive = database.prepare(ALBUM_DETAIL_SQL).get("alb_old") as AlbumDetailRow | undefined;

    expect(current?.canonical_album_id).toBe("alb_a");
    expect(inactive).toBeUndefined();
    database.close();
  });

  it("orders only qualifying minimized sessions newest first", () => {
    const database = createDatabase();
    const sessions = database.prepare(ALBUM_SESSION_SQL).all("alb_a") as unknown as AlbumSessionRow[];

    expect(sessions.map((session) => session.session_id)).toEqual(["ses_new", "ses_old"]);
    expect(sessions.every((session) => session.evidence_status === "full" || session.evidence_status === "near_complete")).toBe(true);
    expect(ALBUM_SESSION_LIMIT).toBe(100);
    database.close();
  });

  it("maps archive rows into product-facing history", () => {
    const database = createDatabase();
    const row = database.prepare(ALBUM_DETAIL_SQL).get("alb_a") as unknown as AlbumDetailRow;
    const sessions = database.prepare(ALBUM_SESSION_SQL).all("alb_a") as unknown as AlbumSessionRow[];
    const album = mapAlbumDetailRow(row, sessions);

    expect(album).toMatchObject({
      canonicalAlbumId: "alb_a",
      title: "Alpha Record",
      artistName: "Alpha Artist",
      releaseYear: 1999,
      musicType: "Rock",
      qualifyingSessionCount: 3,
      fullSessionCount: 2,
      nearCompleteSessionCount: 1,
      sparseSessionCount: 1,
      listeningYears: [2020, 2022, 2024],
    });
    expect(album.sessions[0]).toMatchObject({
      sessionId: "ses_new",
      evidenceLabel: "Nearly complete listen",
      credibleUniqueTracks: 9,
    });
    database.close();
  });

  it("uses readable evidence labels without exposing database jargon", () => {
    expect(albumEvidenceLabel("full")).toBe("Front-to-back listen");
    expect(albumEvidenceLabel("near_complete")).toBe("Nearly complete listen");
    expect(albumEvidenceLabel("sparse")).toBe("Brief appearance");
    expect(albumEvidenceLabel("review")).toBe("Listening evidence");
  });

  it("normalizes route IDs conservatively", () => {
    expect(normalizeAlbumId("  alb_a  ")).toBe("alb_a");
    expect(normalizeAlbumId("x".repeat(201))).toBe("");
  });
});
