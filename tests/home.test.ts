import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";

import {
  HOME_FEATURED_SQL,
  HOME_HISTORY_SQL,
  HOME_RECENT_SQL,
  HOME_STALE_SQL,
  homeIssueNumber,
  resolveHomeIssueIndex,
} from "../lib/home/home";

function createDatabase() {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync("migrations/0000_scaffold.sql", "utf8"));
  db.exec(readFileSync("migrations/0001_archive.sql", "utf8"));
  db.exec(`
    INSERT INTO artists (spotify_artist_id,name,spotify_url,is_current,import_batch_id) VALUES ('a','Artist',NULL,1,'f');
    INSERT INTO albums (canonical_album_id,title,primary_artist_id,primary_artist_name,original_release_date,preferred_edition_id,catalog_confidence,catalog_review_status,artwork_url,spotify_url,music_type,music_type_status,taxonomy_version,mapping_version,archive_member,is_current,import_batch_id) VALUES
      ('x','X','a','Artist','2000',NULL,'high','accepted',NULL,NULL,NULL,NULL,NULL,NULL,1,1,'f'),
      ('y','Y','a','Artist','2001',NULL,'high','accepted',NULL,NULL,NULL,NULL,NULL,NULL,1,1,'f'),
      ('z','Z','a','Artist','2002',NULL,'high','accepted',NULL,NULL,NULL,NULL,NULL,NULL,1,1,'f');
    INSERT INTO listener_album_summaries (canonical_album_id,archive_member,archive_rule,first_meaningful_listen_at,last_meaningful_listen_at,qualifying_session_count,full_session_count,near_complete_session_count,sparse_session_count,review_session_count,total_session_count,distinct_listening_months,distinct_listening_years,listening_months_json,listening_years_json,evidence_span_days,source_album_count,repeat_qualifying_sessions,spans_multiple_months,spans_multiple_years,spans_at_least_one_year,import_batch_id) VALUES
      ('x',1,'full_or_near_complete_v1','2018-01-01','2025-01-01',8,8,0,0,0,8,8,4,'[]','[2018,2020,2023,2025]',2556,1,1,1,1,1,'f'),
      ('y',1,'full_or_near_complete_v1','2020-01-01','2026-01-01',4,4,0,0,0,4,4,2,'[]','[2020,2026]',2192,1,1,1,1,1,'f'),
      ('z',1,'full_or_near_complete_v1','2019-01-01','2021-01-01',3,3,0,0,0,3,3,1,'[]','[2019]',730,1,1,1,0,1,'f');
    INSERT INTO album_sessions (session_id,canonical_album_id,started_at,ended_at,session_minutes,evidence_status,meaningful_unique_tracks,credible_unique_tracks,local_coverage,missing_local_track_count,import_batch_id) VALUES
      ('sx1','x','2018-01-03T00:00:00.000Z','2018-01-03T00:40:00.000Z',40,'full',10,10,1,0,'f'),
      ('sx2','x','2020-04-03T00:00:00.000Z','2020-04-03T00:40:00.000Z',40,'full',10,10,1,0,'f'),
      ('sy1','y','2020-09-03T00:00:00.000Z','2020-09-03T00:40:00.000Z',40,'near_complete',9,9,0.9,1,'f'),
      ('sy2','y','2026-01-03T00:00:00.000Z','2026-01-03T00:40:00.000Z',40,'full',10,10,1,0,'f');
  `);
  return db;
}

describe("Home rediscovery", () => {
  it("chooses the strongest cross-time record as featured", () => {
    const db = createDatabase();
    const row = db.prepare(HOME_FEATURED_SQL).get() as { canonical_album_id: string };
    expect(row.canonical_album_id).toBe("x");
    db.close();
  });

  it("recently revisited requires multiple listening years", () => {
    const db = createDatabase();
    const rows = db.prepare(HOME_RECENT_SQL).all() as Array<{ canonical_album_id: string }>;
    expect(rows.map((r) => r.canonical_album_id)).toEqual(["y", "x"]);
    db.close();
  });

  it("worth-another-listen orders oldest last-heard first", () => {
    const db = createDatabase();
    const rows = db.prepare(HOME_STALE_SQL).all() as Array<{ canonical_album_id: string }>;
    expect(rows.map((r) => r.canonical_album_id)).toEqual(["z", "x", "y"]);
    db.close();
  });

  it("aggregates first-heard versus returning records by year using meaningful sessions", () => {
    const db = createDatabase();
    const rows = db.prepare(HOME_HISTORY_SQL).all() as Array<{
      listening_year: number;
      album_count: number;
      first_heard_count: number;
      returning_count: number;
      full_play_count: number;
    }>;

    expect(rows).toEqual([
      { listening_year: 2018, album_count: 1, first_heard_count: 1, returning_count: 0, full_play_count: 1 },
      { listening_year: 2020, album_count: 2, first_heard_count: 1, returning_count: 1, full_play_count: 1 },
      { listening_year: 2026, album_count: 1, first_heard_count: 0, returning_count: 1, full_play_count: 1 },
    ]);
    db.close();
  });

  it("keeps issue selection deterministic for the same UTC day", () => {
    const date = new Date("2026-08-28T23:59:59.000Z");
    expect(resolveHomeIssueIndex(date)).toBe(resolveHomeIssueIndex(new Date("2026-08-28T00:00:01.000Z")));
    expect(resolveHomeIssueIndex(date)).toBeGreaterThanOrEqual(0);
    expect(resolveHomeIssueIndex(date)).toBeLessThan(3);
    expect(homeIssueNumber(date)).toBe(1);
    expect(homeIssueNumber(new Date("2026-08-29T12:00:00.000Z"))).toBe(2);
  });
});
