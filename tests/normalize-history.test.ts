import { describe, expect, it } from "vitest";
import type {
  ImportManifest,
  ImportReport,
  MinimizedMusicRow,
} from "../lib/import/history-validator.ts";
import {
  normalizePlaybackEvents,
  renderPlaybackNormalizationMarkdown,
  type StageOneArtifacts,
} from "../lib/import/playback-normalizer.ts";

function row(overrides: Partial<MinimizedMusicRow> = {}): MinimizedMusicRow {
  return {
    source_file: "Streaming_History_Audio_2026.json",
    source_row: 1,
    ts: "2026-08-20T12:00:00Z",
    ms_played: 181000,
    master_metadata_track_name: "First Light",
    master_metadata_album_artist_name: "Sample Artist",
    master_metadata_album_album_name: "Sample Album",
    spotify_track_uri: "spotify:track:sample001",
    reason_start: "trackdone",
    reason_end: "trackdone",
    skipped: false,
    ...overrides,
  };
}

function artifacts(
  rows: MinimizedMusicRow[],
  options: { batchId?: string; acceptedRows?: number; rowCount?: number } = {},
): StageOneArtifacts {
  const batchId = options.batchId ?? "batch-fixture";
  const manifest = {
    manifestVersion: 1,
    batchId,
    sourcePattern: "fixture",
    files: [
      {
        order: 1,
        name: "Streaming_History_Audio_2026.json",
        bytes: 123,
        sha256: "fixture-sha",
        status: "ok",
        rowCount: options.rowCount ?? Math.max(rows.length, 1),
      },
    ],
  } as ImportManifest;

  const report = {
    reportVersion: 1,
    batchId,
    validationAsOf: "2026-08-25T23:59:59.000Z",
    futureToleranceMs: 300000,
    ok: true,
    totals: {
      sourceFiles: 1,
      fatalFiles: 0,
      rawRows: rows.length,
      musicRows: rows.length,
      podcastRows: 0,
      audiobookRows: 0,
      unknownRows: 0,
      mixedRows: 0,
      acceptedMusicRows: options.acceptedRows ?? rows.length,
      excludedNonMusicRows: 0,
      quarantinedRows: 0,
    },
    schema: {
      baselineFile: "Streaming_History_Audio_2026.json",
      filesWithSchemaDrift: 0,
      filesWithNullRateChanges: 0,
      unexpectedFields: [],
    },
    quarantineReasons: {},
    files: [],
  } as ImportReport;

  return { manifest, report, validatedMusic: rows };
}

describe("playback event normalization", () => {
  it("collapses only exact duplicates and preserves every source reference", () => {
    const input = [
      row({ source_row: 1 }),
      row({ source_row: 2 }),
      row({ source_row: 3, ms_played: 180999 }),
    ];

    const normalization = normalizePlaybackEvents(artifacts(input));

    expect(normalization.report.totals).toMatchObject({
      validatedMusicRows: 3,
      normalizedEvents: 2,
      duplicatesCollapsed: 1,
      duplicateGroups: 1,
    });
    expect(normalization.report.reconciliation.balances).toBe(true);

    const duplicateEvent = normalization.events.find((event) => event.ms_played === 181000);
    expect(duplicateEvent?.source_refs).toEqual([
      { file: "Streaming_History_Audio_2026.json", row: 1 },
      { file: "Streaming_History_Audio_2026.json", row: 2 },
    ]);
  });

  it("normalizes timestamps to canonical UTC and extracts Spotify track IDs", () => {
    const normalization = normalizePlaybackEvents(
      artifacts([
        row({
          ts: "2026-08-20T08:00:00-04:00",
          spotify_track_uri: "spotify:track:abc123",
        }),
      ]),
    );

    expect(normalization.events[0]).toMatchObject({
      played_at: "2026-08-20T12:00:00.000Z",
      spotify_track_id: "abc123",
      source_spotify_track_uri: "spotify:track:abc123",
      track_identity_status: "spotify",
    });
  });

  it("keeps missing or malformed Spotify identity explicit instead of guessing", () => {
    const normalization = normalizePlaybackEvents(
      artifacts([
        row({ source_row: 1, spotify_track_uri: null }),
        row({
          source_row: 2,
          ts: "2026-08-20T12:05:00Z",
          spotify_track_uri: "not-a-spotify-track-uri",
        }),
      ]),
    );

    expect(normalization.report.totals).toMatchObject({
      metadataOnlyEvents: 1,
      unparseableSpotifyUriEvents: 1,
      spotifyIdentityEvents: 0,
    });
    expect(normalization.events.map((event) => event.track_identity_status).sort()).toEqual([
      "metadata_only",
      "unparseable_spotify_uri",
    ]);
  });

  it("creates stable event IDs independent of import-batch provenance", () => {
    const input = [row()];
    const first = normalizePlaybackEvents(artifacts(input, { batchId: "batch-a" }));
    const second = normalizePlaybackEvents(artifacts(input, { batchId: "batch-b" }));

    expect(first.events[0]?.event_id).toBe(second.events[0]?.event_id);
    expect(first.events[0]?.import_batch_id).toBe("batch-a");
    expect(second.events[0]?.import_batch_id).toBe("batch-b");
  });

  it("does not copy unknown/private fields from a tampered validated row", () => {
    const privateRow = {
      ...row(),
      ip_addr: "192.0.2.1",
      platform: "private-device",
      conn_country: "ZZ",
    } as MinimizedMusicRow;
    const normalization = normalizePlaybackEvents(artifacts([privateRow]));
    const emitted = JSON.stringify(normalization);

    expect(emitted).not.toContain("192.0.2.1");
    expect(emitted).not.toContain("private-device");
    expect(emitted).not.toContain("conn_country");
  });

  it("fails visibly when 1.01 accepted counts do not reconcile", () => {
    expect(() => normalizePlaybackEvents(artifacts([row()], { acceptedRows: 2 }))).toThrow(
      "accepted music count does not match validated-music.json",
    );
  });

  it("fails visibly when source provenance falls outside the manifest", () => {
    expect(() =>
      normalizePlaybackEvents(artifacts([row({ source_row: 3 })], { rowCount: 2 })),
    ).toThrow("source row is outside manifest bounds");
  });

  it("renders a human-readable reconciliation and duplicate contract", () => {
    const normalization = normalizePlaybackEvents(
      artifacts([row({ source_row: 1 }), row({ source_row: 2 })]),
    );
    const markdown = renderPlaybackNormalizationMarkdown(normalization.report);

    expect(markdown).toContain("Normalized playback events | 1");
    expect(markdown).toContain("Duplicate rows collapsed | 1");
    expect(markdown).toContain("same historical event receives the same ID");
  });
});
