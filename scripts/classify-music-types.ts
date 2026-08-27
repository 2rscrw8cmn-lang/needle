import path from "node:path";
import {
  classifyMusicTypes,
  readManualMusicTypeOverrides,
  readSpotifyTaxonomyArtifacts,
  renderMusicTypeTaxonomyReportMarkdown,
  writeMusicTypeTaxonomyOutputs,
} from "../lib/taxonomy/music-types.ts";

interface CliOptions {
  inputDir: string;
  outputDir: string;
  overridesPath: string;
  help: boolean;
}

const options = parseArgs(process.argv.slice(2));

if (options.help) {
  printHelp();
  process.exit(0);
}

try {
  const [artifacts, overrides] = await Promise.all([
    readSpotifyTaxonomyArtifacts(options.inputDir),
    readManualMusicTypeOverrides(options.overridesPath),
  ]);
  const result = classifyMusicTypes({ artifacts, overrides });
  await writeMusicTypeTaxonomyOutputs({ outputDir: options.outputDir, result });
  console.log(renderMusicTypeTaxonomyReportMarkdown(result.report));
  if (!result.report.ok) process.exitCode = 1;
} catch (error: unknown) {
  console.error(`Needle Music Type classification failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}

function parseArgs(args: string[]): CliOptions {
  const defaultInput = path.resolve("data/history/.needle");
  const defaultOverrides = path.resolve("data/history/music-type-overrides.json");
  const parsed: CliOptions = {
    inputDir: defaultInput,
    outputDir: defaultInput,
    overridesPath: defaultOverrides,
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
    if (arg === "--overrides") {
      parsed.overridesPath = path.resolve(requireValue(args, ++index, "--overrides"));
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
  console.log(`Needle Music Type taxonomy classifier

Usage:
  npm run history:classify-music-types -- [options]

Options:
  --input <dir>       1.05 enrichment artifact directory (default: data/history/.needle)
  --output <dir>      Taxonomy output directory (default: same as --input)
  --overrides <file>  Persistent local manual overrides (default: data/history/music-type-overrides.json)
  --help              Show this help

The override file is optional. Missing genre evidence remains explicitly unclassified.`);
}
