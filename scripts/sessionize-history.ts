import path from "node:path";
import {
  readStageTwoArtifacts,
  renderSessionizationReportMarkdown,
  sessionizeAlbumListening,
  writeSessionizationOutputs,
} from "../lib/import/album-sessionizer.ts";

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function printHelp(): void {
  console.log(`Needle album-session reconstructor

Usage:
  npm run history:sessionize -- [options]

Options:
  --input <dir>   1.02 artifact directory (default: data/history/.needle)
  --output <dir>  Session output directory (default: same as --input)
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

  const artifacts = await readStageTwoArtifacts(inputDir);
  const result = sessionizeAlbumListening(artifacts);
  await writeSessionizationOutputs({ outputDir, result });

  console.log(renderSessionizationReportMarkdown(result.report));
  console.log(`\nPrivate sessionization outputs written to ${outputDir}`);

  if (!result.report.ok) process.exitCode = 1;
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown album sessionization error";
  console.error(`Needle album sessionization failed: ${message}`);
  process.exitCode = 1;
});
