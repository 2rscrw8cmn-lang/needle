import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  analyzeHistoryDirectory,
  renderImportReportMarkdown,
} from "../lib/import/history-validator.ts";

const FIXED_AS_OF = new Date("2026-08-25T23:59:59Z");
const FIXTURE_DIR = path.resolve("fixtures/history");

describe("Spotify history source validation", () => {
  it("produces deterministic manifests and reports for the same source and cutoff", async () => {
    const first = await analyzeHistoryDirectory({ inputDir: FIXTURE_DIR, asOf: FIXED_AS_OF });
    const second = await analyzeHistoryDirectory({ inputDir: FIXTURE_DIR, asOf: FIXED_AS_OF });

    expect(second.manifest).toEqual(first.manifest);
    expect(second.report).toEqual(first.report);
    expect(second.validatedMusic).toEqual(first.validatedMusic);
    expect(second.quarantine).toEqual(first.quarantine);
  });

  it("separates music from non-music and quarantines invalid rows", async () => {
    const analysis = await analyzeHistoryDirectory({ inputDir: FIXTURE_DIR, asOf: FIXED_AS_OF });

    expect(analysis.report.ok).toBe(true);
    expect(analysis.report.totals).toMatchObject({
      sourceFiles: 1,
      rawRows: 7,
      musicRows: 4,
      podcastRows: 1,
      audiobookRows: 1,
      unknownRows: 1,
      acceptedMusicRows: 2,
      excludedNonMusicRows: 2,
      quarantinedRows: 3,
    });
    expect(analysis.report.quarantineReasons).toEqual({
      future_timestamp: 1,
      invalid_timestamp: 1,
      unclassified_content: 1,
    });
  });

  it("only emits the privacy-approved music whitelist", async () => {
    const analysis = await analyzeHistoryDirectory({ inputDir: FIXTURE_DIR, asOf: FIXED_AS_OF });
    const first = analysis.validatedMusic[0];
    expect(first).toBeDefined();
    if (!first) throw new Error("Expected at least one validated fixture row");

    expect(Object.keys(first)).toEqual([
      "source_file",
      "source_row",
      "ts",
      "ms_played",
      "master_metadata_track_name",
      "master_metadata_album_artist_name",
      "master_metadata_album_album_name",
      "spotify_track_uri",
      "reason_start",
      "reason_end",
      "skipped",
    ]);

    const emitted = JSON.stringify({
      report: analysis.report,
      validatedMusic: analysis.validatedMusic,
      quarantine: analysis.quarantine,
    });
    expect(emitted).not.toContain("fixture-device");
    expect(emitted).not.toContain("not-retained");
    expect(emitted).not.toContain("schema-drift-example");
  });

  it("reports schema drift without copying unexpected field values", async () => {
    const analysis = await analyzeHistoryDirectory({ inputDir: FIXTURE_DIR, asOf: FIXED_AS_OF });
    const markdown = renderImportReportMarkdown(analysis.report);

    expect(analysis.report.schema.unexpectedFields).toContain("new_export_field");
    expect(markdown).toContain("`new_export_field`");
    expect(markdown).not.toContain("schema-drift-example");
  });

  it("marks malformed source files as fatal instead of silently skipping them", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "needle-history-invalid-"));
    try {
      await writeFile(path.join(directory, "Streaming_History_Audio_2026.json"), "{broken", "utf8");
      const analysis = await analyzeHistoryDirectory({ inputDir: directory, asOf: FIXED_AS_OF });

      expect(analysis.report.ok).toBe(false);
      expect(analysis.report.totals.fatalFiles).toBe(1);
      expect(analysis.manifest.files[0]?.status).toBe("invalid_json");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("orders split source files naturally and deterministically", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "needle-history-order-"));
    try {
      for (const filename of [
        "Streaming_History_Audio_2020_10.json",
        "Streaming_History_Audio_2020_2.json",
        "Streaming_History_Audio_2020_1.json",
      ]) {
        await writeFile(path.join(directory, filename), "[]", "utf8");
      }

      const analysis = await analyzeHistoryDirectory({ inputDir: directory, asOf: FIXED_AS_OF });
      expect(analysis.manifest.files.map((file) => file.name)).toEqual([
        "Streaming_History_Audio_2020_1.json",
        "Streaming_History_Audio_2020_2.json",
        "Streaming_History_Audio_2020_10.json",
      ]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
