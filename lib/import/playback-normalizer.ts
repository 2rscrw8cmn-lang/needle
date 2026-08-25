import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  ImportManifest,
  ImportReport,
  MinimizedMusicRow,
} from "./history-validator.ts";

export type TrackIdentityStatus =
  | "spotify"
  | "metadata_only"
  | "unparseable_spotify_uri";

export interface PlaybackSourceRef {
  file: string;
  row: number;
}

export interface NormalizedPlaybackEvent {
  event_id: string;
  import_batch_id: string;
  played_at: string;
  ms_played: number;
  spotify_track_id: string | null;
  source_spotify_track_uri: string | null;
  track_identity_status: TrackIdentityStatus;
  track_name: string;
  artist_name: string;
  album_name: string;
  reason_start: string | null;
  reason_end: string | null;
  skipped: boolean | null;
  source_refs: PlaybackSourceRef[];
}

export interface PlaybackNormalizationReport {
  reportVersion: 1;
  normalizationVersion: 1;
  importBatchId: string;
  ok: boolean;
  totals: {
    validatedMusicRows: number;
    normalizedEvents: number;
    duplicatesCollapsed: number;
    duplicateGroups: number;
    spotifyIdentityEvents: number;
    metadataOnlyEvents: number;
    unparseableSpotifyUriEvents: number;
  };
  reconciliation: {
    acceptedRowsFromValidation: number;
    validatedMusicRows: number;
    normalizedPlusDuplicates: number;
    matchesValidationReport: boolean;
    balances: boolean;
  };
}

export interface PlaybackNormalization {
  events: NormalizedPlaybackEvent[];
  report: PlaybackNormalizationReport;
}

export interface StageOneArtifacts {
  manifest: ImportManifest;
  report: ImportReport;
  validatedMusic: MinimizedMusicRow[];
}

interface EventPayload {
  played_at: string;
  ms_played: number;
  spotify_track_id: string | null;
  source_spotify_track_uri: string | null;
  track_identity_status: TrackIdentityStatus;
  track_name: string;
  artist_name: string;
  album_name: string;
  reason_start: string | null;
  reason_end: string | null;
  skipped: boolean | null;
}

export async function readStageOneArtifacts(inputDir: string): Promise<StageOneArtifacts> {
  const [manifestRaw, reportRaw, validatedRaw] = await Promise.all([
    readJson(path.join(inputDir, "import-manifest.json")),
    readJson(path.join(inputDir, "import-report.json")),
    readJson(path.join(inputDir, "validated-music.json")),
  ]);

  assertManifest(manifestRaw);
  assertImportReport(reportRaw);
  assertValidatedMusicRows(validatedRaw);

  return {
    manifest: manifestRaw,
    report: reportRaw,
    validatedMusic: validatedRaw,
  };
}

export function normalizePlaybackEvents(artifacts: StageOneArtifacts): PlaybackNormalization {
  validateStageOneReconciliation(artifacts);

  const manifestRows = new Map(
    artifacts.manifest.files.map((file) => [file.name, file.rowCount] as const),
  );
  const bySignature = new Map<
    string,
    { payload: EventPayload; sourceRefs: PlaybackSourceRef[] }
  >();

  for (const row of artifacts.validatedMusic) {
    validateSourceRef(row, manifestRows);
    const payload = normalizeRow(row);
    const signature = stableSignature(payload);
    const existing = bySignature.get(signature);
    const sourceRef = { file: row.source_file, row: row.source_row };

    if (existing) {
      existing.sourceRefs.push(sourceRef);
      continue;
    }

    bySignature.set(signature, {
      payload,
      sourceRefs: [sourceRef],
    });
  }

  const events = [...bySignature.entries()]
    .map(([signature, entry]) => ({
      event_id: createEventId(signature),
      import_batch_id: artifacts.manifest.batchId,
      ...entry.payload,
      source_refs: entry.sourceRefs.sort(compareSourceRefs),
    }))
    .sort(compareEvents);

  const duplicateGroups = events.filter((event) => event.source_refs.length > 1).length;
  const duplicatesCollapsed = artifacts.validatedMusic.length - events.length;
  const spotifyIdentityEvents = events.filter(
    (event) => event.track_identity_status === "spotify",
  ).length;
  const metadataOnlyEvents = events.filter(
    (event) => event.track_identity_status === "metadata_only",
  ).length;
  const unparseableSpotifyUriEvents = events.filter(
    (event) => event.track_identity_status === "unparseable_spotify_uri",
  ).length;
  const acceptedRowsFromValidation = artifacts.report.totals.acceptedMusicRows;
  const normalizedPlusDuplicates = events.length + duplicatesCollapsed;
  const matchesValidationReport =
    acceptedRowsFromValidation === artifacts.validatedMusic.length;
  const balances = normalizedPlusDuplicates === artifacts.validatedMusic.length;

  return {
    events,
    report: {
      reportVersion: 1,
      normalizationVersion: 1,
      importBatchId: artifacts.manifest.batchId,
      ok: matchesValidationReport && balances,
      totals: {
        validatedMusicRows: artifacts.validatedMusic.length,
        normalizedEvents: events.length,
        duplicatesCollapsed,
        duplicateGroups,
        spotifyIdentityEvents,
        metadataOnlyEvents,
        unparseableSpotifyUriEvents,
      },
      reconciliation: {
        acceptedRowsFromValidation,
        validatedMusicRows: artifacts.validatedMusic.length,
        normalizedPlusDuplicates,
        matchesValidationReport,
        balances,
      },
    },
  };
}

export async function writePlaybackNormalization(options: {
  outputDir: string;
  normalization: PlaybackNormalization;
}): Promise<void> {
  await mkdir(options.outputDir, { recursive: true });
  await Promise.all([
    writeFile(
      path.join(options.outputDir, "normalized-playback-events.json"),
      jsonWithNewline(options.normalization.events),
      "utf8",
    ),
    writeFile(
      path.join(options.outputDir, "normalization-report.json"),
      jsonWithNewline(options.normalization.report),
      "utf8",
    ),
    writeFile(
      path.join(options.outputDir, "normalization-report.md"),
      `${renderPlaybackNormalizationMarkdown(options.normalization.report)}\n`,
      "utf8",
    ),
  ]);
}

export function renderPlaybackNormalizationMarkdown(
  report: PlaybackNormalizationReport,
): string {
  return [
    "# Needle Playback Event Normalization",
    "",
    `- Import batch: \`${report.importBatchId}\``,
    `- Result: **${report.ok ? "PASS" : "FAIL"}**`,
    "",
    "## Counts",
    "",
    "| Metric | Count |",
    "| --- | ---: |",
    `| Validated music rows | ${report.totals.validatedMusicRows} |`,
    `| Normalized playback events | ${report.totals.normalizedEvents} |`,
    `| Duplicate rows collapsed | ${report.totals.duplicatesCollapsed} |`,
    `| Duplicate event groups | ${report.totals.duplicateGroups} |`,
    `| Events with Spotify track ID | ${report.totals.spotifyIdentityEvents} |`,
    `| Metadata-only events | ${report.totals.metadataOnlyEvents} |`,
    `| Unparseable Spotify URI events | ${report.totals.unparseableSpotifyUriEvents} |`,
    "",
    "## Reconciliation",
    "",
    `- Accepted rows reported by 1.01: ${report.reconciliation.acceptedRowsFromValidation}`,
    `- Rows in \`validated-music.json\`: ${report.reconciliation.validatedMusicRows}`,
    `- Normalized events + collapsed duplicates: ${report.reconciliation.normalizedPlusDuplicates}`,
    `- 1.01 count matches: **${report.reconciliation.matchesValidationReport ? "yes" : "no"}**`,
    `- Normalization balances: **${report.reconciliation.balances ? "yes" : "no"}**`,
    "",
    "## Duplicate rule",
    "",
    "Needle collapses only exact playback-event duplicates. Two rows must match on canonical UTC timestamp, milliseconds played, Spotify URI/ID state, track name, artist name, album name, reason start/end, and skipped state. Source file/row references from every duplicate are preserved on the surviving event.",
    "",
    "The stable `event_id` is derived from that event payload and intentionally excludes import-batch/source provenance, so the same historical event receives the same ID on a later reimport.",
    "",
    "## Privacy",
    "",
    "Normalized playback events contain only playback/sessionization fields plus import/source provenance. Raw IP address, device/platform, country, offline, incognito, podcast, and audiobook metadata cannot enter this stage through the 1.01 validated-music contract.",
  ].join("\n");
}

function normalizeRow(row: MinimizedMusicRow): EventPayload {
  assertNonEmptyString(row.ts, "ts", row.source_file, row.source_row);
  assertInteger(row.ms_played, "ms_played", row.source_file, row.source_row);
  assertNonEmptyString(
    row.master_metadata_track_name,
    "master_metadata_track_name",
    row.source_file,
    row.source_row,
  );
  assertNonEmptyString(
    row.master_metadata_album_artist_name,
    "master_metadata_album_artist_name",
    row.source_file,
    row.source_row,
  );
  assertNonEmptyString(
    row.master_metadata_album_album_name,
    "master_metadata_album_album_name",
    row.source_file,
    row.source_row,
  );
  assertNullableString(
    row.spotify_track_uri,
    "spotify_track_uri",
    row.source_file,
    row.source_row,
  );
  assertNullableString(row.reason_start, "reason_start", row.source_file, row.source_row);
  assertNullableString(row.reason_end, "reason_end", row.source_file, row.source_row);
  assertNullableBoolean(row.skipped, "skipped", row.source_file, row.source_row);

  const playedAtMs = Date.parse(row.ts);
  if (Number.isNaN(playedAtMs)) {
    throw contractError(row.source_file, row.source_row, "invalid timestamp");
  }

  const uri = row.spotify_track_uri;
  const spotifyTrackId = spotifyTrackIdFromUri(uri);
  const trackIdentityStatus: TrackIdentityStatus = spotifyTrackId
    ? "spotify"
    : uri === null
      ? "metadata_only"
      : "unparseable_spotify_uri";

  return {
    played_at: new Date(playedAtMs).toISOString(),
    ms_played: row.ms_played,
    spotify_track_id: spotifyTrackId,
    source_spotify_track_uri: uri,
    track_identity_status: trackIdentityStatus,
    track_name: row.master_metadata_track_name,
    artist_name: row.master_metadata_album_artist_name,
    album_name: row.master_metadata_album_album_name,
    reason_start: row.reason_start,
    reason_end: row.reason_end,
    skipped: row.skipped,
  };
}

function validateStageOneReconciliation(artifacts: StageOneArtifacts): void {
  if (artifacts.manifest.batchId !== artifacts.report.batchId) {
    throw new Error("1.01 artifact contract error: manifest/report batch IDs do not match.");
  }
  if (!artifacts.report.ok) {
    throw new Error("1.01 artifact contract error: validation report is not passing.");
  }
  if (artifacts.report.totals.acceptedMusicRows !== artifacts.validatedMusic.length) {
    throw new Error(
      "1.01 artifact contract error: accepted music count does not match validated-music.json.",
    );
  }
}

function validateSourceRef(
  row: MinimizedMusicRow,
  manifestRows: Map<string, number>,
): void {
  const rowCount = manifestRows.get(row.source_file);
  if (rowCount === undefined) {
    throw contractError(row.source_file, row.source_row, "source file is not in import manifest");
  }
  if (!Number.isInteger(row.source_row) || row.source_row < 1 || row.source_row > rowCount) {
    throw contractError(row.source_file, row.source_row, "source row is outside manifest bounds");
  }
}

function stableSignature(payload: EventPayload): string {
  return JSON.stringify(payload);
}

function createEventId(signature: string): string {
  return `evt_${createHash("sha256").update(signature).digest("hex").slice(0, 32)}`;
}

function spotifyTrackIdFromUri(uri: string | null): string | null {
  if (uri === null) return null;
  const match = /^spotify:track:([A-Za-z0-9]+)$/.exec(uri);
  return match?.[1] ?? null;
}

function compareEvents(left: NormalizedPlaybackEvent, right: NormalizedPlaybackEvent): number {
  if (left.played_at !== right.played_at) {
    return left.played_at < right.played_at ? -1 : 1;
  }
  return left.event_id.localeCompare(right.event_id);
}

function compareSourceRefs(left: PlaybackSourceRef, right: PlaybackSourceRef): number {
  const byFile = compareNatural(left.file, right.file);
  return byFile === 0 ? left.row - right.row : byFile;
}

function compareNatural(left: string, right: string): number {
  const leftParts = left.match(/\d+|\D+/g) ?? [left];
  const rightParts = right.match(/\d+|\D+/g) ?? [right];
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const leftPart = leftParts[index];
    const rightPart = rightParts[index];
    if (leftPart === undefined) return -1;
    if (rightPart === undefined) return 1;
    if (leftPart === rightPart) continue;

    const leftNumber = /^\d+$/.test(leftPart) ? Number(leftPart) : null;
    const rightNumber = /^\d+$/.test(rightPart) ? Number(rightPart) : null;
    if (leftNumber !== null && rightNumber !== null && leftNumber !== rightNumber) {
      return leftNumber - rightNumber;
    }
    return leftPart < rightPart ? -1 : 1;
  }

  return 0;
}

async function readJson(filePath: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as unknown;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "unknown read/parse failure";
    throw new Error(`Unable to read normalization input ${path.basename(filePath)}: ${message}`);
  }
}

function assertManifest(value: unknown): asserts value is ImportManifest {
  if (!isRecord(value) || typeof value.batchId !== "string" || !Array.isArray(value.files)) {
    throw new Error("1.01 artifact contract error: invalid import-manifest.json shape.");
  }
  for (const file of value.files) {
    if (
      !isRecord(file) ||
      typeof file.name !== "string" ||
      !Number.isInteger(file.rowCount) ||
      (file.rowCount as number) < 0
    ) {
      throw new Error("1.01 artifact contract error: invalid manifest file entry.");
    }
  }
}

function assertImportReport(value: unknown): asserts value is ImportReport {
  if (
    !isRecord(value) ||
    typeof value.batchId !== "string" ||
    typeof value.ok !== "boolean" ||
    !isRecord(value.totals) ||
    !Number.isInteger(value.totals.acceptedMusicRows)
  ) {
    throw new Error("1.01 artifact contract error: invalid import-report.json shape.");
  }
}

function assertValidatedMusicRows(value: unknown): asserts value is MinimizedMusicRow[] {
  if (!Array.isArray(value)) {
    throw new Error("1.01 artifact contract error: validated-music.json must be an array.");
  }
  for (let index = 0; index < value.length; index += 1) {
    const row = value[index];
    if (!isRecord(row)) {
      throw new Error(`1.01 artifact contract error: validated music row ${index + 1} is not an object.`);
    }
    if (typeof row.source_file !== "string" || !Number.isInteger(row.source_row)) {
      throw new Error(`1.01 artifact contract error: validated music row ${index + 1} lacks provenance.`);
    }
  }
}

function assertNonEmptyString(
  value: unknown,
  field: string,
  file: string,
  row: number,
): asserts value is string {
  if (typeof value !== "string" || value.length === 0) {
    throw contractError(file, row, `invalid ${field}`);
  }
}

function assertNullableString(
  value: unknown,
  field: string,
  file: string,
  row: number,
): asserts value is string | null {
  if (value !== null && typeof value !== "string") {
    throw contractError(file, row, `invalid ${field}`);
  }
}

function assertNullableBoolean(
  value: unknown,
  field: string,
  file: string,
  row: number,
): asserts value is boolean | null {
  if (value !== null && typeof value !== "boolean") {
    throw contractError(file, row, `invalid ${field}`);
  }
}

function assertInteger(
  value: unknown,
  field: string,
  file: string,
  row: number,
): asserts value is number {
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw contractError(file, row, `invalid ${field}`);
  }
}

function contractError(file: string, row: number, reason: string): Error {
  return new Error(`1.01 artifact contract error at ${file} row ${row}: ${reason}.`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function jsonWithNewline(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}
