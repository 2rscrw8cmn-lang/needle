import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SpotifyEnrichmentQuotaExceededError } from "../lib/import/spotify-enrichment.ts";
import { createLiveSpotifyEnrichmentProvider } from "../lib/import/spotify-enrichment-provider.ts";

const albumResponse = {
  id: "album-1",
  name: "Fixture Album",
  album_type: "album",
  total_tracks: 1,
  release_date: "2020-01-01",
  release_date_precision: "day",
  external_urls: { spotify: "https://open.spotify.com/album/album-1" },
  images: [{ url: "https://i.scdn.co/image/fixture", width: 640, height: 640 }],
  artists: [
    {
      id: "artist-1",
      name: "Fixture Artist",
      external_urls: { spotify: "https://open.spotify.com/artist/artist-1" },
    },
  ],
  tracks: {
    items: [
      {
        id: "track-1",
        name: "One",
        disc_number: 1,
        track_number: 1,
        duration_ms: 180000,
        explicit: false,
        external_urls: { spotify: "https://open.spotify.com/track/track-1" },
        artists: [
          {
            id: "artist-1",
            name: "Fixture Artist",
            external_urls: { spotify: "https://open.spotify.com/artist/artist-1" },
          },
        ],
      },
    ],
    next: null,
  },
};

describe("live Spotify enrichment provider", () => {
  it("persists successful album metadata and reuses the cache", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "needle-enrichment-"));
    const cachePath = path.join(dir, "cache.json");
    let calls = 0;
    const fetchImpl: typeof fetch = async (input) => {
      calls += 1;
      const url = String(input);
      if (url.includes("api/token")) {
        return new Response(JSON.stringify({ access_token: "token", expires_in: 3600 }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(JSON.stringify(albumResponse), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };
    const provider = await createLiveSpotifyEnrichmentProvider({
      clientId: "client",
      clientSecret: "secret",
      market: "US",
      cachePath,
      fetchImpl,
      now: () => new Date("2026-08-27T12:00:00.000Z"),
    });

    const first = await provider.getAlbum("album-1");
    const second = await provider.getAlbum("album-1");

    expect(first).toEqual(second);
    expect(calls).toBe(2);
    expect(first?.album.tracks).toHaveLength(1);
    const cache = JSON.parse(await readFile(cachePath, "utf8")) as { albums: Record<string, unknown> };
    expect(cache.albums["album-1"]).toBeTruthy();
  });

  it("fails fast on Development Mode QUOTA_EXCEEDED", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "needle-enrichment-quota-"));
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      if (url.includes("api/token")) {
        return new Response(JSON.stringify({ access_token: "token", expires_in: 3600 }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(
        JSON.stringify({ error: { status: 429, message: "Too many requests", reason: "QUOTA_EXCEEDED" } }),
        {
          status: 429,
          headers: { "content-type": "application/json", "retry-after": "3600" },
        },
      );
    };
    const provider = await createLiveSpotifyEnrichmentProvider({
      clientId: "client",
      clientSecret: "secret",
      market: "US",
      cachePath: path.join(dir, "cache.json"),
      fetchImpl,
      now: () => new Date("2026-08-27T12:00:00.000Z"),
    });

    await expect(provider.getAlbum("album-1")).rejects.toMatchObject({
      name: "SpotifyEnrichmentQuotaExceededError",
      retryAfterSeconds: 3600,
      retryAt: "2026-08-27T13:00:00.000Z",
    } satisfies Partial<SpotifyEnrichmentQuotaExceededError>);
  });
});
