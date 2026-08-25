import { describe, expect, it } from "vitest";
import {
  MEANINGFUL_PLAY_MS,
  SESSION_GAP_MS,
  normalizeLabel,
  sessionizeAlbumListening,
  trackKey,
  type NormalizedPlaybackEventInput,
  type StageTwoArtifacts,
} from "../lib/import/album-sessionizer.ts";

const BATCH_ID = "batch-session-fixture";
const MINUTE = 60_000;

function event(options: {
  id: string;
  endMs: number;
  track: string;
  artist?: string;
  album?: string;
  msPlayed?: number;
  skipped?: boolean | null;
  reasonEnd?: string | null;
}): NormalizedPlaybackEventInput {
  return {
    event_id: options.id,
    import_batch_id: BATCH_ID,
    played_at: new Date(options.endMs).toISOString(),
    ms_played: options.msPlayed ?? 60_000,
    spotify_track_id: options.id.replace(/[^A-Za-z0-9]/g, ""),
    source_spotify_track_uri: `spotify:track:${options.id.replace(/[^A-Za-z0-9]/g, "")}`,
    track_identity_status: "spotify",
    track_name: options.track,
    artist_name: options.artist ?? "Fixture Artist",
    album_name: options.album ?? "Fixture Album",
    reason_start: "trackdone",
    reason_end: options.reasonEnd ?? "trackdone",
    skipped: options.skipped ?? false,
    source_refs: [{ file: "Streaming_History_Audio_fixture.json", row: 1 }],
  };
}

function albumRun(options: {
  prefix: string;
  startMs: number;
  tracks: string[];
  artist?: string;
  album?: string;
  overrides?: Record<string, Partial<NormalizedPlaybackEventInput>>;
}): NormalizedPlaybackEventInput[] {
  return options.tracks.map((track, index) => {
    const base = event({
      id: `${options.prefix}-${index + 1}`,
      endMs: options.startMs + (index + 1) * 2 * MINUTE,
      track,
      artist: options.artist,
      album: options.album,
    });
    return { ...base, ...(options.overrides?.[track] ?? {}) };
  });
}

function artifacts(events: NormalizedPlaybackEventInput[]): StageTwoArtifacts {
  return {
    report: {
      reportVersion: 1,
      normalizationVersion: 1,
      importBatchId: BATCH_ID,
      ok: true,
      totals: { normalizedEvents: events.length },
    },
    events,
  };
}

function statusCounts(result: ReturnType<typeof sessionizeAlbumListening>) {
  return result.sessions.reduce<Record<string, number>>((counts, session) => {
    counts[session.evidence_status] = (counts[session.evidence_status] ?? 0) + 1;
    return counts;
  }, {});
}

describe("album sessionization", () => {
  it("creates a provisional album only after two qualifying sessions and is deterministic", () => {
    const tracks = ["One", "Two", "Three", "Four", "Five"];
    const first = albumRun({ prefix: "a", startMs: Date.UTC(2026, 0, 1, 12), tracks });
    const second = albumRun({ prefix: "b", startMs: Date.UTC(2026, 0, 2, 12), tracks });
    const input = [...first, ...second];

    const forward = sessionizeAlbumListening(artifacts(input));
    const reversed = sessionizeAlbumListening(artifacts([...input].reverse()));

    expect(forward.provisionalAlbums).toHaveLength(1);
    expect(forward.sessions).toHaveLength(2);
    expect(forward.sessions.every((session) => session.evidence_status === "full")).toBe(true);
    expect(forward.report.totals.qualifyingSessions).toBe(2);
    expect(forward.sessions).toEqual(reversed.sessions);
    expect(forward.provisionalAlbums).toEqual(reversed.provisionalAlbums);
  });

  it("classifies two 8-of-10 sessions as Near-Complete", () => {
    const tracks = Array.from({ length: 10 }, (_, index) => `Track ${index + 1}`);
    const first = albumRun({
      prefix: "near-a",
      startMs: Date.UTC(2026, 1, 1, 12),
      tracks: tracks.slice(0, 8),
    });
    const second = albumRun({
      prefix: "near-b",
      startMs: Date.UTC(2026, 1, 2, 12),
      tracks: tracks.slice(2),
    });

    const result = sessionizeAlbumListening(artifacts([...first, ...second]));

    expect(result.provisionalAlbums).toHaveLength(1);
    expect(statusCounts(result)).toMatchObject({ near_complete: 2 });
    expect(result.sessions.every((session) => session.local_coverage === 0.8)).toBe(true);
    expect(result.sessions.every((session) => session.missing_local_track_count === 2)).toBe(true);
  });

  it("keeps meaningful skipped tracks separate from credible coverage", () => {
    const tracks = ["One", "Two", "Three", "Four", "Five"];
    const first = albumRun({
      prefix: "skip-a",
      startMs: Date.UTC(2026, 2, 1, 12),
      tracks,
      overrides: { Five: { skipped: true, reason_end: "trackdone" } },
    });
    const second = albumRun({ prefix: "skip-b", startMs: Date.UTC(2026, 2, 2, 12), tracks });

    const result = sessionizeAlbumListening(artifacts([...first, ...second]));
    const firstSession = result.sessions[0];

    expect(firstSession.evidence_status).toBe("near_complete");
    expect(firstSession.meaningful_unique_tracks).toBe(5);
    expect(firstSession.credible_unique_tracks).toBe(4);
    expect(firstSession.trackdone_unique_tracks).toBe(5);
  });

  it("requires 30 seconds before a play contributes meaningful track coverage", () => {
    const tracks = ["One", "Two", "Three", "Four", "Five"];
    const first = albumRun({
      prefix: "short-a",
      startMs: Date.UTC(2026, 3, 1, 12),
      tracks,
      overrides: { Five: { ms_played: MEANINGFUL_PLAY_MS - 1 } },
    });
    const second = albumRun({ prefix: "short-b", startMs: Date.UTC(2026, 3, 2, 12), tracks });

    const result = sessionizeAlbumListening(artifacts([...first, ...second]));
    expect(result.sessions[0].evidence_status).toBe("near_complete");
    expect(result.sessions[0].meaningful_unique_tracks).toBe(4);
  });

  it("ignores zero-ms events from another album as continuity noise", () => {
    const tracks = ["One", "Two", "Three", "Four", "Five"];
    const first = albumRun({ prefix: "zero-a", startMs: Date.UTC(2026, 4, 1, 12), tracks });
    const noise = event({
      id: "zero-noise",
      endMs: Date.UTC(2026, 4, 1, 12) + 5 * MINUTE,
      track: "Noise",
      artist: "Other Artist",
      album: "Other Album",
      msPlayed: 0,
    });
    const second = albumRun({ prefix: "zero-b", startMs: Date.UTC(2026, 4, 2, 12), tracks });

    const result = sessionizeAlbumListening(artifacts([...first, noise, ...second]));

    expect(result.sessions).toHaveLength(2);
    expect(result.sessions.every((session) => session.evidence_status === "full")).toBe(true);
    expect(result.report.totals.zeroMsEventsIgnored).toBe(1);
    expect(result.report.reconciliation.zeroMsEventsBalance).toBe(true);
  });

  it("lets a positive-duration play from another album break a run", () => {
    const tracks = ["One", "Two", "Three", "Four", "Five"];
    const base = Date.UTC(2026, 5, 1, 12);
    const interrupted = albumRun({ prefix: "break-a", startMs: base, tracks });
    const breaker = event({
      id: "breaker",
      endMs: base + 5 * MINUTE,
      track: "Interruption",
      artist: "Other Artist",
      album: "Other Album",
      msPlayed: 5_000,
    });
    const laterOne = albumRun({ prefix: "break-b", startMs: Date.UTC(2026, 5, 2, 12), tracks });
    const laterTwo = albumRun({ prefix: "break-c", startMs: Date.UTC(2026, 5, 3, 12), tracks });

    const result = sessionizeAlbumListening(
      artifacts([...interrupted, breaker, ...laterOne, ...laterTwo]),
    );

    expect(result.provisionalAlbums).toHaveLength(1);
    expect(result.report.totals.sourceSessionRuns).toBeGreaterThan(3);
    expect(result.sessions.filter((session) => session.evidence_status === "full")).toHaveLength(2);
  });

  it("breaks same-album runs when the event timestamp gap exceeds fifteen minutes", () => {
    const tracks = ["One", "Two", "Three", "Four", "Five"];
    const base = Date.UTC(2026, 6, 1, 12);
    const firstTwo = albumRun({ prefix: "gap-a", startMs: base, tracks: tracks.slice(0, 2) });
    const lastThree = albumRun({
      prefix: "gap-b",
      startMs: base + SESSION_GAP_MS + 20 * MINUTE,
      tracks: tracks.slice(2),
    });
    const laterOne = albumRun({ prefix: "gap-c", startMs: Date.UTC(2026, 6, 2, 12), tracks });
    const laterTwo = albumRun({ prefix: "gap-d", startMs: Date.UTC(2026, 6, 3, 12), tracks });

    const result = sessionizeAlbumListening(
      artifacts([...firstTwo, ...lastThree, ...laterOne, ...laterTwo]),
    );

    expect(result.sessions.filter((session) => session.evidence_status === "full")).toHaveLength(2);
    expect(result.report.totals.sourceSessionRuns).toBeGreaterThanOrEqual(4);
  });

  it("normalizes superficial label/title variants without resolving album editions", () => {
    expect(normalizeLabel("Not to Disappear")).toBe(normalizeLabel("Not To Disappear"));
    expect(trackKey("Apartment - 2020 Remastered")).toBe(trackKey("Apartment"));
    expect(normalizeLabel("PHOX (Deluxe Version)")).not.toBe(normalizeLabel("PHOX"));
  });

  it("fails visibly when the 1.02 contract does not reconcile", () => {
    const input = [event({ id: "one", endMs: Date.UTC(2026, 7, 1, 12), track: "One" })];
    const bad = artifacts(input);
    bad.report.totals.normalizedEvents = 2;

    expect(() => sessionizeAlbumListening(bad)).toThrow(
      "normalized event count does not match normalized-playback-events.json",
    );
  });

  it("does not copy unknown raw-private fields into session artifacts", () => {
    const tracks = ["One", "Two", "Three", "Four", "Five"];
    const first = albumRun({ prefix: "private-a", startMs: Date.UTC(2026, 8, 1, 12), tracks });
    const second = albumRun({ prefix: "private-b", startMs: Date.UTC(2026, 8, 2, 12), tracks });
    (first[0] as NormalizedPlaybackEventInput & { ip_addr: string }).ip_addr = "192.0.2.1";

    const result = sessionizeAlbumListening(artifacts([...first, ...second]));
    expect(JSON.stringify(result)).not.toContain("192.0.2.1");
    expect(JSON.stringify(result)).not.toContain("ip_addr");
  });
});
