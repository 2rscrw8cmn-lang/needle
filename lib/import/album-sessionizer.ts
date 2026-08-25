import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const SESSION_GAP_MS = 15 * 60 * 1000;
export const MEANINGFUL_PLAY_MS = 30_000;
export const MIN_LOCAL_TRACKS = 5;
export const NEAR_COMPLETE_MIN_COVERAGE = 0.8;
export const NEAR_COMPLETE_MAX_MISSING = 2;
export const MIN_CANDIDATE_QUALIFYING_SESSIONS = 2;

export const WORKBOOK_SESSION_REFERENCE = {
  candidateAlbums: 402,
  qualifyingSessions: 2012,
  fullSessions: 1324,
  nearCompleteSessions: 688,
} as const;

export type SessionEvidenceStatus = "full" | "near_complete" | "sparse" | "review";

export interface NormalizedPlaybackEventInput {
  event_id: string;
  import_batch_id: string;
  played_at: string;
  ms_played: number;
  spotify_track_id: string | null;
  source_spotify_track_uri: string | null;
  track_identity_status: "spotify" | "metadata_only" | "unparseable_spotify_uri";
  track_name: string;
  artist_name: string;
  album_name: string;
  reason_start: string | null;
  reason_end: string | null;
  skipped: boolean | null;
  source_refs: Array<{ file: string; row: number }>;
}

export interface PlaybackNormalizationReportInput {
  reportVersion: number;
  normalizationVersion: number;
  importBatchId: string;
  ok: boolean;
  totals: {
    normalizedEvents: number;
    [key: string]: number;
  };
}

export interface StageTwoArtifacts {
  report: PlaybackNormalizationReportInput;
  events: NormalizedPlaybackEventInput[];
}

export interface AlbumSession {
  session_id: string;
  source_album_key: string;
  import_batch_id: string;
  artist_name: string;
  album_name: string;
  started_at: string;
  ended_at: string;
  session_minutes: number;
  event_count: number;
  positive_event_count: number;
  meaningful_event_count: number;
  evidence_status: SessionEvidenceStatus;
  known_local_tracks: number;
  meaningful_unique_tracks: number;
  credible_unique_tracks: number;
  trackdone_unique_tracks: number;
  local_coverage: number;
  missing_local_track_count: number;
  session_track_keys: string[];
  meaningful_track_keys: string[];
  credible_track_keys: string[];
  trackdone_track_keys: string[];
  missing_local_track_keys: string[];
  event_ids: string[];
  review_reasons: string[];
}

export interface ProvisionalAlbum {
  source_album_key: string;
  artist_name: string;
  album_name: string;
  known_local_track_count: number;
  known_local_track_keys: string[];
  qualifying_session_count: number;
  full_session_count: number;
  near_complete_session_count: number;
  sparse_session_count: number;
  review_session_count: number;
  first_session_at: string;
  last_session_at: string;
}

export interface SessionizationReport {
  reportVersion: 1;
  sessionizationVersion: 1;
  importBatchId: string;
  ok: boolean;
  rules: {
    sessionGapMs: number;
    meaningfulPlayMs: number;
    minLocalTracks: number;
    nearCompleteMinCoverage: number;
    nearCompleteMaxMissing: number;
    minCandidateQualifyingSessions: number;
  };
  totals: {
    normalizedEvents: number;
    zeroMsEvents: number;
    zeroMsEventsInRuns: number;
    zeroMsEventsIgnored: number;
    positiveEvents: number;
    positiveEventsAssigned: number;
    sourceSessionRuns: number;
    provisionalCandidateAlbums: number;
    candidateSessions: number;
    fullSessions: number;
    nearCompleteSessions: number;
    sparseSessions: number;
    reviewSessions: number;
    qualifyingSessions: number;
  };
  reconciliation: {
    matchesNormalizationReport: boolean;
    positiveEventsBalance: boolean;
    zeroMsEventsBalance: boolean;
  };
  workbookReference: {
    candidateAlbums: number;
    qualifyingSessions: number;
    fullSessions: number;
    nearCompleteSessions: number;
    candidateAlbumDelta: number;
    qualifyingSessionDelta: number;
    fullSessionDelta: number;
    nearCompleteSessionDelta: number;
  };
}

export interface SessionizationResult {
  sessions: AlbumSession[];
  provisionalAlbums: ProvisionalAlbum[];
  report: SessionizationReport;
}

interface AlbumIdentity {
  key: string;
  sourceAlbumKey: string;
}

interface SessionRun {
  albumIdentity: AlbumIdentity;
  events: NormalizedPlaybackEventInput[];
  startedAtMs: number;
  endedAtMs: number;
  lastEventEndMs: number;
}

interface ClassifiedRun {
  session: AlbumSession;
  albumIdentityKey: string;
}

export async function readStageTwoArtifacts(inputDir: string): Promise<StageTwoArtifacts> {
  const [reportRaw, eventsRaw] = await Promise.all([
    readJson(path.join(inputDir, "normalization-report.json")),
    readJson(path.join(inputDir, "normalized-playback-events.json")),
  ]);

  assertNormalizationReport(reportRaw);
  assertNormalizedEvents(eventsRaw);

  return { report: reportRaw, events: eventsRaw };
}

export function sessionizeAlbumListening(artifacts: StageTwoArtifacts): SessionizationResult {
  validateStageTwoContract(artifacts);

  const events = [...artifacts.events].sort(compareEvents);
  const albumDisplays = buildAlbumDisplayCounts(events);
  const knownTracks = buildKnownTrackSets(events);
  const { runs, zeroMsEvents, zeroMsEventsInRuns, zeroMsEventsIgnored } = buildSessionRuns(events);

  const classifiedRuns = runs.map((run) =>
    classifyRun({
      run,
      knownTrackKeys: knownTracks.get(run.albumIdentity.key) ?? new Set<string>(),
      display: chooseAlbumDisplay(albumDisplays.get(run.albumIdentity.key)),
      importBatchId: artifacts.report.importBatchId,
    }),
  );

  const qualifyingByAlbum = new Map<string, number>();
  for (const { albumIdentityKey, session } of classifiedRuns) {
    if (session.evidence_status !== "full" && session.evidence_status !== "near_complete") continue;
    qualifyingByAlbum.set(albumIdentityKey, (qualifyingByAlbum.get(albumIdentityKey) ?? 0) + 1);
  }

  const candidateAlbumKeys = new Set(
    [...qualifyingByAlbum.entries()]
      .filter(([, count]) => count >= MIN_CANDIDATE_QUALIFYING_SESSIONS)
      .map(([key]) => key),
  );

  const sessions = classifiedRuns
    .filter(({ albumIdentityKey }) => candidateAlbumKeys.has(albumIdentityKey))
    .map(({ session }) => session)
    .sort(compareSessions);

  const provisionalAlbums = buildProvisionalAlbums({
    sessions,
    candidateAlbumKeys,
    knownTracks,
    albumDisplays,
  });

  const statusCounts = countStatuses(sessions);
  const positiveEvents = events.filter((event) => event.ms_played > 0).length;
  const positiveEventsAssigned = runs.reduce(
    (total, run) => total + run.events.filter((event) => event.ms_played > 0).length,
    0,
  );
  const matchesNormalizationReport = artifacts.report.totals.normalizedEvents === events.length;
  const positiveEventsBalance = positiveEventsAssigned === positiveEvents;
  const zeroMsEventsBalance = zeroMsEventsInRuns + zeroMsEventsIgnored === zeroMsEvents;
  const qualifyingSessions = statusCounts.full + statusCounts.near_complete;

  const report: SessionizationReport = {
    reportVersion: 1,
    sessionizationVersion: 1,
    importBatchId: artifacts.report.importBatchId,
    ok: matchesNormalizationReport && positiveEventsBalance && zeroMsEventsBalance,
    rules: {
      sessionGapMs: SESSION_GAP_MS,
      meaningfulPlayMs: MEANINGFUL_PLAY_MS,
      minLocalTracks: MIN_LOCAL_TRACKS,
      nearCompleteMinCoverage: NEAR_COMPLETE_MIN_COVERAGE,
      nearCompleteMaxMissing: NEAR_COMPLETE_MAX_MISSING,
      minCandidateQualifyingSessions: MIN_CANDIDATE_QUALIFYING_SESSIONS,
    },
    totals: {
      normalizedEvents: events.length,
      zeroMsEvents,
      zeroMsEventsInRuns,
      zeroMsEventsIgnored,
      positiveEvents,
      positiveEventsAssigned,
      sourceSessionRuns: runs.length,
      provisionalCandidateAlbums: provisionalAlbums.length,
      candidateSessions: sessions.length,
      fullSessions: statusCounts.full,
      nearCompleteSessions: statusCounts.near_complete,
      sparseSessions: statusCounts.sparse,
      reviewSessions: statusCounts.review,
      qualifyingSessions,
    },
    reconciliation: {
      matchesNormalizationReport,
      positiveEventsBalance,
      zeroMsEventsBalance,
    },
    workbookReference: {
      candidateAlbums: WORKBOOK_SESSION_REFERENCE.candidateAlbums,
      qualifyingSessions: WORKBOOK_SESSION_REFERENCE.qualifyingSessions,
      fullSessions: WORKBOOK_SESSION_REFERENCE.fullSessions,
      nearCompleteSessions: WORKBOOK_SESSION_REFERENCE.nearCompleteSessions,
      candidateAlbumDelta:
        provisionalAlbums.length - WORKBOOK_SESSION_REFERENCE.candidateAlbums,
      qualifyingSessionDelta:
        qualifyingSessions - WORKBOOK_SESSION_REFERENCE.qualifyingSessions,
      fullSessionDelta: statusCounts.full - WORKBOOK_SESSION_REFERENCE.fullSessions,
      nearCompleteSessionDelta:
        statusCounts.near_complete - WORKBOOK_SESSION_REFERENCE.nearCompleteSessions,
    },
  };

  return { sessions, provisionalAlbums, report };
}

export async function writeSessionizationOutputs(options: {
  outputDir: string;
  result: SessionizationResult;
}): Promise<void> {
  await mkdir(options.outputDir, { recursive: true });
  await Promise.all([
    writeFile(
      path.join(options.outputDir, "album-sessions.json"),
      jsonWithNewline(options.result.sessions),
      "utf8",
    ),
    writeFile(
      path.join(options.outputDir, "provisional-albums.json"),
      jsonWithNewline(options.result.provisionalAlbums),
      "utf8",
    ),
    writeFile(
      path.join(options.outputDir, "sessionization-report.json"),
      jsonWithNewline(options.result.report),
      "utf8",
    ),
    writeFile(
      path.join(options.outputDir, "sessionization-report.md"),
      `${renderSessionizationReportMarkdown(options.result.report)}\n`,
      "utf8",
    ),
  ]);
}

export function renderSessionizationReportMarkdown(report: SessionizationReport): string {
  const minutes = report.rules.sessionGapMs / 60_000;
  const seconds = report.rules.meaningfulPlayMs / 1000;
  return [
    "# Needle Album Session Reconstruction",
    "",
    `- Import batch: \`${report.importBatchId}\``,
    `- Result: **${report.ok ? "PASS" : "FAIL"}**`,
    "",
    "## Rules",
    "",
    `- Same-album session gap: ${minutes} minutes between playback-event timestamps.`,
    "- A positive-duration play from another source album breaks the current run; zero-ms rows from another album are ignored as control/noise events.",
    `- Meaningful track evidence: at least ${seconds} seconds played.`,
    "- Credible track evidence: meaningful and not marked `skipped=true`.",
    `- Full: credible coverage of every locally known track, with at least ${report.rules.minLocalTracks} known tracks.`,
    `- Near-Complete: at least ${(report.rules.nearCompleteMinCoverage * 100).toFixed(0)}% credible coverage and no more than ${report.rules.nearCompleteMaxMissing} missing tracks.`,
    "- Sparse: zero or one credible track. Other non-qualifying runs are Review.",
    `- Provisional album candidate: at least ${report.rules.minCandidateQualifyingSessions} Full/Near-Complete local sessions.`,
    "",
    "## Counts",
    "",
    "| Metric | Count |",
    "| --- | ---: |",
    `| Normalized playback events | ${report.totals.normalizedEvents} |`,
    `| Positive-duration events | ${report.totals.positiveEvents} |`,
    `| Zero-ms events | ${report.totals.zeroMsEvents} |`,
    `| Source session runs | ${report.totals.sourceSessionRuns} |`,
    `| Provisional candidate albums | ${report.totals.provisionalCandidateAlbums} |`,
    `| Candidate sessions retained | ${report.totals.candidateSessions} |`,
    `| Full | ${report.totals.fullSessions} |`,
    `| Near-Complete | ${report.totals.nearCompleteSessions} |`,
    `| Sparse | ${report.totals.sparseSessions} |`,
    `| Review | ${report.totals.reviewSessions} |`,
    `| Qualifying Full + Near-Complete | ${report.totals.qualifyingSessions} |`,
    "",
    "## Reconciliation",
    "",
    `- Matches 1.02 normalized-event count: **${report.reconciliation.matchesNormalizationReport ? "yes" : "no"}**`,
    `- Every positive-duration event is assigned to one source run: **${report.reconciliation.positiveEventsBalance ? "yes" : "no"}**`,
    `- Zero-ms rows reconcile between retained continuity rows and ignored noise: **${report.reconciliation.zeroMsEventsBalance ? "yes" : "no"}**`,
    "",
    "## Workbook reference",
    "",
    "The private analysis workbook is a reference implementation, not a runtime dependency. Its current `Session Details` sheet contains 2,012 qualifying local sessions: 1,324 locally complete and 688 locally near-complete, across 402 analyzed candidate albums.",
    "",
    "| Metric | Workbook | 1.03 | Delta |",
    "| --- | ---: | ---: | ---: |",
    `| Candidate albums | ${report.workbookReference.candidateAlbums} | ${report.totals.provisionalCandidateAlbums} | ${signed(report.workbookReference.candidateAlbumDelta)} |`,
    `| Qualifying sessions | ${report.workbookReference.qualifyingSessions} | ${report.totals.qualifyingSessions} | ${signed(report.workbookReference.qualifyingSessionDelta)} |`,
    `| Full sessions | ${report.workbookReference.fullSessions} | ${report.totals.fullSessions} | ${signed(report.workbookReference.fullSessionDelta)} |`,
    `| Near-Complete sessions | ${report.workbookReference.nearCompleteSessions} | ${report.totals.nearCompleteSessions} | ${signed(report.workbookReference.nearCompleteSessionDelta)} |`,
    "",
    "Differences are surfaced rather than silently tuned away. 1.03 uses deterministic source-label grouping and provisional local track-title keys; canonical album/edition/track resolution remains the responsibility of later catalog stages.",
    "",
    "## Privacy and product boundary",
    "",
    "Sessionization reads only the minimized 1.02 playback representation. It does not recover raw IP/device/country fields. Evidence status is historical evidence only; default Library membership remains a separate derived decision.",
  ].join("\n");
}

function buildSessionRuns(events: NormalizedPlaybackEventInput[]): {
  runs: SessionRun[];
  zeroMsEvents: number;
  zeroMsEventsInRuns: number;
  zeroMsEventsIgnored: number;
} {
  const runs: SessionRun[] = [];
  let current: SessionRun | null = null;
  let zeroMsEvents = 0;
  let zeroMsEventsInRuns = 0;
  let zeroMsEventsIgnored = 0;

  for (const event of events) {
    const endMs = parsePlayedAt(event);
    const startMs = endMs - event.ms_played;
    const albumIdentity = albumIdentityFor(event.artist_name, event.album_name);

    if (event.ms_played === 0) {
      zeroMsEvents += 1;
      if (
        current &&
        current.albumIdentity.key === albumIdentity.key &&
        endMs - current.lastEventEndMs <= SESSION_GAP_MS
      ) {
        current.events.push(event);
        current.lastEventEndMs = Math.max(current.lastEventEndMs, endMs);
        current.endedAtMs = Math.max(current.endedAtMs, endMs);
        zeroMsEventsInRuns += 1;
      } else {
        zeroMsEventsIgnored += 1;
      }
      continue;
    }

    if (!current) {
      current = newRun(albumIdentity, event, startMs, endMs);
      continue;
    }

    const albumChanged = current.albumIdentity.key !== albumIdentity.key;
    const gapExceeded = endMs - current.lastEventEndMs > SESSION_GAP_MS;

    if (albumChanged || gapExceeded) {
      runs.push(current);
      current = newRun(albumIdentity, event, startMs, endMs);
      continue;
    }

    current.events.push(event);
    current.lastEventEndMs = Math.max(current.lastEventEndMs, endMs);
    current.endedAtMs = Math.max(current.endedAtMs, endMs);
  }

  if (current) runs.push(current);
  return { runs, zeroMsEvents, zeroMsEventsInRuns, zeroMsEventsIgnored };
}

function newRun(
  albumIdentity: AlbumIdentity,
  event: NormalizedPlaybackEventInput,
  startMs: number,
  endMs: number,
): SessionRun {
  return {
    albumIdentity,
    events: [event],
    startedAtMs: startMs,
    endedAtMs: endMs,
    lastEventEndMs: endMs,
  };
}

function classifyRun(options: {
  run: SessionRun;
  knownTrackKeys: Set<string>;
  display: { artistName: string; albumName: string };
  importBatchId: string;
}): ClassifiedRun {
  const sessionTrackKeys = orderedUnique(options.run.events.map((event) => trackKey(event.track_name)));
  const meaningfulEvents = options.run.events.filter((event) => event.ms_played >= MEANINGFUL_PLAY_MS);
  const meaningfulTrackKeys = sortedUnique(meaningfulEvents.map((event) => trackKey(event.track_name)));
  const credibleTrackKeys = sortedUnique(
    meaningfulEvents
      .filter((event) => event.skipped !== true)
      .map((event) => trackKey(event.track_name)),
  );
  const trackdoneTrackKeys = sortedUnique(
    options.run.events
      .filter((event) => event.reason_end === "trackdone")
      .map((event) => trackKey(event.track_name)),
  );
  const credibleKnown = credibleTrackKeys.filter((key) => options.knownTrackKeys.has(key));
  const missingLocalTrackKeys = [...options.knownTrackKeys]
    .filter((key) => !credibleTrackKeys.includes(key))
    .sort();
  const knownCount = options.knownTrackKeys.size;
  const coverage = knownCount === 0 ? 0 : credibleKnown.length / knownCount;
  const reviewReasons: string[] = [];

  let evidenceStatus: SessionEvidenceStatus;
  if (knownCount >= MIN_LOCAL_TRACKS && credibleKnown.length === knownCount) {
    evidenceStatus = "full";
  } else if (
    knownCount >= MIN_LOCAL_TRACKS &&
    coverage >= NEAR_COMPLETE_MIN_COVERAGE &&
    missingLocalTrackKeys.length <= NEAR_COMPLETE_MAX_MISSING
  ) {
    evidenceStatus = "near_complete";
  } else if (credibleKnown.length <= 1) {
    evidenceStatus = "sparse";
  } else {
    evidenceStatus = "review";
  }

  if (knownCount < MIN_LOCAL_TRACKS) reviewReasons.push("insufficient_local_trackset");
  if (evidenceStatus === "review" && knownCount >= MIN_LOCAL_TRACKS) {
    reviewReasons.push("below_near_complete_threshold");
  }
  if (options.run.events.some((event) => event.track_identity_status !== "spotify")) {
    reviewReasons.push("non_spotify_track_identity_present");
  }

  const eventIds = options.run.events.map((event) => event.event_id);
  const sessionId = createStableId("ses", {
    source_album_key: options.run.albumIdentity.sourceAlbumKey,
    event_ids: eventIds,
  });

  return {
    albumIdentityKey: options.run.albumIdentity.key,
    session: {
      session_id: sessionId,
      source_album_key: options.run.albumIdentity.sourceAlbumKey,
      import_batch_id: options.importBatchId,
      artist_name: options.display.artistName,
      album_name: options.display.albumName,
      started_at: new Date(options.run.startedAtMs).toISOString(),
      ended_at: new Date(options.run.endedAtMs).toISOString(),
      session_minutes: round((options.run.endedAtMs - options.run.startedAtMs) / 60_000, 3),
      event_count: options.run.events.length,
      positive_event_count: options.run.events.filter((event) => event.ms_played > 0).length,
      meaningful_event_count: meaningfulEvents.length,
      evidence_status: evidenceStatus,
      known_local_tracks: knownCount,
      meaningful_unique_tracks: meaningfulTrackKeys.length,
      credible_unique_tracks: credibleKnown.length,
      trackdone_unique_tracks: trackdoneTrackKeys.filter((key) => options.knownTrackKeys.has(key)).length,
      local_coverage: round(coverage, 4),
      missing_local_track_count: missingLocalTrackKeys.length,
      session_track_keys: sessionTrackKeys,
      meaningful_track_keys: meaningfulTrackKeys,
      credible_track_keys: credibleTrackKeys,
      trackdone_track_keys: trackdoneTrackKeys,
      missing_local_track_keys: missingLocalTrackKeys,
      event_ids: eventIds,
      review_reasons: sortedUnique(reviewReasons),
    },
  };
}

function buildKnownTrackSets(events: NormalizedPlaybackEventInput[]): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>();
  for (const event of events) {
    if (event.ms_played < MEANINGFUL_PLAY_MS) continue;
    const identity = albumIdentityFor(event.artist_name, event.album_name);
    const set = result.get(identity.key) ?? new Set<string>();
    set.add(trackKey(event.track_name));
    result.set(identity.key, set);
  }
  return result;
}

function buildAlbumDisplayCounts(
  events: NormalizedPlaybackEventInput[],
): Map<string, Map<string, { artistName: string; albumName: string; count: number }>> {
  const result = new Map<
    string,
    Map<string, { artistName: string; albumName: string; count: number }>
  >();
  for (const event of events) {
    const identity = albumIdentityFor(event.artist_name, event.album_name);
    const displays = result.get(identity.key) ?? new Map();
    const displayKey = `${event.artist_name}\u241f${event.album_name}`;
    const existing = displays.get(displayKey);
    displays.set(displayKey, {
      artistName: event.artist_name,
      albumName: event.album_name,
      count: (existing?.count ?? 0) + 1,
    });
    result.set(identity.key, displays);
  }
  return result;
}

function chooseAlbumDisplay(
  displays: Map<string, { artistName: string; albumName: string; count: number }> | undefined,
): { artistName: string; albumName: string } {
  if (!displays || displays.size === 0) return { artistName: "Unknown Artist", albumName: "Unknown Album" };
  const best = [...displays.values()].sort(
    (left, right) =>
      right.count - left.count ||
      left.artistName.localeCompare(right.artistName) ||
      left.albumName.localeCompare(right.albumName),
  )[0];
  return { artistName: best.artistName, albumName: best.albumName };
}

function buildProvisionalAlbums(options: {
  sessions: AlbumSession[];
  candidateAlbumKeys: Set<string>;
  knownTracks: Map<string, Set<string>>;
  albumDisplays: Map<string, Map<string, { artistName: string; albumName: string; count: number }>>;
}): ProvisionalAlbum[] {
  const sessionsBySourceKey = new Map<string, AlbumSession[]>();
  const identityBySourceKey = new Map<string, string>();

  for (const identityKey of options.candidateAlbumKeys) {
    identityBySourceKey.set(sourceAlbumKey(identityKey), identityKey);
  }
  for (const session of options.sessions) {
    const bucket = sessionsBySourceKey.get(session.source_album_key) ?? [];
    bucket.push(session);
    sessionsBySourceKey.set(session.source_album_key, bucket);
  }

  const albums: ProvisionalAlbum[] = [];
  for (const [sourceKey, identityKey] of identityBySourceKey) {
    const albumSessions = (sessionsBySourceKey.get(sourceKey) ?? []).sort(compareSessions);
    if (albumSessions.length === 0) continue;
    const counts = countStatuses(albumSessions);
    const display = chooseAlbumDisplay(options.albumDisplays.get(identityKey));
    albums.push({
      source_album_key: sourceKey,
      artist_name: display.artistName,
      album_name: display.albumName,
      known_local_track_count: options.knownTracks.get(identityKey)?.size ?? 0,
      known_local_track_keys: [...(options.knownTracks.get(identityKey) ?? new Set<string>())].sort(),
      qualifying_session_count: counts.full + counts.near_complete,
      full_session_count: counts.full,
      near_complete_session_count: counts.near_complete,
      sparse_session_count: counts.sparse,
      review_session_count: counts.review,
      first_session_at: albumSessions[0].started_at,
      last_session_at: albumSessions[albumSessions.length - 1].ended_at,
    });
  }

  return albums.sort(
    (left, right) =>
      left.artist_name.localeCompare(right.artist_name) ||
      left.album_name.localeCompare(right.album_name) ||
      left.source_album_key.localeCompare(right.source_album_key),
  );
}

function validateStageTwoContract(artifacts: StageTwoArtifacts): void {
  if (!artifacts.report.ok) {
    throw new Error("1.02 artifact contract error: normalization report is not passing.");
  }
  if (artifacts.report.totals.normalizedEvents !== artifacts.events.length) {
    throw new Error(
      "1.02 artifact contract error: normalized event count does not match normalized-playback-events.json.",
    );
  }
  const seen = new Set<string>();
  for (const event of artifacts.events) {
    if (event.import_batch_id !== artifacts.report.importBatchId) {
      throw new Error(`1.02 artifact contract error: event ${event.event_id} has the wrong import batch.`);
    }
    if (seen.has(event.event_id)) {
      throw new Error(`1.02 artifact contract error: duplicate normalized event_id ${event.event_id}.`);
    }
    seen.add(event.event_id);
  }
}

function albumIdentityFor(artistName: string, albumName: string): AlbumIdentity {
  const key = `${normalizeLabel(artistName)}\u241f${normalizeLabel(albumName)}`;
  return { key, sourceAlbumKey: sourceAlbumKey(key) };
}

function sourceAlbumKey(identityKey: string): string {
  return createStableId("alb", identityKey);
}

export function normalizeLabel(value: string): string {
  return asciiFold(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function trackKey(value: string): string {
  const withoutRemasterSuffix = asciiFold(value).replace(
    /\s*[-–—(]\s*(?:\d{4}\s+)?remaster(?:ed)?(?:\s+\d{4})?\s*\)?\s*$/i,
    "",
  );
  return withoutRemasterSuffix.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function asciiFold(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .trim();
}

function parsePlayedAt(event: NormalizedPlaybackEventInput): number {
  const value = Date.parse(event.played_at);
  if (Number.isNaN(value)) {
    throw new Error(`1.02 artifact contract error: event ${event.event_id} has invalid played_at.`);
  }
  if (!Number.isInteger(event.ms_played) || event.ms_played < 0) {
    throw new Error(`1.02 artifact contract error: event ${event.event_id} has invalid ms_played.`);
  }
  return value;
}

function compareEvents(left: NormalizedPlaybackEventInput, right: NormalizedPlaybackEventInput): number {
  if (left.played_at !== right.played_at) return left.played_at < right.played_at ? -1 : 1;
  return left.event_id.localeCompare(right.event_id);
}

function compareSessions(left: AlbumSession, right: AlbumSession): number {
  if (left.started_at !== right.started_at) return left.started_at < right.started_at ? -1 : 1;
  return left.session_id.localeCompare(right.session_id);
}

function countStatuses(sessions: AlbumSession[]): Record<SessionEvidenceStatus, number> {
  const counts: Record<SessionEvidenceStatus, number> = {
    full: 0,
    near_complete: 0,
    sparse: 0,
    review: 0,
  };
  for (const session of sessions) counts[session.evidence_status] += 1;
  return counts;
}

function orderedUnique(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

function sortedUnique(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function createStableId(prefix: string, value: unknown): string {
  const payload = typeof value === "string" ? value : JSON.stringify(value);
  return `${prefix}_${createHash("sha256").update(payload).digest("hex").slice(0, 32)}`;
}

function round(value: number, digits: number): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

async function readJson(filePath: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as unknown;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "unknown read/parse failure";
    throw new Error(`Unable to read sessionization input ${path.basename(filePath)}: ${message}`);
  }
}

function assertNormalizationReport(value: unknown): asserts value is PlaybackNormalizationReportInput {
  if (
    !isRecord(value) ||
    typeof value.importBatchId !== "string" ||
    typeof value.ok !== "boolean" ||
    !isRecord(value.totals) ||
    !Number.isInteger(value.totals.normalizedEvents)
  ) {
    throw new Error("1.02 artifact contract error: invalid normalization-report.json shape.");
  }
}

function assertNormalizedEvents(value: unknown): asserts value is NormalizedPlaybackEventInput[] {
  if (!Array.isArray(value)) {
    throw new Error("1.02 artifact contract error: normalized-playback-events.json must be an array.");
  }
  for (let index = 0; index < value.length; index += 1) {
    const event = value[index];
    if (
      !isRecord(event) ||
      typeof event.event_id !== "string" ||
      typeof event.import_batch_id !== "string" ||
      typeof event.played_at !== "string" ||
      !Number.isInteger(event.ms_played) ||
      typeof event.track_name !== "string" ||
      typeof event.artist_name !== "string" ||
      typeof event.album_name !== "string" ||
      !(event.skipped === null || typeof event.skipped === "boolean") ||
      !(event.reason_end === null || typeof event.reason_end === "string") ||
      !["spotify", "metadata_only", "unparseable_spotify_uri"].includes(
        event.track_identity_status as string,
      )
    ) {
      throw new Error(`1.02 artifact contract error: invalid normalized event at row ${index + 1}.`);
    }
  }
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function jsonWithNewline(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}
