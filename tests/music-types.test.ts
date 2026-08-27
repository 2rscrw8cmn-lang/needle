import { describe, expect, it } from "vitest";
import type {
  SpotifyAlbumEnrichment,
  SpotifyArtistEnrichment,
} from "../lib/import/spotify-enrichment.ts";
import {
  MUSIC_TYPES,
  classifyMusicTypes,
  mapGenreToMusicType,
  normalizeGenre,
  type ManualMusicTypeOverrideFile,
} from "../lib/taxonomy/music-types.ts";

function album(id: string, artistIds: string[]): SpotifyAlbumEnrichment {
  return {
    canonical_album_id: `alb_${id}`,
    edition_id: `edn_${id}`,
    spotify_album_id: id,
    name: `Album ${id}`,
    album_type: "album",
    release_date: "2020-01-01",
    release_date_precision: "day",
    total_tracks: 10,
    spotify_url: `https://open.spotify.com/album/${id}`,
    images: [],
    primary_artwork_url: null,
    artist_ids: artistIds,
    track_ids: [],
    track_listing_complete: true,
    provider: "spotify",
    market: "US",
    enriched_at: "2026-08-27T12:00:00.000Z",
  };
}

function artist(id: string, genres: string[]): SpotifyArtistEnrichment {
  return {
    spotify_artist_id: id,
    name: `Artist ${id}`,
    spotify_url: `https://open.spotify.com/artist/${id}`,
    genres,
    genre_status: "unavailable_from_album_response",
    provider: "spotify",
    enriched_at: "2026-08-27T12:00:00.000Z",
  };
}

describe("Music Type taxonomy", () => {
  it("exposes exactly the accepted ten Music Types", () => {
    expect(MUSIC_TYPES).toEqual([
      "Rock",
      "Pop",
      "Hip-Hop",
      "R&B / Soul",
      "Electronic",
      "Jazz",
      "Country / Folk",
      "Heavy",
      "Global",
      "Classical / Soundtrack",
    ]);
  });

  it.each([
    ["indie rock", "Rock"],
    ["electropop", "Pop"],
    ["southern rap", "Hip-Hop"],
    ["neo soul", "R&B / Soul"],
    ["deep house", "Electronic"],
    ["bebop", "Jazz"],
    ["americana", "Country / Folk"],
    ["metalcore", "Heavy"],
    ["afrobeat", "Global"],
    ["film score", "Classical / Soundtrack"],
    ["pop rock", "Rock"],
  ])("maps representative genre %s to %s", (genre, expected) => {
    expect(mapGenreToMusicType(genre).music_type).toBe(expected);
  });

  it("normalizes punctuation without using unsupported inference", () => {
    expect(normalizeGenre("R&B / Soul")).toBe("r and b soul");
    expect(mapGenreToMusicType("unknown micro-scene").music_type).toBeNull();
  });

  it("keeps detailed genre evidence and classifies by the strongest album-level vote", () => {
    const result = classifyMusicTypes({
      artifacts: {
        albums: [album("one", ["artist-a", "artist-b"])],
        artists: [
          artist("artist-a", ["alternative rock", "indie rock"]),
          artist("artist-b", ["indie pop"]),
        ],
      },
    });

    const classification = result.classifications[0];
    expect(classification.music_type).toBe("Rock");
    expect(classification.automatic_music_type).toBe("Rock");
    expect(classification.status).toBe("classified");
    expect(classification.detailed_genres.map((genre) => genre.normalized_name)).toEqual([
      "alternative rock",
      "indie pop",
      "indie rock",
    ]);
    expect(classification.votes.Rock).toBe(2);
    expect(classification.votes.Pop).toBe(1);
    expect(result.report.totals.classifiedAlbums).toBe(1);
  });

  it("leaves no-genre, unmapped, and tied evidence explicitly unclassified", () => {
    const result = classifyMusicTypes({
      artifacts: {
        albums: [
          album("none", ["none"]),
          album("unknown", ["unknown"]),
          album("tie", ["tie"]),
        ],
        artists: [
          artist("none", []),
          artist("unknown", ["future micro-scene"]),
          artist("tie", ["indie rock", "indie pop"]),
        ],
      },
    });

    expect(result.classifications.map((item) => [item.canonical_album_id, item.status, item.music_type])).toEqual([
      ["alb_none", "unclassified_no_genres", null],
      ["alb_tie", "unclassified_ambiguous", null],
      ["alb_unknown", "unclassified_unmapped", null],
    ]);
    expect(result.report.totals.unclassifiedNoGenres).toBe(1);
    expect(result.report.totals.unclassifiedUnmapped).toBe(1);
    expect(result.report.totals.unclassifiedAmbiguous).toBe(1);
  });

  it("applies persistent manual overrides without deleting automatic evidence", () => {
    const overrides: ManualMusicTypeOverrideFile = {
      version: 1,
      overrides: [
        {
          canonical_album_id: "alb_tie",
          music_type: "Rock",
          note: "Reviewed manually",
          updated_at: "2026-08-27T13:00:00.000Z",
        },
      ],
    };
    const artifacts = {
      albums: [album("tie", ["tie"])],
      artists: [artist("tie", ["indie rock", "indie pop"])],
    };

    const first = classifyMusicTypes({ artifacts, overrides });
    const second = classifyMusicTypes({ artifacts, overrides });
    expect(second).toEqual(first);

    const classification = first.classifications[0];
    expect(classification.status).toBe("manual_override");
    expect(classification.music_type).toBe("Rock");
    expect(classification.automatic_music_type).toBeNull();
    expect(classification.manual_override?.note).toBe("Reviewed manually");
    expect(classification.votes.Rock).toBe(1);
    expect(classification.votes.Pop).toBe(1);
    expect(first.report.totals.manualOverrides).toBe(1);
    expect(first.report.ok).toBe(true);
  });

  it("flags orphaned manual overrides so stable IDs can be reviewed", () => {
    const result = classifyMusicTypes({
      artifacts: { albums: [album("known", ["known"])], artists: [artist("known", ["jazz"])] },
      overrides: {
        version: 1,
        overrides: [{ canonical_album_id: "alb_missing", music_type: "Jazz" }],
      },
    });

    expect(result.report.totals.orphanManualOverrides).toBe(1);
    expect(result.report.reconciliation.overrideTargetsKnown).toBe(false);
    expect(result.report.ok).toBe(false);
  });
});
