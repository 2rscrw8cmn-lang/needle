import { mkdir } from "node:fs/promises";
import path from "node:path";
import {
  readStageThreeArtifacts,
  resolveAlbumCatalog,
  writeAlbumResolutionOutputs,
} from "../lib/import/album-resolver.ts";
import {
  buildCachedArchivePreview,
  createCachedSpotifyCatalogProvider,
  writeCachedArchivePreviewManifest,
} from "../lib/import/cached-archive-preview.ts";
import {
  renderArchiveReconciliationReportMarkdown,
  writeArchiveReconciliationOutputs,
} from "../lib/import/archive-reconciler.ts";

interface CliOptions {
  inputDir: string;
  outputDir: string;
  cachePath: string;
  market: string;
  help: boolean;
}

const options = parseArgs(process.argv.slice(2));

if (options.help) {
  printHelp();
  process.exit(0);
}

try {
  const stageThree = await readStageThreeArtifacts(options.inputDir);
  const cached = await createCachedSpotifyCatalogProvider({
    cachePath: options.cachePath,
    market: options.market,
  });
  const resolution = await resolveAlbumCatalog({
    artifacts: stageThree,
    provider: cached.provider,
    providerName: "spotify",
  });
  const preview = buildCachedArchivePreview({
    stageThree,
    resolution,
    market: options.market,
    cacheStats: cached.stats,
  });

  await mkdir(options.outputDir, { recursive: true });
  await Promise.all([
    writeAlbumResolutionOutputs({ outputDir: options.outputDir, result: resolution }),
    writeArchiveReconciliationOutputs({ outputDir: options.outputDir, result: preview.result }),
    writeCachedArchivePreviewManifest(options.outputDir, preview.manifest),
  ]);

  console.log("# Needle Cached Archive Preview");
  console.log("");
  console.log("LOCAL PREVIEW ONLY — no Spotify API requests were made.");
  console.log(`Cache: ${cached.stats.tracks} tracks / ${cached.stats.searches} searches / ${cached.stats.albumTrackLists} album track lists`);
  console.log(`Resolved source albums: ${preview.manifest.totals.resolved_source_albums}/${preview.manifest.totals.source_albums}`);
  console.log(`Canonical albums: ${preview.manifest.totals.canonical_albums}`);
  console.log(`Preview Library members: ${preview.manifest.totals.library_members}`);
  console.log("");
  console.log(renderArchiveReconciliationReportMarkdown(preview.result.report));
  console.log(`\nPreview outputs written only to ${options.outputDir}`);
} catch (error: unknown) {
  console.error(`Needle cached archive preview failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}

function parseArgs(args: string[]): CliOptions {
  const defaultInput = path.resolve("data/history/.needle");
  const parsed: CliOptions = {
    inputDir: defaultInput,
    outputDir: path.join(defaultInput, "preview"),
    cachePath: path.join(defaultInput, "spotify-resolution-cache.json"),
    market: (process.env.SPOTIFY_MARKET ?? "US").toUpperCase(),
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
      parsed.outputDir = path.join(parsed.inputDir, "preview");
      parsed.cachePath = path.join(parsed.inputDir, "spotify-resolution-cache.json");
      continue;
    }
    if (arg === "--output") {
      parsed.outputDir = path.resolve(requireValue(args, ++index, "--output"));
      continue;
    }
    if (arg === "--cache") {
      parsed.cachePath = path.resolve(requireValue(args, ++index, "--cache"));
      continue;
    }
    if (arg === "--market") {
      parsed.market = requireValue(args, ++index, "--market").toUpperCase();
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
  console.log(`Needle cached archive preview\n\nUsage:\n  npm run history:preview-cached -- [options]\n\nOptions:\n  --input <dir>   Existing 1.03/private artifact directory (default: data/history/.needle)\n  --output <dir>  Preview output directory (default: <input>/preview)\n  --cache <file>  Existing Spotify resolution cache (default: <input>/spotify-resolution-cache.json)\n  --market <CC>   Cache market (default: SPOTIFY_MARKET or US)\n  --help          Show this help\n\nThis command is cache-only: it does not use Spotify credentials or make network requests.\nPreview outputs are local-only and must not be loaded into remote/production D1.`);
}
