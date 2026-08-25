import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const MAX_TRACK_PROBES_PER_ALBUM = 2;
export const MAX_TRACKLIST_CANDIDATES = 4;
export const WORKBOOK_CATALOG_REFERENCE = {
  candidateAlbums: 402,
  acceptedStandardMatches: 349,
  reviewCandidates: 53,
} as const;

export type AlbumResolutionStatus = "resolved" | "review";
export type AlbumMatchConfidence = "high" | "medium" | "none";
export type EditionType =
  | "standard"
  | "deluxe"
  | "expanded"
  | "remaster"
  | "anniversary"
  | "reissue"
  | "compilation"
  | "single"
  | "rerecording"
  | "other";

export interface NormalizedPlaybackEventInput {
  event_id: string;
  import_batch_id: string;
  played_at: string;
  ms_played: number;
  spotify_track_id: string | null;
  track_name: string;
  artist_name: string;
  album_name: string;
  [key: string]: unknown;
}

export interface AlbumSessionInput {
  session_id: string;
  source_album_key: string;
  evidence_status: "full" | "near_complete" | "sparse" | "review";
  event_ids: string[];
  [key: string]: unknown;
}

export interface ProvisionalAlbumInput {
  source_album_key: string;
  artist_name: string;
  album_name: string;
  known_local_track_count: number;
  known_local_track_keys: string[];
  qualifying_session_count: number;
  [key: string]: unknown;
}

export interface SessionizationReportInput {
  importBatchId: string;
  ok: boolean;
  totals: {
    normalizedEvents: number;
    provisionalCandidateAlbums: number;
    candidateSessions: number;
    [key: string]: number;
  };
}

export interface StageThreeArtifacts {
  report: SessionizationReportInput;
  provisionalAlbums: ProvisionalAlbumInput[];
  sessions: AlbumSessionInput[];
  events: NormalizedPlaybackEventInput[];
}

export interface SpotifyArtistSummary {
  id: string;
  name: string;
}

export interface SpotifyAlbumSummary {
  id: string;
  name: string;
  album_type: "album" | "single" | "compilation";
  total_tracks: number;
  release_date: string | null;
  artists: SpotifyArtistSummary[];
}

export interface SpotifyTrackSummary {
  id: string;
  name: string;
}

export interface SpotifyTrackLookup {
  id: string;
  name: string;
  album: SpotifyAlbumSummary;
}

export interface SpotifyCatalogProvider {
  getTrack(trackId: string): Promise<SpotifyTrackLookup | null>;
  searchAlbums(query: { artist: string; album: string; limit: number }): Promise<SpotifyAlbumSummary[]>;
  getAlbumTracks(albumId: string): Promise<SpotifyTrackSummary[]>;
}

export interface CanonicalAlbum {
  canonical_album_id: string;
  title: string;
  primary_artist_id: string;
  primary_artist_name: string;
  original_release_date: string | null;
  preferred_edition_id: string | null;
  catalog_confidence: AlbumMatchConfidence;
  review_status: "accepted" | "review";
  source_album_keys: string[];
}

export interface SpotifyAlbumEdition {
  edition_id: string;
  canonical_album_id: string;
  spotify_album_id: string;
  title: string;
  primary_artist_id: string;
  primary_artist_name: string;
  release_date: string | null;
  album_type: SpotifyAlbumSummary["album_type"];
  edition_type: EditionType;
  total_tracks: number;
  is_preferred: boolean;
  match_confidence: AlbumMatchConfidence;
  edition_ambiguity: boolean;
  resolution_score: number;
  title_similarity: number;
  artist_similarity: number;
  track_overlap_rate: number;
  observed_probe_share: number;
  sources: Array<"track_probe" | "search">;
}

export interface AlbumResolutionLink {
  source_album_key: string;
  source_artist_name: string;
  source_album_name: string;
  resolution_status: AlbumResolutionStatus;
  canonical_album_id: string | null;
  preferred_edition_id: string | null;
  proposed_preferred_edition_id: string | null;
  candidate_edition_ids: string[];
  match_confidence: AlbumMatchConfidence;
  edition_ambiguity: boolean;
  review_reasons: string[];
}

export interface AlbumResolutionReport {
  reportVersion: 1;
  resolutionVersion: 1;
  importBatchId: string;
  provider: "spotify" | "fixture";
  ok: boolean;
  totals: {
    provisionalSourceAlbums: number;
    resolvedSourceAlbums: number;
    reviewSourceAlbums: number;
    canonicalAlbums: number;
    spotifyEditions: number;
    ambiguousSourceAlbums: number;
    highConfidenceSourceAlbums: number;
    mediumConfidenceSourceAlbums: number;
    noConfidenceSourceAlbums: number;
    providerErrorAlbums: number;
  };
  reconciliation: {
    sourceAlbumLinksBalance: boolean;
    sourceAlbumKeysUnique: boolean;
    stableCanonicalIdsUnique: boolean;
    stableEditionIdsUnique: boolean;
  };
  workbookReference: {
    candidateAlbums: number;
    acceptedStandardMatches: number;
    reviewCandidates: number;
    candidateAlbumDelta: number;
    resolvedAlbumDelta: number;
    reviewAlbumDelta: number;
  };
}

export interface AlbumResolutionResult {
  canonicalAlbums: CanonicalAlbum[];
  editions: SpotifyAlbumEdition[];
  links: AlbumResolutionLink[];
  report: AlbumResolutionReport;
}

interface CandidateWork {
  summary: SpotifyAlbumSummary;
  sources: Set<"track_probe" | "search">;
  observedWeight: number;
  trackTitles: string[];
  trackListError: boolean;
}

interface ScoredCandidate {
  summary: SpotifyAlbumSummary;
  sources: Array<"track_probe" | "search">;
  observedProbeShare: number;
  editionType: EditionType;
  familyTitle: string;
  familyKey: string;
  titleSimilarity: number;
  artistSimilarity: number;
  trackOverlapRate: number;
  resolutionScore: number;
  matchConfidence: AlbumMatchConfidence;
  identityPlausible: boolean;
}

export async function readStageThreeArtifacts(inputDir: string): Promise<StageThreeArtifacts> {
  const [report, provisionalAlbums, sessions, events] = await Promise.all([
    readJson(path.join(inputDir, "sessionization-report.json")),
    readJson(path.join(inputDir, "provisional-albums.json")),
    readJson(path.join(inputDir, "album-sessions.json")),
    readJson(path.join(inputDir, "normalized-playback-events.json")),
  ]);
  assertReport(report);
  assertProvisionalAlbums(provisionalAlbums);
  assertSessions(sessions);
  assertEvents(events);
  const artifacts = { report, provisionalAlbums, sessions, events };
  validateStageThreeContract(artifacts);
  return artifacts;
}

export async function resolveAlbumCatalog(options: {
  artifacts: StageThreeArtifacts;
  provider: SpotifyCatalogProvider;
  providerName?: "spotify" | "fixture";
}): Promise<AlbumResolutionResult> {
  validateStageThreeContract(options.artifacts);
  const eventById = new Map(options.artifacts.events.map((event) => [event.event_id, event] as const));
  const sessionsByAlbum = groupSessions(options.artifacts.sessions);
  const canonicalMap = new Map<string, CanonicalAlbum>();
  const editionMap = new Map<string, SpotifyAlbumEdition>();
  const links: AlbumResolutionLink[] = [];
  let providerErrorAlbums = 0;

  const sourceAlbums = [...options.artifacts.provisionalAlbums].sort(compareSourceAlbums);
  for (const sourceAlbum of sourceAlbums) {
    const resolved = await resolveOneAlbum(
      sourceAlbum,
      sessionsByAlbum.get(sourceAlbum.source_album_key) ?? [],
      eventById,
      options.provider,
    );
    if (resolved.providerError) providerErrorAlbums += 1;
    links.push(resolved.link);
    if (!resolved.canonicalAlbum) continue;
    canonicalMap.set(
      resolved.canonicalAlbum.canonical_album_id,
      mergeCanonical(canonicalMap.get(resolved.canonicalAlbum.canonical_album_id), resolved.canonicalAlbum),
    );
    for (const edition of resolved.editions) {
      editionMap.set(edition.edition_id, mergeEdition(editionMap.get(edition.edition_id), edition));
    }
  }

  const canonicalAlbums = [...canonicalMap.values()].sort(compareCanonicalAlbums);
  const editions = [...editionMap.values()].sort(compareEditions);
  const sortedLinks = links.sort((a, b) => a.source_album_key.localeCompare(b.source_album_key));
  const preferredByCanonical = new Map(
    canonicalAlbums
      .filter((album) => album.preferred_edition_id)
      .map((album) => [album.canonical_album_id, album.preferred_edition_id] as const),
  );
  for (const edition of editions) {
    edition.is_preferred = preferredByCanonical.get(edition.canonical_album_id) === edition.edition_id;
  }

  const resolvedCount = sortedLinks.filter((link) => link.resolution_status === "resolved").length;
  const reviewCount = sortedLinks.length - resolvedCount;
  const confidence = countConfidence(sortedLinks);
  const sourceKeys = sortedLinks.map((link) => link.source_album_key);
  const sourceAlbumKeysUnique = new Set(sourceKeys).size === sourceKeys.length;
  const stableCanonicalIdsUnique =
    new Set(canonicalAlbums.map((album) => album.canonical_album_id)).size === canonicalAlbums.length;
  const stableEditionIdsUnique =
    new Set(editions.map((edition) => edition.edition_id)).size === editions.length;
  const sourceAlbumLinksBalance = sortedLinks.length === sourceAlbums.length;

  const report: AlbumResolutionReport = {
    reportVersion: 1,
    resolutionVersion: 1,
    importBatchId: options.artifacts.report.importBatchId,
    provider: options.providerName ?? "spotify",
    ok:
      sourceAlbumLinksBalance &&
      sourceAlbumKeysUnique &&
      stableCanonicalIdsUnique &&
      stableEditionIdsUnique,
    totals: {
      provisionalSourceAlbums: sourceAlbums.length,
      resolvedSourceAlbums: resolvedCount,
      reviewSourceAlbums: reviewCount,
      canonicalAlbums: canonicalAlbums.length,
      spotifyEditions: editions.length,
      ambiguousSourceAlbums: sortedLinks.filter((link) => link.edition_ambiguity).length,
      highConfidenceSourceAlbums: confidence.high,
      mediumConfidenceSourceAlbums: confidence.medium,
      noConfidenceSourceAlbums: confidence.none,
      providerErrorAlbums,
    },
    reconciliation: {
      sourceAlbumLinksBalance,
      sourceAlbumKeysUnique,
      stableCanonicalIdsUnique,
      stableEditionIdsUnique,
    },
    workbookReference: {
      candidateAlbums: WORKBOOK_CATALOG_REFERENCE.candidateAlbums,
      acceptedStandardMatches: WORKBOOK_CATALOG_REFERENCE.acceptedStandardMatches,
      reviewCandidates: WORKBOOK_CATALOG_REFERENCE.reviewCandidates,
      candidateAlbumDelta: sourceAlbums.length - WORKBOOK_CATALOG_REFERENCE.candidateAlbums,
      resolvedAlbumDelta: resolvedCount - WORKBOOK_CATALOG_REFERENCE.acceptedStandardMatches,
      reviewAlbumDelta: reviewCount - WORKBOOK_CATALOG_REFERENCE.reviewCandidates,
    },
  };
  return { canonicalAlbums, editions, links: sortedLinks, report };
}

async function resolveOneAlbum(
  sourceAlbum: ProvisionalAlbumInput,
  sessions: AlbumSessionInput[],
  eventById: Map<string, NormalizedPlaybackEventInput>,
  provider: SpotifyCatalogProvider,
): Promise<{
  canonicalAlbum: CanonicalAlbum | null;
  editions: SpotifyAlbumEdition[];
  link: AlbumResolutionLink;
  providerError: boolean;
}> {
  const reviewReasons = new Set<string>();
  const trackCounts = collectSpotifyTrackCounts(sessions, eventById);
  const probeIds = [...trackCounts.entries()]
    .sort(([a, ac], [b, bc]) => bc - ac || a.localeCompare(b))
    .slice(0, MAX_TRACK_PROBES_PER_ALBUM)
    .map(([id]) => id);
  if (probeIds.length === 0) reviewReasons.add("no_spotify_track_identity");

  const candidates = new Map<string, CandidateWork>();
  let providerError = false;
  let totalProbeWeight = 0;
  for (const trackId of probeIds) {
    const lookup = await safeCall(() => provider.getTrack(trackId));
    if (!lookup.ok) {
      providerError = true;
      reviewReasons.add("provider_track_lookup_failed");
      continue;
    }
    if (!lookup.value) continue;
    const weight = trackCounts.get(trackId) ?? 0;
    totalProbeWeight += weight;
    addCandidate(candidates, lookup.value.album, "track_probe", weight);
  }

  const search = await safeCall(() =>
    provider.searchAlbums({
      artist: sourceAlbum.artist_name,
      album: canonicalizeEditionTitle(sourceAlbum.album_name).familyTitle,
      limit: 10,
    }),
  );
  if (!search.ok) {
    providerError = true;
    reviewReasons.add("provider_album_search_failed");
  } else {
    for (const album of search.value) addCandidate(candidates, album, "search", 0);
  }

  if (candidates.size === 0) {
    reviewReasons.add("no_catalog_candidates");
    return { canonicalAlbum: null, editions: [], link: reviewLink(sourceAlbum, reviewReasons), providerError };
  }

  const preliminary = [...candidates.values()]
    .map((candidate) => ({ candidate, score: preliminaryScore(sourceAlbum, candidate, totalProbeWeight) }))
    .sort((a, b) => b.score - a.score || a.candidate.summary.id.localeCompare(b.candidate.summary.id));
  const tracklistTargets = new Map<string, CandidateWork>();
  for (const { candidate } of preliminary.slice(0, MAX_TRACKLIST_CANDIDATES)) {
    tracklistTargets.set(candidate.summary.id, candidate);
  }
  for (const candidate of candidates.values()) {
    if (candidate.sources.has("track_probe")) tracklistTargets.set(candidate.summary.id, candidate);
  }
  for (const candidate of tracklistTargets.values()) {
    const tracks = await safeCall(() => provider.getAlbumTracks(candidate.summary.id));
    if (!tracks.ok) {
      providerError = true;
      candidate.trackListError = true;
      reviewReasons.add("provider_album_tracks_failed");
    } else {
      candidate.trackTitles = tracks.value.map((track) => track.name);
    }
  }

  const scored = [...candidates.values()]
    .map((candidate) => scoreCandidate(sourceAlbum, candidate, totalProbeWeight))
    .filter((candidate) => candidate.resolutionScore >= 0.35 || candidate.observedProbeShare > 0)
    .sort(compareScored);
  if (scored.length === 0) {
    reviewReasons.add("no_plausible_catalog_match");
    return { canonicalAlbum: null, editions: [], link: reviewLink(sourceAlbum, reviewReasons), providerError };
  }

  const groups = groupFamilies(scored);
  const rankedGroups = [...groups.entries()]
    .map(([key, group]) => ({ key, group, score: Math.max(...group.map((item) => item.resolutionScore)) }))
    .sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));
  const winner = rankedGroups[0];
  if (!winner || !winner.group.some((candidate) => candidate.identityPlausible)) {
    reviewReasons.add("low_identity_confidence");
    return { canonicalAlbum: null, editions: [], link: reviewLink(sourceAlbum, reviewReasons), providerError };
  }
  if (rankedGroups[1] && rankedGroups[1].score >= winner.score - 0.04) {
    reviewReasons.add("competing_canonical_families");
  }

  const preferredRanking = [...winner.group].sort(comparePreferred);
  const preferred = preferredRanking[0];
  if (!preferred) {
    reviewReasons.add("no_preferred_edition");
    return { canonicalAlbum: null, editions: [], link: reviewLink(sourceAlbum, reviewReasons), providerError };
  }
  const next = preferredRanking[1];
  const editionAmbiguity = Boolean(
    next &&
      preferredScore(next) >= preferredScore(preferred) - 0.035 &&
      next.summary.id !== preferred.summary.id &&
      !isLowRiskEditionPair(preferred.editionType, next.editionType),
  );
  if (editionAmbiguity) reviewReasons.add("edition_selection_ambiguous");
  if (preferred.summary.album_type === "compilation" && preferred.artistSimilarity < 0.95) {
    reviewReasons.add("compilation_identity_risk");
  }

  const confidence = bestConfidence(winner.group);
  if (confidence === "none") reviewReasons.add("low_match_confidence");
  const canonical = canonicalIdentity(preferred);
  const canonicalAlbumId = stableId("can", canonical.key);
  const competing = reviewReasons.has("competing_canonical_families");
  const accepted =
    confidence !== "none" &&
    !editionAmbiguity &&
    !competing &&
    !reviewReasons.has("compilation_identity_risk");
  const proposedPreferredEditionId = editionId(preferred.summary.id);
  const editions = winner.group
    .map((candidate) =>
      toEdition(
        candidate,
        canonicalAlbumId,
        accepted ? proposedPreferredEditionId : null,
        editionAmbiguity || competing,
      ),
    )
    .sort(compareEditions);
  const canonicalAlbum: CanonicalAlbum = {
    canonical_album_id: canonicalAlbumId,
    title: canonical.title,
    primary_artist_id: canonical.artistId,
    primary_artist_name: canonical.artistName,
    original_release_date: earliestReleaseDate(winner.group),
    preferred_edition_id: accepted ? proposedPreferredEditionId : null,
    catalog_confidence: confidence,
    review_status: accepted ? "accepted" : "review",
    source_album_keys: [sourceAlbum.source_album_key],
  };
  return {
    canonicalAlbum,
    editions,
    providerError,
    link: {
      source_album_key: sourceAlbum.source_album_key,
      source_artist_name: sourceAlbum.artist_name,
      source_album_name: sourceAlbum.album_name,
      resolution_status: accepted ? "resolved" : "review",
      canonical_album_id: canonicalAlbumId,
      preferred_edition_id: accepted ? proposedPreferredEditionId : null,
      proposed_preferred_edition_id: proposedPreferredEditionId,
      candidate_edition_ids: editions.map((edition) => edition.edition_id),
      match_confidence: confidence,
      edition_ambiguity: editionAmbiguity || competing,
      review_reasons: [...reviewReasons].sort(),
    },
  };
}

function collectSpotifyTrackCounts(
  sessions: AlbumSessionInput[],
  eventById: Map<string, NormalizedPlaybackEventInput>,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const session of sessions) {
    for (const eventId of session.event_ids) {
      const trackId = eventById.get(eventId)?.spotify_track_id;
      if (trackId) counts.set(trackId, (counts.get(trackId) ?? 0) + 1);
    }
  }
  return counts;
}

function addCandidate(
  target: Map<string, CandidateWork>,
  summary: SpotifyAlbumSummary,
  source: "track_probe" | "search",
  observedWeight: number,
): void {
  if (!validAlbum(summary)) return;
  const existing = target.get(summary.id);
  if (existing) {
    existing.sources.add(source);
    existing.observedWeight += observedWeight;
  } else {
    target.set(summary.id, {
      summary,
      sources: new Set([source]),
      observedWeight,
      trackTitles: [],
      trackListError: false,
    });
  }
}

function preliminaryScore(
  source: ProvisionalAlbumInput,
  candidate: CandidateWork,
  totalProbeWeight: number,
): number {
  const sourceTitle = canonicalizeEditionTitle(source.album_name).familyTitle;
  const candidateTitle = canonicalizeEditionTitle(candidate.summary.name).familyTitle;
  const title = stringSimilarity(normalizeLabel(sourceTitle), normalizeLabel(candidateTitle));
  const artist = bestArtistSimilarity(source.artist_name, candidate.summary.artists);
  const observed = totalProbeWeight ? candidate.observedWeight / totalProbeWeight : 0;
  return round(0.52 * title + 0.38 * artist + 0.1 * observed, 4);
}

function scoreCandidate(
  source: ProvisionalAlbumInput,
  candidate: CandidateWork,
  totalProbeWeight: number,
): ScoredCandidate {
  const sourceFamily = canonicalizeEditionTitle(source.album_name).familyTitle;
  const candidateFamily = canonicalizeEditionTitle(candidate.summary.name);
  const titleSimilarity = stringSimilarity(normalizeLabel(sourceFamily), normalizeLabel(candidateFamily.familyTitle));
  const artistSimilarity = bestArtistSimilarity(source.artist_name, candidate.summary.artists);
  const candidateTracks = new Set(candidate.trackTitles.map(trackKey));
  const overlap = source.known_local_track_keys.filter((key) => candidateTracks.has(key)).length;
  const trackOverlapRate = source.known_local_track_count ? overlap / source.known_local_track_count : 0;
  const observedProbeShare = totalProbeWeight ? candidate.observedWeight / totalProbeWeight : 0;
  const editionType = inferEditionType(candidate.summary.name, candidate.summary.album_type);
  const primaryArtist = candidate.summary.artists[0] ?? { id: "", name: "" };
  const familyKey = `${primaryArtist.id || normalizeLabel(primaryArtist.name)}\u241f${normalizeLabel(candidateFamily.familyTitle)}`;
  let resolutionScore =
    0.3 * titleSimilarity +
    0.24 * artistSimilarity +
    0.34 * trackOverlapRate +
    0.12 * observedProbeShare +
    editionPreferenceBonus(editionType);
  if (candidate.trackListError) resolutionScore -= 0.08;
  if (candidate.summary.album_type === "compilation" && artistSimilarity < 0.95) resolutionScore -= 0.1;
  resolutionScore = clamp01(resolutionScore);
  const identityPlausible =
    titleSimilarity >= 0.76 &&
    artistSimilarity >= 0.78 &&
    (trackOverlapRate >= 0.5 || observedProbeShare >= 0.5);
  const matchConfidence: AlbumMatchConfidence =
    identityPlausible &&
    resolutionScore >= 0.82 &&
    titleSimilarity >= 0.9 &&
    artistSimilarity >= 0.9 &&
    (trackOverlapRate >= 0.75 || observedProbeShare >= 0.8)
      ? "high"
      : identityPlausible && resolutionScore >= 0.65
        ? "medium"
        : "none";
  return {
    summary: candidate.summary,
    sources: [...candidate.sources].sort(),
    observedProbeShare: round(observedProbeShare, 4),
    editionType,
    familyTitle: candidateFamily.familyTitle,
    familyKey,
    titleSimilarity: round(titleSimilarity, 4),
    artistSimilarity: round(artistSimilarity, 4),
    trackOverlapRate: round(trackOverlapRate, 4),
    resolutionScore: round(resolutionScore, 4),
    matchConfidence,
    identityPlausible,
  };
}

function groupFamilies(scored: ScoredCandidate[]): Map<string, ScoredCandidate[]> {
  const result = new Map<string, ScoredCandidate[]>();
  for (const candidate of scored) {
    const group = result.get(candidate.familyKey) ?? [];
    group.push(candidate);
    result.set(candidate.familyKey, group);
  }
  return result;
}

function compareScored(a: ScoredCandidate, b: ScoredCandidate): number {
  return b.resolutionScore - a.resolutionScore || a.summary.id.localeCompare(b.summary.id);
}

function comparePreferred(a: ScoredCandidate, b: ScoredCandidate): number {
  return preferredScore(b) - preferredScore(a) || a.summary.id.localeCompare(b.summary.id);
}

function preferredScore(candidate: ScoredCandidate): number {
  return candidate.resolutionScore + editionPreferenceBonus(candidate.editionType) * 1.8;
}

function editionPreferenceBonus(type: EditionType): number {
  switch (type) {
    case "standard": return 0.075;
    case "remaster": return 0.025;
    case "reissue": return 0.018;
    case "expanded": return 0;
    case "deluxe": return -0.012;
    case "anniversary": return -0.018;
    case "rerecording": return 0.035;
    case "compilation": return -0.055;
    case "single": return -0.07;
    default: return -0.01;
  }
}

function isLowRiskEditionPair(a: EditionType, b: EditionType): boolean {
  const variants = new Set<EditionType>(["deluxe", "expanded", "remaster", "anniversary", "reissue"]);
  return (a === "standard" && variants.has(b)) || (b === "standard" && variants.has(a));
}

function bestConfidence(candidates: ScoredCandidate[]): AlbumMatchConfidence {
  if (candidates.some((candidate) => candidate.matchConfidence === "high")) return "high";
  if (candidates.some((candidate) => candidate.matchConfidence === "medium")) return "medium";
  return "none";
}

function canonicalIdentity(candidate: ScoredCandidate): {
  key: string;
  title: string;
  artistId: string;
  artistName: string;
} {
  const artist = candidate.summary.artists[0] ?? { id: "", name: "Unknown Artist" };
  const artistId = artist.id || `name_${stableHash(normalizeLabel(artist.name)).slice(0, 20)}`;
  return {
    key: `${artistId}\u241f${normalizeLabel(candidate.familyTitle)}`,
    title: candidate.familyTitle,
    artistId,
    artistName: artist.name,
  };
}

function toEdition(
  candidate: ScoredCandidate,
  canonicalAlbumId: string,
  preferredEditionId: string | null,
  ambiguity: boolean,
): SpotifyAlbumEdition {
  const artist = candidate.summary.artists[0] ?? { id: "", name: "Unknown Artist" };
  const id = editionId(candidate.summary.id);
  return {
    edition_id: id,
    canonical_album_id: canonicalAlbumId,
    spotify_album_id: candidate.summary.id,
    title: candidate.summary.name,
    primary_artist_id: artist.id,
    primary_artist_name: artist.name,
    release_date: candidate.summary.release_date,
    album_type: candidate.summary.album_type,
    edition_type: candidate.editionType,
    total_tracks: candidate.summary.total_tracks,
    is_preferred: id === preferredEditionId,
    match_confidence: candidate.matchConfidence,
    edition_ambiguity: ambiguity,
    resolution_score: candidate.resolutionScore,
    title_similarity: candidate.titleSimilarity,
    artist_similarity: candidate.artistSimilarity,
    track_overlap_rate: candidate.trackOverlapRate,
    observed_probe_share: candidate.observedProbeShare,
    sources: candidate.sources,
  };
}

function mergeCanonical(existing: CanonicalAlbum | undefined, incoming: CanonicalAlbum): CanonicalAlbum {
  if (!existing) return incoming;
  return {
    ...existing,
    original_release_date: earlierDate(existing.original_release_date, incoming.original_release_date),
    preferred_edition_id: existing.preferred_edition_id ?? incoming.preferred_edition_id,
    catalog_confidence: maxConfidence(existing.catalog_confidence, incoming.catalog_confidence),
    review_status:
      existing.review_status === "accepted" || incoming.review_status === "accepted" ? "accepted" : "review",
    source_album_keys: sortedUnique([...existing.source_album_keys, ...incoming.source_album_keys]),
  };
}

function mergeEdition(existing: SpotifyAlbumEdition | undefined, incoming: SpotifyAlbumEdition): SpotifyAlbumEdition {
  if (!existing) return incoming;
  return {
    ...existing,
    is_preferred: existing.is_preferred || incoming.is_preferred,
    match_confidence: maxConfidence(existing.match_confidence, incoming.match_confidence),
    edition_ambiguity: existing.edition_ambiguity || incoming.edition_ambiguity,
    resolution_score: Math.max(existing.resolution_score, incoming.resolution_score),
    title_similarity: Math.max(existing.title_similarity, incoming.title_similarity),
    artist_similarity: Math.max(existing.artist_similarity, incoming.artist_similarity),
    track_overlap_rate: Math.max(existing.track_overlap_rate, incoming.track_overlap_rate),
    observed_probe_share: Math.max(existing.observed_probe_share, incoming.observed_probe_share),
    sources: sortedUnique([...existing.sources, ...incoming.sources]) as Array<"track_probe" | "search">,
  };
}

function reviewLink(source: ProvisionalAlbumInput, reasons: Set<string>): AlbumResolutionLink {
  return {
    source_album_key: source.source_album_key,
    source_artist_name: source.artist_name,
    source_album_name: source.album_name,
    resolution_status: "review",
    canonical_album_id: null,
    preferred_edition_id: null,
    proposed_preferred_edition_id: null,
    candidate_edition_ids: [],
    match_confidence: "none",
    edition_ambiguity: false,
    review_reasons: [...reasons].sort(),
  };
}

export function canonicalizeEditionTitle(title: string): { familyTitle: string; editionType: EditionType } {
  const original = title.trim();
  const lower = asciiFold(original).toLowerCase();
  if (/taylor'?s\s+version|re[- ]?record(?:ed|ing)?|new\s+recording/.test(lower)) {
    return { familyTitle: original, editionType: "rerecording" };
  }
  const editionType = inferEditionType(original, "album");
  let family = original;
  const patterns = [
    /\s*[([]\s*(?:\d+(?:st|nd|rd|th)?\s+)?anniversary(?:\s+edition)?\s*[)\]]\s*$/i,
    /\s*[([]\s*(?:super\s+)?deluxe(?:\s+(?:edition|version))?\s*[)\]]\s*$/i,
    /\s*[([]\s*expanded(?:\s+edition)?\s*[)\]]\s*$/i,
    /\s*[([]\s*(?:\d{4}\s+)?remaster(?:ed)?(?:\s+\d{4})?\s*[)\]]\s*$/i,
    /\s*[-–—]\s*(?:\d+(?:st|nd|rd|th)?\s+)?anniversary(?:\s+edition)?\s*$/i,
    /\s*[-–—]\s*(?:super\s+)?deluxe(?:\s+(?:edition|version))?\s*$/i,
    /\s*[-–—]\s*expanded(?:\s+edition)?\s*$/i,
    /\s*[-–—]\s*(?:\d{4}\s+)?remaster(?:ed)?(?:\s+\d{4})?\s*$/i,
  ];
  for (const pattern of patterns) family = family.replace(pattern, "").trim();
  return { familyTitle: family || original, editionType };
}

export function inferEditionType(
  title: string,
  albumType: SpotifyAlbumSummary["album_type"],
): EditionType {
  const lower = asciiFold(title).toLowerCase();
  if (/taylor'?s\s+version|re[- ]?record(?:ed|ing)?|new\s+recording/.test(lower)) return "rerecording";
  if (albumType === "compilation") return "compilation";
  if (albumType === "single") return "single";
  if (/anniversary/.test(lower)) return "anniversary";
  if (/deluxe/.test(lower)) return "deluxe";
  if (/expanded/.test(lower)) return "expanded";
  if (/remaster/.test(lower)) return "remaster";
  if (/reissue|re-issue/.test(lower)) return "reissue";
  return "standard";
}

export function normalizeLabel(value: string): string {
  return asciiFold(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function trackKey(value: string): string {
  return asciiFold(value)
    .replace(/\s*[-–—(]\s*(?:\d{4}\s+)?remaster(?:ed)?(?:\s+\d{4})?\s*\)?\s*$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export function stringSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = previous[0] ?? 0;
    previous[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const above = previous[j] ?? j;
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      previous[j] = Math.min((previous[j - 1] ?? 0) + 1, above + 1, diagonal + cost);
      diagonal = above;
    }
  }
  return clamp01(1 - (previous[b.length] ?? Math.max(a.length, b.length)) / Math.max(a.length, b.length));
}

function bestArtistSimilarity(source: string, artists: SpotifyArtistSummary[]): number {
  if (artists.length === 0) return 0;
  const key = normalizeLabel(source);
  return Math.max(...artists.map((artist) => stringSimilarity(key, normalizeLabel(artist.name))));
}

function validateStageThreeContract(artifacts: StageThreeArtifacts): void {
  if (!artifacts.report.ok) throw new Error("1.03 artifact contract error: sessionization report is not passing.");
  if (artifacts.report.totals.provisionalCandidateAlbums !== artifacts.provisionalAlbums.length) {
    throw new Error("1.03 artifact contract error: provisional album count does not match provisional-albums.json.");
  }
  if (artifacts.report.totals.candidateSessions !== artifacts.sessions.length) {
    throw new Error("1.03 artifact contract error: candidate session count does not match album-sessions.json.");
  }
  if (artifacts.report.totals.normalizedEvents !== artifacts.events.length) {
    throw new Error("1.03 artifact contract error: normalized event count does not match normalized-playback-events.json.");
  }
  const sourceKeys = artifacts.provisionalAlbums.map((album) => album.source_album_key);
  if (new Set(sourceKeys).size !== sourceKeys.length) {
    throw new Error("1.03 artifact contract error: duplicate provisional source_album_key.");
  }
  const sourceSet = new Set(sourceKeys);
  const eventSet = new Set(artifacts.events.map((event) => event.event_id));
  for (const session of artifacts.sessions) {
    if (!sourceSet.has(session.source_album_key)) {
      throw new Error(`1.03 artifact contract error: session ${session.session_id} has unknown source album.`);
    }
    for (const eventId of session.event_ids) {
      if (!eventSet.has(eventId)) {
        throw new Error(`1.03 artifact contract error: session ${session.session_id} references unknown event ${eventId}.`);
      }
    }
  }
}

export async function writeAlbumResolutionOutputs(options: {
  outputDir: string;
  result: AlbumResolutionResult;
}): Promise<void> {
  await mkdir(options.outputDir, { recursive: true });
  const files: Array<[string, unknown]> = [
    ["canonical-albums.json", options.result.canonicalAlbums],
    ["spotify-album-editions.json", options.result.editions],
    ["album-resolution-links.json", options.result.links],
    ["album-resolution-review.json", options.result.links.filter((link) => link.resolution_status === "review")],
    ["album-resolution-report.json", options.result.report],
  ];
  await Promise.all(
    files.map(([name, value]) => writeFile(path.join(options.outputDir, name), `${JSON.stringify(value, null, 2)}\n`, "utf8")),
  );
  await writeFile(
    path.join(options.outputDir, "album-resolution-report.md"),
    `${renderAlbumResolutionReportMarkdown(options.result.report)}\n`,
    "utf8",
  );
}

export function renderAlbumResolutionReportMarkdown(report: AlbumResolutionReport): string {
  return [
    "# Needle Album / Spotify Edition Resolution",
    "",
    `- Import batch: \`${report.importBatchId}\``,
    `- Catalog provider: **${report.provider}**`,
    `- Result: **${report.ok ? "PASS" : "FAIL"}**`,
    "",
    "## Counts",
    "",
    "| Metric | Count |",
    "| --- | ---: |",
    `| Provisional source albums | ${report.totals.provisionalSourceAlbums} |`,
    `| Resolved source albums | ${report.totals.resolvedSourceAlbums} |`,
    `| Review source albums | ${report.totals.reviewSourceAlbums} |`,
    `| Canonical albums | ${report.totals.canonicalAlbums} |`,
    `| Spotify editions retained | ${report.totals.spotifyEditions} |`,
    `| Edition-ambiguous source albums | ${report.totals.ambiguousSourceAlbums} |`,
    `| High confidence | ${report.totals.highConfidenceSourceAlbums} |`,
    `| Medium confidence | ${report.totals.mediumConfidenceSourceAlbums} |`,
    `| No confidence | ${report.totals.noConfidenceSourceAlbums} |`,
    `| Albums with provider errors | ${report.totals.providerErrorAlbums} |`,
    "",
    "## Workbook calibration",
    "",
    "The private workbook is calibration only and is not required for another listener's import. Its current catalog set contains 402 candidates: 349 accepted standard-release matches and 53 review candidates. Needle resolves Spotify identities directly rather than reproducing the workbook's MusicBrainz release IDs.",
    "",
    "| Metric | Workbook | 1.04 | Delta |",
    "| --- | ---: | ---: | ---: |",
    `| Candidate albums | ${report.workbookReference.candidateAlbums} | ${report.totals.provisionalSourceAlbums} | ${signed(report.workbookReference.candidateAlbumDelta)} |`,
    `| Accepted/resolved | ${report.workbookReference.acceptedStandardMatches} | ${report.totals.resolvedSourceAlbums} | ${signed(report.workbookReference.resolvedAlbumDelta)} |`,
    `| Review | ${report.workbookReference.reviewCandidates} | ${report.totals.reviewSourceAlbums} | ${signed(report.workbookReference.reviewAlbumDelta)} |`,
    "",
    "Canonical Album and Spotify AlbumEdition remain separate. Low-risk deluxe/remaster/expanded/anniversary/reissue variants can share a canonical family. Re-recordings remain distinct. Weak, compilation-risk, competing-family, or genuinely ambiguous edition matches go to Review rather than being forced by title equality.",
  ].join("\n");
}

function groupSessions(sessions: AlbumSessionInput[]): Map<string, AlbumSessionInput[]> {
  const result = new Map<string, AlbumSessionInput[]>();
  for (const session of sessions) {
    const group = result.get(session.source_album_key) ?? [];
    group.push(session);
    result.set(session.source_album_key, group);
  }
  return result;
}

function countConfidence(links: AlbumResolutionLink[]): Record<AlbumMatchConfidence, number> {
  const counts: Record<AlbumMatchConfidence, number> = { high: 0, medium: 0, none: 0 };
  for (const link of links) counts[link.match_confidence] += 1;
  return counts;
}

function earliestReleaseDate(candidates: ScoredCandidate[]): string | null {
  return candidates
    .map((candidate) => candidate.summary.release_date)
    .filter((value): value is string => Boolean(value))
    .sort()[0] ?? null;
}

function earlierDate(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a < b ? a : b;
}

function maxConfidence(a: AlbumMatchConfidence, b: AlbumMatchConfidence): AlbumMatchConfidence {
  const rank: Record<AlbumMatchConfidence, number> = { none: 0, medium: 1, high: 2 };
  return rank[a] >= rank[b] ? a : b;
}

function validAlbum(album: SpotifyAlbumSummary): boolean {
  return (
    typeof album.id === "string" &&
    album.id.length > 0 &&
    typeof album.name === "string" &&
    ["album", "single", "compilation"].includes(album.album_type) &&
    Number.isInteger(album.total_tracks) &&
    Array.isArray(album.artists) &&
    album.artists.every((artist) => typeof artist.id === "string" && typeof artist.name === "string")
  );
}

function compareSourceAlbums(a: ProvisionalAlbumInput, b: ProvisionalAlbumInput): number {
  return a.artist_name.localeCompare(b.artist_name) || a.album_name.localeCompare(b.album_name) || a.source_album_key.localeCompare(b.source_album_key);
}

function compareCanonicalAlbums(a: CanonicalAlbum, b: CanonicalAlbum): number {
  return a.primary_artist_name.localeCompare(b.primary_artist_name) || a.title.localeCompare(b.title) || a.canonical_album_id.localeCompare(b.canonical_album_id);
}

function compareEditions(a: SpotifyAlbumEdition, b: SpotifyAlbumEdition): number {
  return a.canonical_album_id.localeCompare(b.canonical_album_id) || Number(b.is_preferred) - Number(a.is_preferred) || a.edition_id.localeCompare(b.edition_id);
}

function editionId(spotifyAlbumId: string): string {
  return `edn_${spotifyAlbumId}`;
}

function stableId(prefix: string, value: string): string {
  return `${prefix}_${stableHash(value).slice(0, 32)}`;
}

function stableHash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function asciiFold(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[’‘]/g, "'").replace(/[“”]/g, '"').trim();
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function round(value: number, digits: number): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function sortedUnique<T extends string>(values: T[]): T[] {
  return [...new Set(values)].sort() as T[];
}

function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

async function safeCall<T>(callback: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false }> {
  try {
    return { ok: true, value: await callback() };
  } catch {
    return { ok: false };
  }
}

function assertReport(value: unknown): asserts value is SessionizationReportInput {
  if (!isRecord(value) || typeof value.importBatchId !== "string" || typeof value.ok !== "boolean" || !isRecord(value.totals) || !Number.isInteger(value.totals.normalizedEvents) || !Number.isInteger(value.totals.provisionalCandidateAlbums) || !Number.isInteger(value.totals.candidateSessions)) {
    throw new Error("1.03 artifact contract error: invalid sessionization-report.json shape.");
  }
}

function assertProvisionalAlbums(value: unknown): asserts value is ProvisionalAlbumInput[] {
  if (!Array.isArray(value)) throw new Error("1.03 artifact contract error: provisional-albums.json must be an array.");
  for (const album of value) {
    if (!isRecord(album) || typeof album.source_album_key !== "string" || typeof album.artist_name !== "string" || typeof album.album_name !== "string" || !Number.isInteger(album.known_local_track_count) || !Array.isArray(album.known_local_track_keys)) {
      throw new Error("1.03 artifact contract error: invalid provisional album.");
    }
  }
}

function assertSessions(value: unknown): asserts value is AlbumSessionInput[] {
  if (!Array.isArray(value)) throw new Error("1.03 artifact contract error: album-sessions.json must be an array.");
  for (const session of value) {
    if (!isRecord(session) || typeof session.session_id !== "string" || typeof session.source_album_key !== "string" || !Array.isArray(session.event_ids)) {
      throw new Error("1.03 artifact contract error: invalid album session.");
    }
  }
}

function assertEvents(value: unknown): asserts value is NormalizedPlaybackEventInput[] {
  if (!Array.isArray(value)) throw new Error("1.03 artifact contract error: normalized-playback-events.json must be an array.");
  for (const event of value) {
    if (!isRecord(event) || typeof event.event_id !== "string" || typeof event.import_batch_id !== "string" || typeof event.track_name !== "string" || typeof event.artist_name !== "string" || typeof event.album_name !== "string" || !(event.spotify_track_id === null || typeof event.spotify_track_id === "string")) {
      throw new Error("1.03 artifact contract error: invalid normalized event.");
    }
  }
}

async function readJson(filePath: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as unknown;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "unknown read/parse failure";
    throw new Error(`Unable to read album-resolution input ${path.basename(filePath)}: ${message}`);
  }
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
