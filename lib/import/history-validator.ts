import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const SOURCE_FILE_PATTERN = /^Streaming_History_Audio_.*\.json$/;
export const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

export const EXPECTED_SOURCE_FIELDS = [
  "ts",
  "platform",
  "ms_played",
  "conn_country",
  "ip_addr",
  "master_metadata_track_name",
  "master_metadata_album_artist_name",
  "master_metadata_album_album_name",
  "spotify_track_uri",
  "episode_name",
  "episode_show_name",
  "spotify_episode_uri",
  "audiobook_title",
  "audiobook_uri",
  "audiobook_chapter_uri",
  "audiobook_chapter_title",
  "reason_start",
  "reason_end",
  "shuffle",
  "skipped",
  "offline",
  "offline_timestamp",
  "incognito_mode",
].sort();

const EXPECTED_SOURCE_FIELD_SET = new Set(EXPECTED_SOURCE_FIELDS);
const REQUIRED_BASE_FIELDS = ["ts", "ms_played"] as const;
const RETAINED_OPTIONAL_STRING_FIELDS = [
  "spotify_track_uri",
  "reason_start",
  "reason_end",
] as const;

export type ContentKind = "music" | "podcast" | "audiobook" | "unknown" | "mixed";
export type SourceFileStatus = "ok" | "invalid_json" | "invalid_shape";

export interface MinimizedMusicRow {
  source_file: string;
  source_row: number;
  ts: string;
  ms_played: number;
  master_metadata_track_name: string;
  master_metadata_album_artist_name: string;
  master_metadata_album_album_name: string;
  spotify_track_uri: string | null;
  reason_start: string | null;
  reason_end: string | null;
  skipped: boolean | null;
}

export interface QuarantineEntry {
  file: string;
  row: number;
  category: ContentKind;
  reasons: string[];
}

export interface NullRateChange {
  field: string;
  baseline: number;
  current: number;
  delta: number;
}

export interface SourceFileReport {
  order: number;
  name: string;
  bytes: number;
  sha256: string;
  status: SourceFileStatus;
  rawRows: number;
  musicRows: number;
  podcastRows: number;
  audiobookRows: number;
  unknownRows: number;
  mixedRows: number;
  acceptedMusicRows: number;
  excludedNonMusicRows: number;
  quarantinedRows: number;
  observedFields: string[];
  missingExpectedFields: string[];
  unexpectedFields: string[];
  nullRates: Record<string, number>;
  schemaAddedFields: string[];
  schemaRemovedFields: string[];
  nullRateChanges: NullRateChange[];
}

export interface ImportManifest {
  manifestVersion: 1;
  batchId: string;
  sourcePattern: string;
  files: Array<{
    order: number;
    name: string;
    bytes: number;
    sha256: string;
    status: SourceFileStatus;
    rowCount: number;
  }>;
}

export interface ImportReport {
  reportVersion: 1;
  batchId: string;
  validationAsOf: string;
  futureToleranceMs: number;
  ok: boolean;
  totals: {
    sourceFiles: number;
    fatalFiles: number;
    rawRows: number;
    musicRows: number;
    podcastRows: number;
    audiobookRows: number;
    unknownRows: number;
    mixedRows: number;
    acceptedMusicRows: number;
    excludedNonMusicRows: number;
    quarantinedRows: number;
  };
  schema: {
    baselineFile: string | null;
    filesWithSchemaDrift: number;
    filesWithNullRateChanges: number;
    unexpectedFields: string[];
  };
  quarantineReasons: Record<string, number>;
  files: SourceFileReport[];
}

export interface ImportAnalysis {
  manifest: ImportManifest;
  report: ImportReport;
  validatedMusic: MinimizedMusicRow[];
  quarantine: QuarantineEntry[];
}

interface MutableFileAnalysis {
  name: string;
  bytes: number;
  sha256: string;
  status: SourceFileStatus;
  rawRows: number;
  musicRows: number;
  podcastRows: number;
  audiobookRows: number;
  unknownRows: number;
  mixedRows: number;
  acceptedMusicRows: number;
  excludedNonMusicRows: number;
  quarantinedRows: number;
  observedFields: string[];
  missingExpectedFields: string[];
  unexpectedFields: string[];
  nullRates: Record<string, number>;
  validatedMusic: MinimizedMusicRow[];
  quarantine: QuarantineEntry[];
}

type CountField =
  | "rawRows"
  | "musicRows"
  | "podcastRows"
  | "audiobookRows"
  | "unknownRows"
  | "mixedRows"
  | "acceptedMusicRows"
  | "excludedNonMusicRows"
  | "quarantinedRows";

export async function discoverHistoryFiles(inputDir: string): Promise<string[]> {
  const entries = await readdir(inputDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && SOURCE_FILE_PATTERN.test(entry.name))
    .map((entry) => entry.name)
    .sort(compareSourceFilenames);
}

export async function analyzeHistoryDirectory(options: {
  inputDir: string;
  asOf?: Date;
}): Promise<ImportAnalysis> {
  const asOf = options.asOf ?? new Date();
  if (Number.isNaN(asOf.getTime())) {
    throw new Error("Invalid validation as-of date.");
  }

  const filenames = await discoverHistoryFiles(options.inputDir);
  if (filenames.length === 0) {
    throw new Error(`No files matching ${SOURCE_FILE_PATTERN.source} found in ${options.inputDir}`);
  }

  const fileAnalyses: MutableFileAnalysis[] = [];
  for (const filename of filenames) {
    fileAnalyses.push(
      await analyzeSourceFile({
        filePath: path.join(options.inputDir, filename),
        filename,
        asOf,
      }),
    );
  }

  const baseline = fileAnalyses.find((file) => file.status === "ok") ?? null;
  const files: SourceFileReport[] = fileAnalyses.map((file, index) => {
    const schemaAddedFields = baseline
      ? difference(file.observedFields, baseline.observedFields)
      : [];
    const schemaRemovedFields = baseline
      ? difference(baseline.observedFields, file.observedFields)
      : [];
    const nullRateChanges = baseline
      ? compareNullRates(baseline.nullRates, file.nullRates)
      : [];

    return {
      order: index + 1,
      name: file.name,
      bytes: file.bytes,
      sha256: file.sha256,
      status: file.status,
      rawRows: file.rawRows,
      musicRows: file.musicRows,
      podcastRows: file.podcastRows,
      audiobookRows: file.audiobookRows,
      unknownRows: file.unknownRows,
      mixedRows: file.mixedRows,
      acceptedMusicRows: file.acceptedMusicRows,
      excludedNonMusicRows: file.excludedNonMusicRows,
      quarantinedRows: file.quarantinedRows,
      observedFields: file.observedFields,
      missingExpectedFields: file.missingExpectedFields,
      unexpectedFields: file.unexpectedFields,
      nullRates: file.nullRates,
      schemaAddedFields,
      schemaRemovedFields,
      nullRateChanges,
    };
  });

  const batchId = createBatchId(fileAnalyses);
  const manifest: ImportManifest = {
    manifestVersion: 1,
    batchId,
    sourcePattern: SOURCE_FILE_PATTERN.source,
    files: files.map((file) => ({
      order: file.order,
      name: file.name,
      bytes: file.bytes,
      sha256: file.sha256,
      status: file.status,
      rowCount: file.rawRows,
    })),
  };

  const validatedMusic = fileAnalyses.flatMap((file) => file.validatedMusic);
  const quarantine = fileAnalyses.flatMap((file) => file.quarantine);
  const unexpectedFields = sortedUnique(files.flatMap((file) => file.unexpectedFields));
  const quarantineReasons = countQuarantineReasons(quarantine);
  const fatalFiles = files.filter((file) => file.status !== "ok").length;

  const report: ImportReport = {
    reportVersion: 1,
    batchId,
    validationAsOf: asOf.toISOString(),
    futureToleranceMs: FUTURE_TOLERANCE_MS,
    ok: fatalFiles === 0,
    totals: {
      sourceFiles: files.length,
      fatalFiles,
      rawRows: sum(files, "rawRows"),
      musicRows: sum(files, "musicRows"),
      podcastRows: sum(files, "podcastRows"),
      audiobookRows: sum(files, "audiobookRows"),
      unknownRows: sum(files, "unknownRows"),
      mixedRows: sum(files, "mixedRows"),
      acceptedMusicRows: sum(files, "acceptedMusicRows"),
      excludedNonMusicRows: sum(files, "excludedNonMusicRows"),
      quarantinedRows: sum(files, "quarantinedRows"),
    },
    schema: {
      baselineFile: baseline?.name ?? null,
      filesWithSchemaDrift: files.filter(
        (file) => file.schemaAddedFields.length > 0 || file.schemaRemovedFields.length > 0,
      ).length,
      filesWithNullRateChanges: files.filter((file) => file.nullRateChanges.length > 0).length,
      unexpectedFields,
    },
    quarantineReasons,
    files,
  };

  return { manifest, report, validatedMusic, quarantine };
}

export async function writeImportOutputs(options: {
  outputDir: string;
  analysis: ImportAnalysis;
}): Promise<void> {
  await mkdir(options.outputDir, { recursive: true });

  const files: Array<[string, string]> = [
    ["import-manifest.json", jsonWithNewline(options.analysis.manifest)],
    ["import-report.json", jsonWithNewline(options.analysis.report)],
    ["import-report.md", `${renderImportReportMarkdown(options.analysis.report)}\n`],
    ["validated-music.json", jsonWithNewline(options.analysis.validatedMusic)],
    ["quarantine.json", jsonWithNewline(options.analysis.quarantine)],
  ];

  for (const [filename, contents] of files) {
    await writeFile(path.join(options.outputDir, filename), contents, "utf8");
  }
}

export function renderImportReportMarkdown(report: ImportReport): string {
  const lines = [
    "# Needle Spotify History Validation",
    "",
    `- Batch: \`${report.batchId}\``,
    `- Validation as of: \`${report.validationAsOf}\``,
    `- Result: **${report.ok ? "PASS" : "FAIL"}**`,
    "",
    "## Totals",
    "",
    "| Metric | Count |",
    "| --- | ---: |",
    `| Source files | ${report.totals.sourceFiles} |`,
    `| Fatal files | ${report.totals.fatalFiles} |`,
    `| Raw rows | ${report.totals.rawRows} |`,
    `| Music rows | ${report.totals.musicRows} |`,
    `| Accepted music rows | ${report.totals.acceptedMusicRows} |`,
    `| Podcast rows | ${report.totals.podcastRows} |`,
    `| Audiobook rows | ${report.totals.audiobookRows} |`,
    `| Other/unknown rows | ${report.totals.unknownRows + report.totals.mixedRows} |`,
    `| Non-music rows excluded | ${report.totals.excludedNonMusicRows} |`,
    `| Rows quarantined | ${report.totals.quarantinedRows} |`,
    "",
    "## Source files",
    "",
    "| # | File | Status | Rows | Accepted music | Excluded non-music | Quarantined |",
    "| ---: | --- | --- | ---: | ---: | ---: | ---: |",
    ...report.files.map(
      (file) =>
        `| ${file.order} | \`${file.name}\` | ${file.status} | ${file.rawRows} | ${file.acceptedMusicRows} | ${file.excludedNonMusicRows} | ${file.quarantinedRows} |`,
    ),
    "",
    "## Schema diagnostics",
    "",
    `- Baseline file: ${report.schema.baselineFile ? `\`${report.schema.baselineFile}\`` : "none"}`,
    `- Files with field-set drift: ${report.schema.filesWithSchemaDrift}`,
    `- Files with null-rate changes: ${report.schema.filesWithNullRateChanges}`,
    `- Unexpected field names: ${report.schema.unexpectedFields.length > 0 ? report.schema.unexpectedFields.map((field) => `\`${field}\``).join(", ") : "none"}`,
    "",
    "Per-file field lists, null rates, and drift deltas are in `import-report.json`.",
    "",
    "## Quarantine",
    "",
  ];

  const reasonEntries = Object.entries(report.quarantineReasons);
  if (reasonEntries.length === 0) {
    lines.push("No rows were quarantined.");
  } else {
    lines.push("| Reason | Rows |", "| --- | ---: |");
    for (const [reason, count] of reasonEntries) {
      lines.push(`| \`${reason}\` | ${count} |`);
    }
    lines.push(
      "",
      "Row references only are stored in `quarantine.json`; raw private values are not copied into the report.",
    );
  }

  lines.push(
    "",
    "## Privacy",
    "",
    "The validated stream contains only the approved music-history whitelist plus source file/row provenance. IP address, platform/device, country, offline metadata, incognito metadata, and podcast/audiobook payload fields are not copied into `validated-music.json`.",
  );

  return lines.join("\n");
}

async function analyzeSourceFile(options: {
  filePath: string;
  filename: string;
  asOf: Date;
}): Promise<MutableFileAnalysis> {
  const buffer = await readFile(options.filePath);
  const bytes = buffer.byteLength;
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  const text = buffer.toString("utf8").replace(/^\uFEFF/, "");

  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    return fatalFile(options.filename, bytes, sha256, "invalid_json");
  }

  if (!Array.isArray(parsed)) {
    return fatalFile(options.filename, bytes, sha256, "invalid_shape");
  }

  const observedFields = new Set<string>();
  const nonNullCounts = new Map<string, number>();
  const validatedMusic: MinimizedMusicRow[] = [];
  const quarantine: QuarantineEntry[] = [];
  const counts = {
    music: 0,
    podcast: 0,
    audiobook: 0,
    unknown: 0,
    mixed: 0,
    excludedNonMusic: 0,
  };

  for (let rowIndex = 0; rowIndex < parsed.length; rowIndex += 1) {
    const rawRow = parsed[rowIndex];
    if (!isRecord(rawRow)) {
      counts.unknown += 1;
      quarantine.push({
        file: options.filename,
        row: rowIndex + 1,
        category: "unknown",
        reasons: ["row_not_object"],
      });
      continue;
    }

    for (const [field, value] of Object.entries(rawRow)) {
      observedFields.add(field);
      if (value !== null && value !== undefined) {
        nonNullCounts.set(field, (nonNullCounts.get(field) ?? 0) + 1);
      }
    }

    const category = classifyContent(rawRow);
    counts[category] += 1;

    const reasons = validateRow(rawRow, category, options.asOf);
    if (reasons.length > 0 || category === "unknown" || category === "mixed") {
      const allReasons = new Set(reasons);
      if (category === "unknown") allReasons.add("unclassified_content");
      if (category === "mixed") allReasons.add("mixed_content_identity");
      quarantine.push({
        file: options.filename,
        row: rowIndex + 1,
        category,
        reasons: [...allReasons].sort(),
      });
      continue;
    }

    if (category === "podcast" || category === "audiobook") {
      counts.excludedNonMusic += 1;
      continue;
    }

    validatedMusic.push(minimizeMusicRow(rawRow, options.filename, rowIndex + 1));
  }

  const observed = [...observedFields].sort();
  const allNullRateFields = sortedUnique([...EXPECTED_SOURCE_FIELDS, ...observed]);
  const nullRates = Object.fromEntries(
    allNullRateFields.map((field) => [
      field,
      parsed.length === 0
        ? 0
        : roundRate((parsed.length - (nonNullCounts.get(field) ?? 0)) / parsed.length),
    ]),
  );

  return {
    name: options.filename,
    bytes,
    sha256,
    status: "ok",
    rawRows: parsed.length,
    musicRows: counts.music,
    podcastRows: counts.podcast,
    audiobookRows: counts.audiobook,
    unknownRows: counts.unknown,
    mixedRows: counts.mixed,
    acceptedMusicRows: validatedMusic.length,
    excludedNonMusicRows: counts.excludedNonMusic,
    quarantinedRows: quarantine.length,
    observedFields: observed,
    missingExpectedFields: EXPECTED_SOURCE_FIELDS.filter((field) => !observedFields.has(field)),
    unexpectedFields: observed.filter((field) => !EXPECTED_SOURCE_FIELD_SET.has(field)),
    nullRates,
    validatedMusic,
    quarantine,
  };
}

function fatalFile(
  filename: string,
  bytes: number,
  sha256: string,
  status: Exclude<SourceFileStatus, "ok">,
): MutableFileAnalysis {
  return {
    name: filename,
    bytes,
    sha256,
    status,
    rawRows: 0,
    musicRows: 0,
    podcastRows: 0,
    audiobookRows: 0,
    unknownRows: 0,
    mixedRows: 0,
    acceptedMusicRows: 0,
    excludedNonMusicRows: 0,
    quarantinedRows: 0,
    observedFields: [],
    missingExpectedFields: [...EXPECTED_SOURCE_FIELDS],
    unexpectedFields: [],
    nullRates: {},
    validatedMusic: [],
    quarantine: [],
  };
}

function classifyContent(row: Record<string, unknown>): ContentKind {
  const hasMusic =
    hasText(row, "spotify_track_uri") ||
    hasText(row, "master_metadata_track_name") ||
    hasText(row, "master_metadata_album_artist_name") ||
    hasText(row, "master_metadata_album_album_name");
  const hasPodcast =
    hasText(row, "spotify_episode_uri") ||
    hasText(row, "episode_name") ||
    hasText(row, "episode_show_name");
  const hasAudiobook = Object.entries(row).some(
    ([field, value]) => field.startsWith("audiobook_") && hasValue(value),
  );

  const matches = [hasMusic, hasPodcast, hasAudiobook].filter(Boolean).length;
  if (matches > 1) return "mixed";
  if (hasMusic) return "music";
  if (hasPodcast) return "podcast";
  if (hasAudiobook) return "audiobook";
  return "unknown";
}

function validateRow(
  row: Record<string, unknown>,
  category: ContentKind,
  asOf: Date,
): string[] {
  const reasons: string[] = [];

  for (const field of REQUIRED_BASE_FIELDS) {
    if (!(field in row) || row[field] === null || row[field] === undefined) {
      reasons.push(`missing_required:${field}`);
    }
  }

  const timestamp = row.ts;
  if (timestamp !== null && timestamp !== undefined) {
    if (typeof timestamp !== "string" || !isUtcTimestamp(timestamp)) {
      reasons.push("invalid_timestamp");
    } else if (Date.parse(timestamp) > asOf.getTime() + FUTURE_TOLERANCE_MS) {
      reasons.push("future_timestamp");
    }
  }

  const msPlayed = row.ms_played;
  if (
    msPlayed !== null &&
    msPlayed !== undefined &&
    (typeof msPlayed !== "number" || !Number.isInteger(msPlayed) || msPlayed < 0)
  ) {
    reasons.push("invalid_ms_played");
  }

  if (category === "music") {
    for (const field of [
      "master_metadata_track_name",
      "master_metadata_album_artist_name",
      "master_metadata_album_album_name",
    ] as const) {
      if (!hasText(row, field)) reasons.push(`missing_music_field:${field}`);
    }

    for (const field of RETAINED_OPTIONAL_STRING_FIELDS) {
      const value = row[field];
      if (value !== null && value !== undefined && typeof value !== "string") {
        reasons.push(`invalid_type:${field}`);
      }
    }

    const skipped = row.skipped;
    if (skipped !== null && skipped !== undefined && typeof skipped !== "boolean") {
      reasons.push("invalid_type:skipped");
    }
  }

  return sortedUnique(reasons);
}

function minimizeMusicRow(
  row: Record<string, unknown>,
  filename: string,
  sourceRow: number,
): MinimizedMusicRow {
  return {
    source_file: filename,
    source_row: sourceRow,
    ts: row.ts as string,
    ms_played: row.ms_played as number,
    master_metadata_track_name: row.master_metadata_track_name as string,
    master_metadata_album_artist_name: row.master_metadata_album_artist_name as string,
    master_metadata_album_album_name: row.master_metadata_album_album_name as string,
    spotify_track_uri: nullableString(row.spotify_track_uri),
    reason_start: nullableString(row.reason_start),
    reason_end: nullableString(row.reason_end),
    skipped: typeof row.skipped === "boolean" ? row.skipped : null,
  };
}

function createBatchId(files: MutableFileAnalysis[]): string {
  const sourceIdentity = files.map((file) => ({
    name: file.name,
    bytes: file.bytes,
    sha256: file.sha256,
  }));
  return createHash("sha256").update(JSON.stringify(sourceIdentity)).digest("hex");
}

function countQuarantineReasons(quarantine: QuarantineEntry[]): Record<string, number> {
  const counts = new Map<string, number>();
  for (const entry of quarantine) {
    for (const reason of entry.reasons) {
      counts.set(reason, (counts.get(reason) ?? 0) + 1);
    }
  }
  return Object.fromEntries([...counts.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

function compareNullRates(
  baseline: Record<string, number>,
  current: Record<string, number>,
): NullRateChange[] {
  const fields = sortedUnique([...Object.keys(baseline), ...Object.keys(current)]);
  return fields.flatMap((field) => {
    const baselineRate = baseline[field] ?? 1;
    const currentRate = current[field] ?? 1;
    const delta = roundRate(currentRate - baselineRate);
    return delta === 0
      ? []
      : [{ field, baseline: baselineRate, current: currentRate, delta }];
  });
}

function isUtcTimestamp(value: string): boolean {
  if (!value.endsWith("Z")) return false;
  const parsed = Date.parse(value);
  return !Number.isNaN(parsed);
}

function hasText(row: Record<string, unknown>, field: string): boolean {
  const value = row[field];
  return typeof value === "string" && value.trim().length > 0;
}

function hasValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  return typeof value !== "string" || value.trim().length > 0;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function difference(left: string[], right: string[]): string[] {
  const rightSet = new Set(right);
  return left.filter((value) => !rightSet.has(value)).sort();
}

function sortedUnique(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function roundRate(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function sum(files: SourceFileReport[], field: CountField): number {
  return files.reduce((total, file) => total + file[field], 0);
}

function jsonWithNewline(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function compareSourceFilenames(left: string, right: string): number {
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
