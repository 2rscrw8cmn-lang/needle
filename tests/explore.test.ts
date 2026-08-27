import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";

import { EXPLORE_ARTISTS_SQL, EXPLORE_CROSS_TIME_SQL, EXPLORE_DECADES_SQL } from "../lib/explore/explore";

function createDatabase() {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync("migrations/0000_scaffold.sql", "utf8"));
  db.exec(readFileSync("migrations/0001_archive.sql", "utf8"));
  db.exec(`
    INSERT INTO artists (spotify_artist_id, name, spotify_url, is_current, import_batch_id) VALUES
      ('a1','Artist One',NULL,1,'f'),('a2','Artist Two',NULL,1,'f');
    INSERT INTO albums (canonical_album_id,title,primary_artist_id,primary_artist_name,original_release_date,preferred_edition_id,catalog_confidence,catalog_review_status,artwork_url,spotify_url,music_type,music_type_status,taxonomy_version,mapping_version,archive_member,is_current,import_batch_id) VALUES
      ('x','X','a1','Artist One','1999',NULL,'high','accepted',NULL,NULL,NULL,NULL,NULL,NULL,1,1,'f'),
      ('y','Y','a1','Artist One','2004',NULL,'high','accepted',NULL,NULL,NULL,NULL,NULL,NULL,1,1,'f'),
      ('z','Z','a2','Artist Two','2007',NULL,'high','accepted',NULL,NULL,NULL,NULL,NULL,NULL,1,1,'f');
    INSERT INTO listener_album_summaries (canonical_album_id,archive_member,archive_rule,first_meaningful_listen_at,last_meaningful_listen_at,qualifying_session_count,full_session_count,near_complete_session_count,sparse_session_count,review_session_count,total_session_count,distinct_listening_months,distinct_listening_years,listening_months_json,listening_years_json,evidence_span_days,source_album_count,repeat_qualifying_sessions,spans_multiple_months,spans_multiple_years,spans_at_least_one_year,import_batch_id) VALUES
      ('x',1,'full_or_near_complete_v1','2020-01-01','2024-01-01',4,4,0,0,0,4,4,3,'[]','[2020,2022,2024]',1460,1,1,1,1,1,'f'),
      ('y',1,'full_or_near_complete_v1','2023-01-01','2024-01-01',2,2,0,0,0,2,2,2,'[]','[2023,2024]',365,1,1,1,1,1,'f'),
      ('z',1,'full_or_near_complete_v1','2024-01-01','2024-01-01',1,1,0,0,0,1,1,1,'[]','[2024]',0,1,0,0,0,0,'f');
  `);
  return db;
}

describe("Explore", () => {
  it("derives decade counts from current archive albums", () => {
    const db = createDatabase();
    const rows = db.prepare(EXPLORE_DECADES_SQL).all() as Array<{ decade: number; album_count: number }>;
    expect(rows.map((r) => [Number(r.decade), Number(r.album_count)])).toEqual([[2000, 2], [1990, 1]]);
    db.close();
  });

  it("ranks artists by represented album count", () => {
    const db = createDatabase();
    const rows = db.prepare(EXPLORE_ARTISTS_SQL).all() as Array<{ primary_artist_name: string; album_count: number }>;
    expect(rows[0].primary_artist_name).toBe("Artist One");
    expect(Number(rows[0].album_count)).toBe(2);
    db.close();
  });

  it("surfaces only records spanning multiple listening years", () => {
    const db = createDatabase();
    const rows = db.prepare(EXPLORE_CROSS_TIME_SQL).all() as Array<{ canonical_album_id: string; distinct_listening_years: number }>;
    expect(rows.map((r) => r.canonical_album_id)).toEqual(["x", "y"]);
    expect(Number(rows[0].distinct_listening_years)).toBe(3);
    db.close();
  });
});
