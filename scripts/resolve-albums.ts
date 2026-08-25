import path from "node:path";
import {
  readStageThreeArtifacts,
  renderAlbumResolutionReportMarkdown,
  resolveAlbumCatalog,
  writeAlbumResolutionOutputs,
} from "../lib/import/album-resolver.ts";
import {
  createFixtureSpotifyCatalogProvider,
  createLiveSpotifyCatalogProvider,
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
  --catalog-fixture <file> Use a sanitized local catalog fixture instead of Spotify API
  --help                   Show this help

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

  const artifacts = await readStageThreeArtifacts(inputDir);
  const provider = fixturePath
    ? await createFixtureSpotifyCatalogProvider(path.resolve(fixturePath))
    : await createLiveSpotifyCatalogProvider({
        clientId: process.env.SPOTIFY_CLIENT_ID ?? "",
        clientSecret: process.env.SPOTIFY_CLIENT_SECRET ?? "",
        market,
        cachePath,
      });

  const result = await resolveAlbumCatalog({
    artifacts,
    provider,
    providerName: fixturePath ? "fixture" : "spotify",
  });
  await writeAlbumResolutionOutputs({ outputDir, result });

  console.log(renderAlbumResolutionReportMarkdown(result.report));
  console.log(`\nPrivate album-resolution outputs written to ${outputDir}`);
  if (!result.report.ok) process.exitCode = 1;
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown album resolution error";
  console.error(`Needle album resolution failed: ${message}`);
  process.exitCode = 1;
});
