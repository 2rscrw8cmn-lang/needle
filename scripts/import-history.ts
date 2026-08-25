import path from "node:path";
import {
  analyzeHistoryDirectory,
  renderImportReportMarkdown,
  writeImportOutputs,
} from "../lib/import/history-validator.ts";

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function printHelp(): void {
  console.log(`Needle Spotify history validator

Usage:
  npm run history:validate -- [options]

Options:
  --input <dir>   Source directory (default: data/history)
  --output <dir>  Output directory (default: <input>/.needle)
  --as-of <iso>   UTC validation cutoff for future timestamps (default: now)
  --help          Show this help
`);
}

async function main(): Promise<void> {
  if (process.argv.includes("--help")) {
    printHelp();
    return;
  }

  const inputDir = path.resolve(argValue("--input") ?? "data/history");
  const outputDir = path.resolve(argValue("--output") ?? path.join(inputDir, ".needle"));
  const asOfValue = argValue("--as-of");
  const asOf = asOfValue ? new Date(asOfValue) : new Date();

  if (Number.isNaN(asOf.getTime())) {
    throw new Error(`Invalid --as-of value: ${asOfValue}`);
  }

  const analysis = await analyzeHistoryDirectory({ inputDir, asOf });
  await writeImportOutputs({ outputDir, analysis });

  console.log(renderImportReportMarkdown(analysis.report));
  console.log(`\nPrivate outputs written to ${outputDir}`);

  if (!analysis.report.ok) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown import validation error";
  console.error(`Needle history validation failed: ${message}`);
  process.exitCode = 1;
});
