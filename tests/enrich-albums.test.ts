import { describe, expect, it } from "vitest";
import {
  enrichResolvedAlbums,
  type AlbumResolutionArtifacts,
  type SpotifyAlbumDetail,
  type SpotifyAlbumEnrichmentProvider,
} from "../lib/import/spotify-enrichment.ts";
import type { CanonicalAlbum, SpotifyAlbumEdition } from "../lib/import/album-resolver.ts";

function canonical(overrides: Partial<CanonicalAlbum> = {}): CanonicalAlbum {
  return {
    canonical_album_id: "alb_fixture",
    title: "Fixture Album",
    primary_artist_id: "artist_fixture",
    primary_artist_name: "Fixture Artist",
    original_release_date: "2020-01-01",
    preferred_edition_id: "edn_spotify-album-1",
    catalog_confidence: "high",
    review_status: "accepted",
    source_album_keys: ["source-1"],
    ...overrides,
  };
}

function edition(overrides: Partial<SpotifyAlbumEdition> = {}): SpotifyAlbumEdition {
  return {
    edition_id: "edn_spotify-album-1",
    canonical_album_id: "alb_fixture",
    spotify_album_id: "spotify-album-1",
    title: "Fixture Album",
    primary_artist_id: "artist_fixture",
    primary_artist_name: "Fixture Artist",
    release_date: "2020-01-01",
    album_type: "album",
    edition_type: "standard",
    total_tracks: 2,
    is_preferred: true,
    match_confidence: "high",
    edition_ambiguity: false,
    resolution_score: 0.99,
    title_similarity: 1,
    artist_similarity: 1,
    track_overlap_rate: 1,
    observed_probe_share: 1,
    sources: ["track_probe", "search"],
    ...overrides,
  };
}

function detail(overrides: Partial<SpotifyAlbumDetail> = {}): SpotifyAlbumDetail {
  return {
    id: "spotify-album-1",
    name: "Fixture Album",
    album_type: "album",
    release_date: "2020-01-01",
    release_date_precision: "day",
    total_tracks: 2,
    spotify_url: "https://open.spotify.com/album/spotify-album-1",
    images: [{ url: "https://i.scdn.co/image/fixture", width: 640, height: 640 }],
    artists: [
      {
        id: "artist_fixture",
        name: "Fixture Artist",
        spotify_url: "https://open.spotify.com/artist/artist_fixture",
      },
    ],
    tracks: [
      {
        id: "track-1",
        name: "One",
        disc_number: 1,
        track_number: 1,
        duration_ms: 180_000,
        explicit: false,
        spotify_url: "https://open.spotify.com/track/track-1",
        artists: [
          {
            id: "artist_fixture",
            name: "Fixture Artist",
            spotify_url: "https://open.spotify.com/artist/artist_fixture",
          },
        ],
      },
      {
        id: "track-2",
        name: "Two",
        disc_number: 1,
        track_number: 2,
        duration_ms: 200_000,
        explicit: true,
        spotify_url: "https://open.spotify.com/track/track-2",
        artists: [
          {
            id: "artist_fixture",
            name: "Fixture Artist",
            spotify_url: "https://open.spotify.com/artist/artist_fixture",
          },
        ],
      },
    ],
    ...overrides,
  };
}

function artifacts(options: {
  canonicals?: CanonicalAlbum[];
  editions?: SpotifyAlbumEdition[];
} = {}): AlbumResolutionArtifacts {
  return {
    canonicalAlbums: options.canonicals ?? [canonical()],
    editions: options.editions ?? [edition()],
  };
}

function provider(albums: Record<string, SpotifyAlbumDetail | null>): SpotifyAlbumEnrichmentProvider {
  return {
    async getAlbum(id) {
      const album = albums[id];
      return album === undefined || album === null
        ? null
        : { fetched_at: "2026-08-27T12:00:00.000Z", album };
    },
  };
}

describe("Spotify album enrichment", () => {
  it("enriches an accepted preferred edition with artwork, Spotify links, artists, and tracks", async () => {
    const result = await enrichResolvedAlbums({
      artifacts: artifacts(),
      provider: provider({ "spotify-album-1": detail() }),
      providerName: "fixture",
      market: "US",
    });

    expect(result.report.ok).toBe(true);
    expect(result.report.totals.enrichedAlbums).toBe(1);
    expect(result.report.totals.albumsWithArtwork).toBe(1);
    expect(result.report.totals.albumsWithSpotifyUrl).toBe(1);
    expect(result.report.totals.albumsWithCompleteTrackListing).toBe(1);
    expect(result.albums[0]?.primary_artwork_url).toContain("i.scdn.co");
    expect(result.artists).toHaveLength(1);
    expect(result.artists[0]?.genres).toEqual([]);
    expect(result.artists[0]?.genre_status).toBe("unavailable_from_album_response");
    expect(result.tracks.map((track) => track.spotify_track_id)).toEqual(["track-1", "track-2"]);
  });

  it("does not enrich canonical albums that remain in review", async () => {
    let calls = 0;
    const result = await enrichResolvedAlbums({
      artifacts: artifacts({ canonicals: [canonical({ review_status: "review" })] }),
      provider: {
        async getAlbum() {
          calls += 1;
          return { fetched_at: "2026-08-27T12:00:00.000Z", album: detail() };
        },
      },
      providerName: "fixture",
      market: "US",
    });

    expect(calls).toBe(0);
    expect(result.report.totals.acceptedCanonicalAlbums).toBe(0);
    expect(result.albums).toEqual([]);
  });

  it("records a missing Spotify album without destroying the accepted canonical identity", async () => {
    const result = await enrichResolvedAlbums({
      artifacts: artifacts(),
      provider: provider({ "spotify-album-1": null }),
      providerName: "fixture",
      market: "US",
    });

    expect(result.report.ok).toBe(true);
    expect(result.report.totals.enrichedAlbums).toBe(0);
    expect(result.report.totals.failedAlbums).toBe(1);
    expect(result.failures[0]?.reason).toBe("spotify_album_not_found");
    expect(result.report.reconciliation.targetBalance).toBe(true);
  });

  it("keeps incomplete track listings explicit instead of failing album enrichment", async () => {
    const incomplete = detail({ total_tracks: 3 });
    const result = await enrichResolvedAlbums({
      artifacts: artifacts(),
      provider: provider({ "spotify-album-1": incomplete }),
      providerName: "fixture",
      market: "US",
    });

    expect(result.albums[0]?.track_listing_complete).toBe(false);
    expect(result.report.totals.albumsWithCompleteTrackListing).toBe(0);
    expect(result.report.ok).toBe(true);
  });
});
