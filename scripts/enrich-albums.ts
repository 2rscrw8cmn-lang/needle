import path from "node:path";
import {
  enrichResolvedAlbums,
  readAlbumResolutionArtifacts,
  renderSpotifyEnrichmentReportMarkdown,
  SpotifyEnrichmentQuotaExceededError,
  writeSpotifyEnrichmentOutputs,
} from "../lib/import/spotify-enrichment.ts";
import {
  createFixtureSpotifyEnrichmentProvider,
  createLiveSpotifyEnrichmentProvider,
} from "../lib/import/spotify-enrichment-provider.ts";

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function printHelp(): void {
  console.log(`Needle Spotify album enrichment

Usage:
  npm run history:enrich-albums -- [options]

Options:
  --input <dir>            1.04 artifact directory (default: data/history/.needle)
  --output <dir>           Enrichment output directory (default: same as --input)
  --market <CC>            Spotify market (default: SPOTIFY_MARKET or US)
  --cache <file>           Spotify enrichment cache (default: <input>/spotify-enrichment-cache.json)
  --catalog-fixture <file> Use a sanitized local enrichment fixture instead of Spotify API
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
    argValue("--cache") ?? path.join(inputDir, "spotify-enrichment-cache.json"),
  );

  const artifacts = await readAlbumResolutionArtifacts(inputDir);
  const provider = fixturePath
    ? await createFixtureSpotifyEnrichmentProvider(path.resolve(fixturePath))
    : await createLiveSpotifyEnrichmentProvider({
        clientId: process.env.SPOTIFY_CLIENT_ID ?? "",
        clientSecret: process.env.SPOTIFY_CLIENT_SECRET ?? "",
        market,
        cachePath,
      });

  const result = await enrichResolvedAlbums({
    artifacts,
    provider,
    providerName: fixturePath ? "fixture" : "spotify",
    market,
  });
  await writeSpotifyEnrichmentOutputs({ outputDir, result });

  console.log(renderSpotifyEnrichmentReportMarkdown(result.report));
  console.log(`\nPrivate Spotify enrichment outputs written to ${outputDir}`);
  if (!result.report.ok) process.exitCode = 1;
}

main().catch((error: unknown) => {
  if (error instanceof SpotifyEnrichmentQuotaExceededError) {
    console.error(
      `Needle Spotify enrichment stopped: ${error.message} Cache preserved; partial enrichment outputs were not written.`,
    );
    process.exitCode = 1;
    return;
  }
  const message = error instanceof Error ? error.message : "Unknown Spotify enrichment error";
  console.error(`Needle Spotify enrichment failed: ${message}`);
  process.exitCode = 1;
});
