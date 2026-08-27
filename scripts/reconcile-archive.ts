import path from "node:path";
import {
  readArchiveReconciliationArtifacts,
  reconcileImportedArchive,
  renderArchiveReconciliationReportMarkdown,
  writeArchiveReconciliationOutputs,
} from "../lib/import/archive-reconciler.ts";

interface CliOptions {
  inputDir: string;
  outputDir: string;
  help: boolean;
}

const options = parseArgs(process.argv.slice(2));

if (options.help) {
  printHelp();
  process.exit(0);
}

try {
  const artifacts = await readArchiveReconciliationArtifacts(options.inputDir);
  const result = reconcileImportedArchive(artifacts);
  await writeArchiveReconciliationOutputs({ outputDir: options.outputDir, result });
  console.log(renderArchiveReconciliationReportMarkdown(result.report));
  if (!result.report.ok) process.exitCode = 1;
} catch (error: unknown) {
  console.error(`Needle archive reconciliation failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}

function parseArgs(args: string[]): CliOptions {
  const defaultInput = path.resolve("data/history/.needle");
  const parsed: CliOptions = {
    inputDir: defaultInput,
    outputDir: defaultInput,
    help: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }
    if (arg === "--input") {
      parsed.inputDir = path.resolve(requireValue(args, ++index, "--input"));
      if (parsed.outputDir === defaultInput) parsed.outputDir = parsed.inputDir;
      continue;
    }
    if (arg === "--output") {
      parsed.outputDir = path.resolve(requireValue(args, ++index, "--output"));
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }

  return parsed;
}

function requireValue(args: string[], index: number, option: string): string {
  const value = args[index];
  if (!value || value.startsWith("--")) throw new Error(`${option} requires a value.`);
  return value;
}

function printHelp(): void {
  console.log(`Needle Phase 1 archive reconciliation

Usage:
  npm run history:reconcile -- [options]

Options:
  --input <dir>   Completed 1.03–1.06 artifact directory (default: data/history/.needle)
  --output <dir>  Reconciliation/runtime output directory (default: same as --input)
  --help          Show this help

Outputs include listener-album-summaries.json, runtime-archive.json,
archive-reconciliation-report.json/.md, and archive-import.sql.

Run this only after album resolution, Spotify enrichment, and Music Type classification have completed.`);
}
