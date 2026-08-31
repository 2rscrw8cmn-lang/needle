import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  applyManualAlbumResolutionOverrides,
  readManualAlbumResolutionOverrides,
  type ManualAlbumResolutionOverrideFile,
} from "../lib/import/album-resolution-overrides.ts";
import type {
  AlbumResolutionResult,
  SpotifyAlbumEdition,
} from "../lib/import/album-resolver.ts";

function edition(id: string): SpotifyAlbumEdition {
  return {
    edition_id: id,
    canonical_album_id: "can_fixture",
    spotify_album_id: id.replace(/^edn_/, ""),
    title: "Fixture Album",
    primary_artist_id: "artist_fixture",
    primary_artist_name: "Fixture Artist",
    release_date: "2020-01-01",
    album_type: "album",
    edition_type: "standard",
    total_tracks: 10,
    is_preferred: false,
    match_confidence: "high",
    edition_ambiguity: true,
    resolution_score: 0.95,
    title_similarity: 1,
    artist_similarity: 1,
    track_overlap_rate: 1,
    observed_probe_share: 1,
    sources: ["search"],
  };
}

function ambiguousResult(): AlbumResolutionResult {
  return {
    canonicalAlbums: [
      {
        canonical_album_id: "can_fixture",
        title: "Fixture Album",
        primary_artist_id: "artist_fixture",
        primary_artist_name: "Fixture Artist",
        original_release_date: "2020-01-01",
        preferred_edition_id: null,
        catalog_confidence: "high",
        review_status: "review",
        source_album_keys: ["source_fixture"],
      },
    ],
    editions: [edition("edn_alpha"), edition("edn_beta")],
    links: [
      {
        source_album_key: "source_fixture",
        source_artist_name: "Fixture Artist",
        source_album_name: "Fixture Album",
        resolution_status: "review",
        canonical_album_id: "can_fixture",
        preferred_edition_id: null,
        proposed_preferred_edition_id: "edn_alpha",
        candidate_edition_ids: ["edn_alpha", "edn_beta"],
        match_confidence: "high",
        edition_ambiguity: true,
        review_reasons: ["edition_selection_ambiguous"],
      },
    ],
    report: {
      reportVersion: 1,
      resolutionVersion: 1,
      importBatchId: "batch_fixture",
      provider: "fixture",
      ok: true,
      totals: {
        provisionalSourceAlbums: 1,
        resolvedSourceAlbums: 0,
        reviewSourceAlbums: 1,
        canonicalAlbums: 1,
        spotifyEditions: 2,
        ambiguousSourceAlbums: 1,
        highConfidenceSourceAlbums: 1,
        mediumConfidenceSourceAlbums: 0,
        noConfidenceSourceAlbums: 0,
        providerErrorAlbums: 0,
      },
      reconciliation: {
        sourceAlbumLinksBalance: true,
        sourceAlbumKeysUnique: true,
        stableCanonicalIdsUnique: true,
        stableEditionIdsUnique: true,
      },
      workbookReference: {
        candidateAlbums: 402,
        acceptedStandardMatches: 349,
        reviewCandidates: 53,
        candidateAlbumDelta: -401,
        resolvedAlbumDelta: -349,
        reviewAlbumDelta: -52,
      },
    },
  };
}

const overrideFile: ManualAlbumResolutionOverrideFile = {
  version: 1,
  overrides: [
    {
      source_album_key: "source_fixture",
      preferred_edition_id: "edn_alpha",
      note: "Human approved the proposed standard edition.",
    },
  ],
};

describe("album resolution overrides", () => {
  it("reads Windows PowerShell UTF-8 BOM files", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "needle-album-overrides-"));
    const file = path.join(dir, "album-resolution-overrides.json");
    try {
      await writeFile(file, `\uFEFF${JSON.stringify(overrideFile)}`, "utf8");
      await expect(readManualAlbumResolutionOverrides(file)).resolves.toEqual(overrideFile);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("approves only the chosen candidate and recomputes resolution counts", () => {
    const { result, summary } = applyManualAlbumResolutionOverrides(ambiguousResult(), overrideFile);

    expect(summary).toEqual({
      requested: 1,
      applied: 1,
      alreadyResolved: 0,
      orphanSourceAlbumKeys: [],
    });
    expect(result.links[0]).toMatchObject({
      resolution_status: "resolved",
      preferred_edition_id: "edn_alpha",
      edition_ambiguity: false,
      review_reasons: [],
    });
    expect(result.canonicalAlbums[0]).toMatchObject({
      preferred_edition_id: "edn_alpha",
      review_status: "accepted",
    });
    expect(result.editions.find((item) => item.edition_id === "edn_alpha")?.is_preferred).toBe(true);
    expect(result.editions.find((item) => item.edition_id === "edn_beta")?.is_preferred).toBe(false);
    expect(result.report.totals).toMatchObject({
      resolvedSourceAlbums: 1,
      reviewSourceAlbums: 0,
      ambiguousSourceAlbums: 0,
    });
    expect(result.report.workbookReference).toMatchObject({
      resolvedAlbumDelta: -348,
      reviewAlbumDelta: -53,
    });
  });

  it("is idempotent when the same edition is already resolved", () => {
    const first = applyManualAlbumResolutionOverrides(ambiguousResult(), overrideFile).result;
    const second = applyManualAlbumResolutionOverrides(first, overrideFile);

    expect(second.summary).toEqual({
      requested: 1,
      applied: 0,
      alreadyResolved: 1,
      orphanSourceAlbumKeys: [],
    });
    expect(second.result).toEqual(first);
  });

  it("refuses to force low-confidence or non-candidate identities", () => {
    const lowConfidence = ambiguousResult();
    lowConfidence.links[0]!.match_confidence = "none";
    expect(() => applyManualAlbumResolutionOverrides(lowConfidence, overrideFile)).toThrow(
      /requires high catalog confidence/,
    );

    const wrongEdition: ManualAlbumResolutionOverrideFile = {
      version: 1,
      overrides: [{ source_album_key: "source_fixture", preferred_edition_id: "edn_wrong" }],
    };
    expect(() => applyManualAlbumResolutionOverrides(ambiguousResult(), wrongEdition)).toThrow(
      /non-candidate edition/,
    );
  });
});
