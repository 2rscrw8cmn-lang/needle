import { readFile } from "node:fs/promises";
import type {
  AlbumResolutionLink,
  AlbumResolutionResult,
  SpotifyAlbumEdition,
} from "./album-resolver.ts";

export interface ManualAlbumResolutionOverride {
  source_album_key: string;
  preferred_edition_id: string;
  note?: string;
  updated_at?: string;
}

export interface ManualAlbumResolutionOverrideFile {
  version: 1;
  overrides: ManualAlbumResolutionOverride[];
}

export interface AlbumResolutionOverrideSummary {
  requested: number;
  applied: number;
  alreadyResolved: number;
  orphanSourceAlbumKeys: string[];
}

export async function readManualAlbumResolutionOverrides(
  filePath: string,
): Promise<ManualAlbumResolutionOverrideFile> {
  try {
    const text = await readFile(filePath, "utf8");
    const raw = JSON.parse(text.replace(/^\uFEFF/, "")) as unknown;
    assertOverrideFile(raw);
    return raw;
  } catch (error: unknown) {
    if (isMissingFileError(error)) return { version: 1, overrides: [] };
    throw error;
  }
}

export function applyManualAlbumResolutionOverrides(
  input: AlbumResolutionResult,
  overrideFile: ManualAlbumResolutionOverrideFile,
): { result: AlbumResolutionResult; summary: AlbumResolutionOverrideSummary } {
  assertOverrideFile(overrideFile);

  const links = input.links.map((link) => ({ ...link, review_reasons: [...link.review_reasons] }));
  const canonicalAlbums = input.canonicalAlbums.map((album) => ({
    ...album,
    source_album_keys: [...album.source_album_keys],
  }));
  const editions = input.editions.map((edition) => ({ ...edition, sources: [...edition.sources] }));

  const linkBySource = new Map(links.map((link) => [link.source_album_key, link] as const));
  const canonicalById = new Map(canonicalAlbums.map((album) => [album.canonical_album_id, album] as const));
  const editionById = new Map(editions.map((edition) => [edition.edition_id, edition] as const));
  const preferredOverrideByCanonical = new Map<string, string>();
  const orphanSourceAlbumKeys: string[] = [];
  let applied = 0;
  let alreadyResolved = 0;

  for (const override of overrideFile.overrides) {
    const link = linkBySource.get(override.source_album_key);
    if (!link) {
      orphanSourceAlbumKeys.push(override.source_album_key);
      continue;
    }

    if (
      link.resolution_status === "resolved" &&
      link.preferred_edition_id === override.preferred_edition_id
    ) {
      alreadyResolved += 1;
      continue;
    }

    assertSafeOverride(link, override.preferred_edition_id);

    const canonicalId = link.canonical_album_id!;
    const canonical = canonicalById.get(canonicalId);
    if (!canonical) {
      throw new Error(
        `Album resolution override ${override.source_album_key} references missing canonical album ${canonicalId}.`,
      );
    }

    const edition = editionById.get(override.preferred_edition_id);
    if (!edition || edition.canonical_album_id !== canonicalId) {
      throw new Error(
        `Album resolution override ${override.source_album_key} references edition ${override.preferred_edition_id} outside canonical album ${canonicalId}.`,
      );
    }

    const existingPreferred = preferredOverrideByCanonical.get(canonicalId);
    if (existingPreferred && existingPreferred !== override.preferred_edition_id) {
      throw new Error(
        `Album resolution overrides disagree for canonical album ${canonicalId}: ${existingPreferred} vs ${override.preferred_edition_id}.`,
      );
    }
    preferredOverrideByCanonical.set(canonicalId, override.preferred_edition_id);

    link.resolution_status = "resolved";
    link.preferred_edition_id = override.preferred_edition_id;
    link.edition_ambiguity = false;
    link.review_reasons = [];

    canonical.preferred_edition_id = override.preferred_edition_id;
    canonical.review_status = "accepted";
    applied += 1;
  }

  for (const edition of editions) {
    const preferred = preferredOverrideByCanonical.get(edition.canonical_album_id);
    if (preferred) edition.is_preferred = edition.edition_id === preferred;
  }

  const sortedLinks = links.sort((a, b) => a.source_album_key.localeCompare(b.source_album_key));
  const resolvedCount = sortedLinks.filter((link) => link.resolution_status === "resolved").length;
  const reviewCount = sortedLinks.length - resolvedCount;
  const ambiguousCount = sortedLinks.filter((link) => link.edition_ambiguity).length;

  const report = {
    ...input.report,
    totals: {
      ...input.report.totals,
      resolvedSourceAlbums: resolvedCount,
      reviewSourceAlbums: reviewCount,
      ambiguousSourceAlbums: ambiguousCount,
    },
    workbookReference: {
      ...input.report.workbookReference,
      resolvedAlbumDelta: resolvedCount - input.report.workbookReference.acceptedStandardMatches,
      reviewAlbumDelta: reviewCount - input.report.workbookReference.reviewCandidates,
    },
  };

  return {
    result: {
      canonicalAlbums,
      editions: editions.sort(compareEditions),
      links: sortedLinks,
      report,
    },
    summary: {
      requested: overrideFile.overrides.length,
      applied,
      alreadyResolved,
      orphanSourceAlbumKeys: orphanSourceAlbumKeys.sort(),
    },
  };
}

function assertSafeOverride(link: AlbumResolutionLink, preferredEditionId: string): void {
  if (!link.canonical_album_id) {
    throw new Error(
      `Album resolution override ${link.source_album_key} cannot force a source album with no canonical identity.`,
    );
  }
  if (link.match_confidence !== "high") {
    throw new Error(
      `Album resolution override ${link.source_album_key} requires high catalog confidence; found ${link.match_confidence}.`,
    );
  }
  if (!link.candidate_edition_ids.includes(preferredEditionId)) {
    throw new Error(
      `Album resolution override ${link.source_album_key} references non-candidate edition ${preferredEditionId}.`,
    );
  }
  const reasons = new Set(link.review_reasons);
  if (reasons.size !== 1 || !reasons.has("edition_selection_ambiguous")) {
    throw new Error(
      `Album resolution override ${link.source_album_key} may only approve a pure edition_selection_ambiguous review. Found: ${link.review_reasons.join(", ") || "none"}.`,
    );
  }
}

function assertOverrideFile(value: unknown): asserts value is ManualAlbumResolutionOverrideFile {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.overrides)) {
    throw new Error("Album resolution override file must be a version 1 object with an overrides array.");
  }

  const sourceKeys = new Set<string>();
  for (const override of value.overrides) {
    if (
      !isRecord(override) ||
      typeof override.source_album_key !== "string" ||
      !override.source_album_key ||
      typeof override.preferred_edition_id !== "string" ||
      !/^edn_[A-Za-z0-9]+$/.test(override.preferred_edition_id)
    ) {
      throw new Error("Album resolution override contains an invalid source_album_key or preferred_edition_id.");
    }
    if (sourceKeys.has(override.source_album_key)) {
      throw new Error(`Duplicate album resolution override for ${override.source_album_key}.`);
    }
    sourceKeys.add(override.source_album_key);
    if (override.note !== undefined && typeof override.note !== "string") {
      throw new Error(`Album resolution override ${override.source_album_key} has a non-string note.`);
    }
    if (override.updated_at !== undefined && typeof override.updated_at !== "string") {
      throw new Error(`Album resolution override ${override.source_album_key} has a non-string updated_at.`);
    }
  }
}

function compareEditions(a: SpotifyAlbumEdition, b: SpotifyAlbumEdition): number {
  return (
    a.canonical_album_id.localeCompare(b.canonical_album_id) ||
    Number(b.is_preferred) - Number(a.is_preferred) ||
    a.edition_id.localeCompare(b.edition_id)
  );
}

function isMissingFileError(value: unknown): value is NodeJS.ErrnoException {
  return value instanceof Error && "code" in value && value.code === "ENOENT";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
