import { describe, expect, it } from "vitest";
import {
  canonicalizeEditionTitle,
  resolveAlbumCatalog,
  type SpotifyAlbumSummary,
  type SpotifyCatalogProvider,
  type StageThreeArtifacts,
} from "../lib/import/album-resolver.ts";

const BATCH = "batch-catalog-test";

function album(
  id: string,
  name: string,
  artistId: string,
  artistName: string,
  albumType: SpotifyAlbumSummary["album_type"] = "album",
  totalTracks = 5,
): SpotifyAlbumSummary {
  return {
    id,
    name,
    album_type: albumType,
    total_tracks: totalTracks,
    release_date: "2020-01-01",
    artists: [{ id: artistId, name: artistName }],
  };
}

function artifacts(options: {
  key?: string;
  artist?: string;
  album?: string;
  tracks?: string[];
} = {}): StageThreeArtifacts {
  const key = options.key ?? "source-1";
  const artistName = options.artist ?? "Fixture Artist";
  const albumName = options.album ?? "Fixture Album";
  const tracks = options.tracks ?? ["One", "Two", "Three", "Four", "Five"];
  const events = tracks.map((track, index) => ({
    event_id: `event-${index}`,
    import_batch_id: BATCH,
    played_at: new Date(Date.UTC(2026, 0, 1, 12, index)).toISOString(),
    ms_played: 60_000,
    spotify_track_id: `track-${index}`,
    track_name: track,
    artist_name: artistName,
    album_name: albumName,
  }));
  return {
    report: {
      importBatchId: BATCH,
      ok: true,
      totals: { normalizedEvents: events.length, provisionalCandidateAlbums: 1, candidateSessions: 1 },
    },
    provisionalAlbums: [
      {
        source_album_key: key,
        artist_name: artistName,
        album_name: albumName,
        known_local_track_count: tracks.length,
        known_local_track_keys: tracks.map((track) => track.toLowerCase().replace(/[^a-z0-9]+/g, "")),
        qualifying_session_count: 2,
      },
    ],
    sessions: [
      { session_id: "session-1", source_album_key: key, evidence_status: "full", event_ids: events.map((event) => event.event_id) },
    ],
    events,
  };
}

function provider(options: {
  probeAlbum?: SpotifyAlbumSummary | null;
  searchAlbums?: SpotifyAlbumSummary[];
  tracksByAlbum?: Record<string, string[]>;
}): SpotifyCatalogProvider {
  return {
    async getTrack(trackId) {
      return options.probeAlbum
        ? { id: trackId, name: trackId, album: options.probeAlbum }
        : null;
    },
    async searchAlbums() {
      return options.searchAlbums ?? [];
    },
    async getAlbumTracks(albumId) {
      return (options.tracksByAlbum?.[albumId] ?? []).map((name, index) => ({ id: `${albumId}-${index}`, name }));
    },
  };
}

const fiveTracks = ["One", "Two", "Three", "Four", "Five"];

describe("album catalog resolution", () => {
  it("prefers a standard edition while preserving the listened deluxe edition", async () => {
    const standard = album("standard", "Fixture Album", "artist", "Fixture Artist");
    const deluxe = album("deluxe", "Fixture Album (Deluxe Version)", "artist", "Fixture Artist", "album", 7);
    const result = await resolveAlbumCatalog({
      artifacts: artifacts({ album: "Fixture Album (Deluxe Version)" }),
      provider: provider({
        probeAlbum: deluxe,
        searchAlbums: [standard, deluxe],
        tracksByAlbum: { standard: fiveTracks, deluxe: [...fiveTracks, "Bonus", "Bonus Two"] },
      }),
      providerName: "fixture",
    });
    expect(result.links[0]).toMatchObject({ resolution_status: "resolved", preferred_edition_id: "edn_standard" });
    expect(result.editions.map((edition) => edition.edition_id)).toEqual(
      expect.arrayContaining(["edn_standard", "edn_deluxe"]),
    );
    expect(result.editions.find((edition) => edition.edition_id === "edn_deluxe")?.edition_type).toBe("deluxe");
  });

  it("collapses remasters into the same family and prefers standard", async () => {
    const standard = album("original", "Static Lines", "artist", "Remaster Artist");
    const remaster = album("remaster", "Static Lines - 2019 Remastered", "artist", "Remaster Artist");
    const result = await resolveAlbumCatalog({
      artifacts: artifacts({ artist: "Remaster Artist", album: "Static Lines - 2019 Remastered" }),
      provider: provider({
        probeAlbum: remaster,
        searchAlbums: [standard, remaster],
        tracksByAlbum: { original: fiveTracks, remaster: fiveTracks },
      }),
      providerName: "fixture",
    });
    expect(result.links[0]).toMatchObject({
      resolution_status: "resolved",
      preferred_edition_id: "edn_original",
      edition_ambiguity: false,
    });
  });

  it("keeps re-recordings distinct from the original canonical family", async () => {
    const rerecord = album("rerecord", "Mirror Road (Taylor's Version)", "artist", "Reprise Artist");
    expect(canonicalizeEditionTitle("Mirror Road (Taylor's Version)").familyTitle).toBe(
      "Mirror Road (Taylor's Version)",
    );
    const result = await resolveAlbumCatalog({
      artifacts: artifacts({ artist: "Reprise Artist", album: "Mirror Road (Taylor's Version)" }),
      provider: provider({ probeAlbum: rerecord, searchAlbums: [rerecord], tracksByAlbum: { rerecord: fiveTracks } }),
      providerName: "fixture",
    });
    expect(result.canonicalAlbums[0]?.title).toBe("Mirror Road (Taylor's Version)");
    expect(result.editions[0]?.edition_type).toBe("rerecording");
  });

  it("preserves genuine edition ambiguity rather than choosing between equal releases", async () => {
    const one = album("edition-a", "Open Sky", "artist", "Ambig Artist");
    const two = album("edition-b", "Open Sky", "artist", "Ambig Artist");
    const result = await resolveAlbumCatalog({
      artifacts: artifacts({ artist: "Ambig Artist", album: "Open Sky" }),
      provider: provider({ probeAlbum: null, searchAlbums: [one, two], tracksByAlbum: { "edition-a": fiveTracks, "edition-b": fiveTracks } }),
      providerName: "fixture",
    });
    expect(result.links[0]?.resolution_status).toBe("review");
    expect(result.links[0]?.edition_ambiguity).toBe(true);
    expect(result.links[0]?.review_reasons).toContain("edition_selection_ambiguous");
  });

  it("sends compilation identity risk and no-match cases to review", async () => {
    const compilation = album("comp", "Collection", "artist", "Solo Singr", "compilation");
    const compilationResult = await resolveAlbumCatalog({
      artifacts: artifacts({ artist: "Solo Singer", album: "Collection" }),
      provider: provider({ probeAlbum: compilation, searchAlbums: [compilation], tracksByAlbum: { comp: fiveTracks } }),
      providerName: "fixture",
    });
    expect(compilationResult.links[0]?.resolution_status).toBe("review");
    expect(compilationResult.links[0]?.review_reasons).toContain("compilation_identity_risk");

    const noMatch = await resolveAlbumCatalog({
      artifacts: artifacts(),
      provider: provider({ probeAlbum: null, searchAlbums: [] }),
      providerName: "fixture",
    });
    expect(noMatch.links[0]).toMatchObject({ resolution_status: "review", canonical_album_id: null, match_confidence: "none" });
    expect(noMatch.links[0]?.review_reasons).toContain("no_catalog_candidates");
  });

  it("is deterministic and turns provider failures into review records", async () => {
    const failing: SpotifyCatalogProvider = {
      async getTrack() { throw new Error("outage"); },
      async searchAlbums() { throw new Error("outage"); },
      async getAlbumTracks() { throw new Error("outage"); },
    };
    const input = artifacts();
    const first = await resolveAlbumCatalog({ artifacts: input, provider: failing, providerName: "fixture" });
    const second = await resolveAlbumCatalog({ artifacts: input, provider: failing, providerName: "fixture" });
    expect(second).toEqual(first);
    expect(first.report.ok).toBe(true);
    expect(first.report.totals).toMatchObject({ resolvedSourceAlbums: 0, reviewSourceAlbums: 1, providerErrorAlbums: 1 });
  });
});
