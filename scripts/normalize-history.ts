import path from "node:path";
import {
  normalizePlaybackEvents,
  readStageOneArtifacts,
  renderPlaybackNormalizationMarkdown,
  writePlaybackNormalization,
} from "../lib/import/playback-normalizer.ts";

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function printHelp(): void {
  console.log(`Needle playback-event normalizer

Usage:
  npm run history:normalize -- [options]

Options:
  --input <dir>   1.01 artifact directory (default: data/history/.needle)
  --output <dir>  Normalized output directory (default: same as --input)
  --help          Show this help
`);
}

async function main(): Promise<void> {
  if (process.argv.includes("--help")) {
    printHelp();
    return;
  }

  const inputDir = path.resolve(argValue("--input") ?? "data/history/.needle");
  const outputDir = path.resolve(argValue("--output") ?? inputDir);

  const artifacts = await readStageOneArtifacts(inputDir);
  const normalization = normalizePlaybackEvents(artifacts);
  await writePlaybackNormalization({ outputDir, normalization });

  console.log(renderPlaybackNormalizationMarkdown(normalization.report));
  console.log(`\nPrivate normalized outputs written to ${outputDir}`);

  if (!normalization.report.ok) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown playback normalization error";
  console.error(`Needle playback normalization failed: ${message}`);
  process.exitCode = 1;
});
