import { describe, expect, it } from "vitest";
import {
  renderArchiveImportSql,
  type RuntimeArchiveSnapshot,
} from "../lib/import/archive-reconciler.ts";

const emptySnapshot: RuntimeArchiveSnapshot = {
  version: 1,
  import_batch_id: "fixture-empty-import",
  artists: [],
  albums: [],
  editions: [],
  tracks: [],
  sessions: [],
  summaries: [],
  genres: [],
  album_genres: [],
};

describe("D1 archive import compatibility", () => {
  it("does not emit explicit transaction wrappers for wrangler d1 execute --file", () => {
    const sql = renderArchiveImportSql(emptySnapshot);
    expect(sql).not.toContain("BEGIN TRANSACTION");
    expect(sql).not.toContain("COMMIT;");
    expect(sql).toContain("PRAGMA foreign_keys = ON;");
    expect(sql).toContain("INSERT INTO import_batches");
  });
});
