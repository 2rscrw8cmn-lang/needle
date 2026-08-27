import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createCachedSpotifyCatalogProvider } from "../lib/import/cached-archive-preview.ts";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function writeCache(market = "US") {
  const dir = await mkdtemp(path.join(os.tmpdir(), "needle-cache-preview-"));
  temporaryDirectories.push(dir);
  const cachePath = path.join(dir, "spotify-resolution-cache.json");
  const album = {
    id: "album_alpha",
    name: "Alpha Record",
    album_type: "album",
    total_tracks: 1,
    release_date: "2020",
    artists: [{ id: "artist_alpha", name: "Alpha Artist" }],
  };
  await writeFile(
    cachePath,
    `${JSON.stringify({
      version: 1,
      market,
      tracks: {
        track_alpha: { id: "track_alpha", name: "Alpha One", album },
      },
      searches: {
        [`alphaartist\u241falpharecord\u241f10`]: [album],
      },
      albumTracks: {
        album_alpha: [{ id: "track_alpha", name: "Alpha One" }],
      },
    }, null, 2)}\n`,
    "utf8",
  );
  return cachePath;
}

describe("cached archive preview provider", () => {
  it("serves only existing cache entries and treats misses as empty without credentials or network", async () => {
    const cachePath = await writeCache();
    const cached = await createCachedSpotifyCatalogProvider({ cachePath, market: "US" });

    expect(cached.stats).toEqual({ tracks: 1, searches: 1, albumTrackLists: 1 });
    expect((await cached.provider.getTrack("track_alpha"))?.album.id).toBe("album_alpha");
    expect(await cached.provider.searchAlbums({ artist: "Alpha Artist", album: "Alpha Record", limit: 10 }))
      .toHaveLength(1);
    expect(await cached.provider.getAlbumTracks("album_alpha")).toEqual([
      { id: "track_alpha", name: "Alpha One" },
    ]);

    expect(await cached.provider.getTrack("not_cached")).toBeNull();
    expect(await cached.provider.searchAlbums({ artist: "Missing", album: "Missing", limit: 10 }))
      .toEqual([]);
    expect(await cached.provider.getAlbumTracks("not_cached")).toEqual([]);
  });

  it("refuses a cache from a different market instead of silently mixing catalog evidence", async () => {
    const cachePath = await writeCache("GB");
    await expect(createCachedSpotifyCatalogProvider({ cachePath, market: "US" }))
      .rejects.toThrow("cache market is GB, expected US");
  });
});
