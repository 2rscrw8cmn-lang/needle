import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createLiveSpotifyCatalogProvider } from "../lib/import/spotify-catalog.ts";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("Spotify development quota handling", () => {
  it("records QUOTA_EXCEEDED and prevents additional uncached requests", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "needle-spotify-quota-"));
    temporaryDirectories.push(directory);
    let fetchCount = 0;

    const fetchImpl: typeof fetch = async (input) => {
      fetchCount += 1;
      const url = String(input);
      if (url.includes("accounts.spotify.com/api/token")) {
        return new Response(JSON.stringify({ access_token: "fixture-token", expires_in: 3600 }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(
        JSON.stringify({ error: { status: 429, message: "Too many requests", reason: "QUOTA_EXCEEDED" } }),
        {
          status: 429,
          headers: { "content-type": "application/json", "retry-after": "80480" },
        },
      );
    };

    const provider = await createLiveSpotifyCatalogProvider({
      clientId: "fixture-client",
      clientSecret: "fixture-secret",
      market: "US",
      cachePath: path.join(directory, "spotify-resolution-cache.json"),
      fetchImpl,
    });

    await expect(provider.getTrack("uncached-track")).rejects.toThrow(
      /Spotify Development Mode quota exhausted/,
    );
    expect(provider.getQuotaState()).toMatchObject({
      reason: "QUOTA_EXCEEDED",
      retryAfterSeconds: 80480,
    });
    expect(fetchCount).toBe(2);

    await expect(
      provider.searchAlbums({ artist: "Fixture Artist", album: "Fixture Album", limit: 10 }),
    ).rejects.toThrow(/Spotify Development Mode quota exhausted/);
    expect(fetchCount).toBe(2);
  });
});
