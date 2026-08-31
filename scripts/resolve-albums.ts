import path from "node:path";
import {
  readStageThreeArtifacts,
  renderAlbumResolutionReportMarkdown,
  resolveAlbumCatalog,
  writeAlbumResolutionOutputs,
} from "../lib/import/album-resolver.ts";
import {
  applyManualAlbumResolutionOverrides,
  readManualAlbumResolutionOverrides,
} from "../lib/import/album-resolution-overrides.ts";
import {
  createFixtureSpotifyCatalogProvider,
  createLiveSpotifyCatalogProvider,
  type LiveSpotifyCatalogProviderHandle,
} from "../lib/import/spotify-catalog.ts";

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function printHelp(): void {
  console.log(`Needle canonical album / Spotify edition resolver

Usage:
  npm run history:resolve-albums -- [options]

Options:
  --input <dir>            1.03 artifact directory (default: data/history/.needle)
  --output <dir>           Resolution output directory (default: same as --input)
  --market <CC>            Spotify market (default: SPOTIFY_MARKET or US)
  --cache <file>           Spotify catalog cache (default: <input>/spotify-resolution-cache.json)
  --overrides <file>       Persistent local review approvals (default: data/history/album-resolution-overrides.json)
  --catalog-fixture <file> Use a sanitized local catalog fixture instead of Spotify API
  --help                   Show this help

The optional override file may only approve high-confidence edition-selection ambiguity already present in Needle's candidate set. It cannot force low-confidence or unmatched albums.

Live Spotify mode requires SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET.
`);
}

async function main(): Promise<void> {
  if (process.argv.includes("--help")) {
    printHelp();
    return;
  }

  const inputDir = path.resolve(argValue("--input") ?? "data/history/.needle");
  const outputDir = path.resolve(argValue("--output") ?? inputDir);
  const fixturePath = argValue("--catalog-fixture");
  const market = (argValue("--market") ?? process.env.SPOTIFY_MARKET ?? "US").toUpperCase();
  const cachePath = path.resolve(
    argValue("--cache") ?? path.join(inputDir, "spotify-resolution-cache.json"),
  );
  const overridesPath = path.resolve(
    argValue("--overrides") ?? "data/history/album-resolution-overrides.json",
  );

  const [artifacts, overrides] = await Promise.all([
    readStageThreeArtifacts(inputDir),
    readManualAlbumResolutionOverrides(overridesPath),
  ]);
  let liveProvider: LiveSpotifyCatalogProviderHandle | null = null;
  const provider = fixturePath
    ? await createFixtureSpotifyCatalogProvider(path.resolve(fixturePath))
    : (liveProvider = await createLiveSpotifyCatalogProvider({
        clientId: process.env.SPOTIFY_CLIENT_ID ?? "",
        clientSecret: process.env.SPOTIFY_CLIENT_SECRET ?? "",
        market,
        cachePath,
      }));

  const automatic = await resolveAlbumCatalog({
    artifacts,
    provider,
    providerName: fixturePath ? "fixture" : "spotify",
  });
  const { result, summary } = applyManualAlbumResolutionOverrides(automatic, overrides);

  const quotaState = liveProvider?.getQuotaState();
  if (quotaState) {
    const retryAt = quotaState.retryAt ? ` approximately ${quotaState.retryAt}` : " after the quota resets";
    throw new Error(
      `Spotify Development Mode quota exhausted. Cache preserved at ${cachePath}. Retry${retryAt}; partial resolution outputs were not written.`,
    );
  }

  await writeAlbumResolutionOutputs({ outputDir, result });

  console.log(renderAlbumResolutionReportMarkdown(result.report));
  console.log("");
  console.log("## Manual resolution overrides");
  console.log(`- Requested: **${summary.requested}**`);
  console.log(`- Applied: **${summary.applied}**`);
  console.log(`- Already resolved identically: **${summary.alreadyResolved}**`);
  console.log(`- Orphan source keys: **${summary.orphanSourceAlbumKeys.length}**`);
  if (summary.orphanSourceAlbumKeys.length > 0) {
    for (const sourceKey of summary.orphanSourceAlbumKeys) console.log(`  - ${sourceKey}`);
  }
  console.log(`\nPrivate album-resolution outputs written to ${outputDir}`);
  if (!result.report.ok) process.exitCode = 1;
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown album resolution error";
  console.error(`Needle album resolution failed: ${message}`);
  process.exitCode = 1;
});
