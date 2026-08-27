import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";

import { HOME_FEATURED_SQL, HOME_RECENT_SQL, HOME_STALE_SQL } from "../lib/home/home";

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
});
