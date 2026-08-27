import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  SpotifyAlbumEnrichment,
  SpotifyArtistEnrichment,
} from "../import/spotify-enrichment.ts";

export const MUSIC_TYPE_TAXONOMY_VERSION = 1 as const;
export const GENRE_MAPPING_VERSION = 1 as const;

export const MUSIC_TYPES = [
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
] as const;

export type MusicType = (typeof MUSIC_TYPES)[number];

interface GenreMappingRule {
  id: string;
  musicType: MusicType;
  phrases: readonly string[];
}

export const GENRE_MAPPING_RULES: readonly GenreMappingRule[] = [
  {
    id: "rock.v1",
    musicType: "Rock",
    phrases: [
      "alternative rock",
      "indie rock",
      "classic rock",
      "hard rock",
      "soft rock",
      "garage rock",
      "post rock",
      "psychedelic rock",
      "progressive rock",
      "southern rock",
      "folk rock",
      "pop rock",
      "pop punk",
      "punk rock",
      "grunge",
      "shoegaze",
      "britpop",
      "rock",
      "punk",
    ],
  },
  {
    id: "pop.v1",
    musicType: "Pop",
    phrases: [
      "indie pop",
      "dream pop",
      "art pop",
      "dance pop",
      "electropop",
      "synthpop",
      "hyperpop",
      "k pop",
      "j pop",
      "power pop",
      "pop",
    ],
  },
  {
    id: "hip-hop.v1",
    musicType: "Hip-Hop",
    phrases: [
      "hip hop",
      "boom bap",
      "gangsta rap",
      "alternative rap",
      "conscious rap",
      "southern rap",
      "trap",
      "drill",
      "rap",
    ],
  },
  {
    id: "rnb-soul.v1",
    musicType: "R&B / Soul",
    phrases: [
      "r and b",
      "rnb",
      "neo soul",
      "blue eyed soul",
      "southern soul",
      "motown",
      "quiet storm",
      "funk",
      "soul",
      "gospel",
    ],
  },
  {
    id: "electronic.v1",
    musicType: "Electronic",
    phrases: [
      "drum and bass",
      "uk garage",
      "electronic",
      "electronica",
      "electro house",
      "deep house",
      "progressive house",
      "house",
      "techno",
      "ambient",
      "dubstep",
      "trance",
      "synthwave",
      "downtempo",
      "trip hop",
      "idm",
      "edm",
    ],
  },
  {
    id: "jazz.v1",
    musicType: "Jazz",
    phrases: [
      "jazz fusion",
      "smooth jazz",
      "vocal jazz",
      "bebop",
      "hard bop",
      "free jazz",
      "jazz",
      "swing",
    ],
  },
  {
    id: "country-folk.v1",
    musicType: "Country / Folk",
    phrases: [
      "alternative country",
      "country rock",
      "country pop",
      "singer songwriter",
      "americana",
      "bluegrass",
      "country",
      "folk",
    ],
  },
  {
    id: "heavy.v1",
    musicType: "Heavy",
    phrases: [
      "heavy metal",
      "death metal",
      "black metal",
      "thrash metal",
      "doom metal",
      "progressive metal",
      "metalcore",
      "deathcore",
      "post hardcore",
      "hardcore punk",
      "hardcore",
      "grindcore",
      "screamo",
      "metal",
    ],
  },
  {
    id: "global.v1",
    musicType: "Global",
    phrases: [
      "latin alternative",
      "latin rock",
      "latin pop",
      "afrobeats",
      "afrobeat",
      "dancehall",
      "reggaeton",
      "reggae",
      "bossa nova",
      "samba",
      "cumbia",
      "salsa",
      "world music",
      "world",
    ],
  },
  {
    id: "classical-soundtrack.v1",
    musicType: "Classical / Soundtrack",
    phrases: [
      "film score",
      "video game music",
      "movie soundtrack",
      "original score",
      "soundtrack",
      "classical",
      "orchestral",
      "chamber music",
      "opera",
      "baroque",
      "romantic era",
    ],
  },
] as const;

export interface ManualMusicTypeOverride {
  canonical_album_id: string;
  music_type: MusicType;
  note?: string;
  updated_at?: string;
}

export interface ManualMusicTypeOverrideFile {
  version: 1;
  overrides: ManualMusicTypeOverride[];
}

export interface GenreProvenance {
  provider: "spotify";
  spotify_artist_id: string;
  enriched_at: string;
}

export interface DetailedGenreEvidence {
  name: string;
  normalized_name: string;
  sources: GenreProvenance[];
}

export interface GenreRuleMatch {
  genre: string;
  normalized_genre: string;
  music_type: MusicType | null;
  rule_id: string | null;
  matched_phrase: string | null;
  candidate_types: MusicType[];
}

export type AlbumMusicTypeStatus =
  | "classified"
  | "manual_override"
  | "unclassified_no_genres"
  | "unclassified_unmapped"
  | "unclassified_ambiguous";

export interface AlbumMusicTypeClassification {
  canonical_album_id: string;
  spotify_album_id: string;
  detailed_genres: DetailedGenreEvidence[];
  music_type: MusicType | null;
  automatic_music_type: MusicType | null;
  status: AlbumMusicTypeStatus;
  classification_source: "mapping_v1" | "manual_override" | null;
  taxonomy_version: 1;
  mapping_version: 1;
  votes: Record<MusicType, number>;
  matched_genres: GenreRuleMatch[];
  ambiguous_genres: string[];
  unmapped_genres: string[];
  manual_override: ManualMusicTypeOverride | null;
}

export interface GenreCatalogEntry {
  name: string;
  normalized_name: string;
  music_type: MusicType | null;
  rule_id: string | null;
  mapping_status: "mapped" | "ambiguous" | "unmapped";
  spotify_artist_ids: string[];
  canonical_album_ids: string[];
}

export interface MusicTypeTaxonomyReport {
  reportVersion: 1;
  taxonomyVersion: 1;
  mappingVersion: 1;
  ok: boolean;
  totals: {
    enrichedAlbums: number;
    classifiedAlbums: number;
    automaticClassifications: number;
    manualOverrides: number;
    unclassifiedNoGenres: number;
    unclassifiedUnmapped: number;
    unclassifiedAmbiguous: number;
    detailedGenres: number;
    mappedGenres: number;
    ambiguousGenres: number;
    unmappedGenres: number;
    orphanManualOverrides: number;
  };
  byMusicType: Record<MusicType, number>;
  reconciliation: {
    albumBalance: boolean;
    uniqueCanonicalAlbumIds: boolean;
    uniqueOverrideTargets: boolean;
    overrideTargetsKnown: boolean;
  };
}

export interface MusicTypeTaxonomyResult {
  classifications: AlbumMusicTypeClassification[];
  genres: GenreCatalogEntry[];
  report: MusicTypeTaxonomyReport;
}

export interface SpotifyTaxonomyArtifacts {
  albums: SpotifyAlbumEnrichment[];
  artists: SpotifyArtistEnrichment[];
}

export async function readSpotifyTaxonomyArtifacts(inputDir: string): Promise<SpotifyTaxonomyArtifacts> {
  const [albumsRaw, artistsRaw] = await Promise.all([
    readJson(path.join(inputDir, "spotify-album-enrichment.json")),
    readJson(path.join(inputDir, "spotify-artist-enrichment.json")),
  ]);
  assertAlbumEnrichment(albumsRaw);
  assertArtistEnrichment(artistsRaw);
  return { albums: albumsRaw, artists: artistsRaw };
}

export async function readManualMusicTypeOverrides(filePath: string): Promise<ManualMusicTypeOverrideFile> {
  try {
    const raw = JSON.parse(await readFile(filePath, "utf8")) as unknown;
    assertOverrideFile(raw);
    return raw;
  } catch (error: unknown) {
    if (isMissingFileError(error)) return { version: 1, overrides: [] };
    throw error;
  }
}

export function mapGenreToMusicType(genre: string): GenreRuleMatch {
  const normalizedGenre = normalizeGenre(genre);
  if (!normalizedGenre) {
    return emptyGenreMatch(genre, normalizedGenre);
  }

  const candidates: Array<{
    musicType: MusicType;
    ruleId: string;
    phrase: string;
    specificity: number;
  }> = [];

  for (const rule of GENRE_MAPPING_RULES) {
    for (const phrase of rule.phrases) {
      const normalizedPhrase = normalizeGenre(phrase);
      if (!containsPhrase(normalizedGenre, normalizedPhrase)) continue;
      candidates.push({
        musicType: rule.musicType,
        ruleId: rule.id,
        phrase: normalizedPhrase,
        specificity: normalizedPhrase.split(" ").length * 100 + normalizedPhrase.length,
      });
    }
  }

  if (candidates.length === 0) return emptyGenreMatch(genre, normalizedGenre);

  const maxSpecificity = Math.max(...candidates.map((candidate) => candidate.specificity));
  const strongest = candidates.filter((candidate) => candidate.specificity === maxSpecificity);
  const candidateTypes = sortedMusicTypes(strongest.map((candidate) => candidate.musicType));
  if (candidateTypes.length !== 1) {
    return {
      genre,
      normalized_genre: normalizedGenre,
      music_type: null,
      rule_id: null,
      matched_phrase: null,
      candidate_types: candidateTypes,
    };
  }

  const selected = strongest.find((candidate) => candidate.musicType === candidateTypes[0])!;
  return {
    genre,
    normalized_genre: normalizedGenre,
    music_type: selected.musicType,
    rule_id: selected.ruleId,
    matched_phrase: selected.phrase,
    candidate_types: candidateTypes,
  };
}

export function classifyMusicTypes(options: {
  artifacts: SpotifyTaxonomyArtifacts;
  overrides?: ManualMusicTypeOverrideFile;
}): MusicTypeTaxonomyResult {
  const overrides = options.overrides ?? { version: 1, overrides: [] };
  assertOverrideFile(overrides);
  const artistById = new Map(options.artifacts.artists.map((artist) => [artist.spotify_artist_id, artist] as const));
  const overrideByAlbum = new Map(overrides.overrides.map((override) => [override.canonical_album_id, override] as const));

  const classifications = [...options.artifacts.albums]
    .sort((a, b) => a.canonical_album_id.localeCompare(b.canonical_album_id))
    .map((album) => classifyAlbum(album, artistById, overrideByAlbum.get(album.canonical_album_id) ?? null));

  const genres = buildGenreCatalog(classifications);
  const knownAlbums = new Set(classifications.map((classification) => classification.canonical_album_id));
  const orphanOverrides = overrides.overrides.filter((override) => !knownAlbums.has(override.canonical_album_id));
  const byMusicType = emptyVotes();
  for (const classification of classifications) {
    if (classification.music_type) byMusicType[classification.music_type] += 1;
  }

  const report: MusicTypeTaxonomyReport = {
    reportVersion: 1,
    taxonomyVersion: MUSIC_TYPE_TAXONOMY_VERSION,
    mappingVersion: GENRE_MAPPING_VERSION,
    ok: true,
    totals: {
      enrichedAlbums: classifications.length,
      classifiedAlbums: classifications.filter((item) => item.music_type !== null).length,
      automaticClassifications: classifications.filter((item) => item.status === "classified").length,
      manualOverrides: classifications.filter((item) => item.status === "manual_override").length,
      unclassifiedNoGenres: classifications.filter((item) => item.status === "unclassified_no_genres").length,
      unclassifiedUnmapped: classifications.filter((item) => item.status === "unclassified_unmapped").length,
      unclassifiedAmbiguous: classifications.filter((item) => item.status === "unclassified_ambiguous").length,
      detailedGenres: genres.length,
      mappedGenres: genres.filter((genre) => genre.mapping_status === "mapped").length,
      ambiguousGenres: genres.filter((genre) => genre.mapping_status === "ambiguous").length,
      unmappedGenres: genres.filter((genre) => genre.mapping_status === "unmapped").length,
      orphanManualOverrides: orphanOverrides.length,
    },
    byMusicType,
    reconciliation: {
      albumBalance:
        classifications.filter((item) => item.music_type !== null).length +
          classifications.filter((item) => item.music_type === null).length ===
        classifications.length,
      uniqueCanonicalAlbumIds: unique(classifications.map((item) => item.canonical_album_id)),
      uniqueOverrideTargets: unique(overrides.overrides.map((override) => override.canonical_album_id)),
      overrideTargetsKnown: orphanOverrides.length === 0,
    },
  };
  report.ok = Object.values(report.reconciliation).every(Boolean);
  return { classifications, genres, report };
}

export async function writeMusicTypeTaxonomyOutputs(options: {
  outputDir: string;
  result: MusicTypeTaxonomyResult;
}): Promise<void> {
  await mkdir(options.outputDir, { recursive: true });
  await Promise.all([
    writeJson(path.join(options.outputDir, "album-music-type-classifications.json"), options.result.classifications),
    writeJson(path.join(options.outputDir, "genre-catalog.json"), options.result.genres),
    writeJson(path.join(options.outputDir, "music-type-taxonomy-report.json"), options.result.report),
  ]);
  await writeFile(
    path.join(options.outputDir, "music-type-taxonomy-report.md"),
    `${renderMusicTypeTaxonomyReportMarkdown(options.result.report)}\n`,
    "utf8",
  );
}

export function renderMusicTypeTaxonomyReportMarkdown(report: MusicTypeTaxonomyReport): string {
  const typeRows = MUSIC_TYPES.map((musicType) => `| ${musicType} | ${report.byMusicType[musicType]} |`);
  return [
    "# Needle Music Type Taxonomy",
    "",
    `- Taxonomy version: **${report.taxonomyVersion}**`,
    `- Genre mapping version: **${report.mappingVersion}**`,
    `- Result: **${report.ok ? "PASS" : "FAIL"}**`,
    "",
    "## Classification counts",
    "",
    "| Metric | Count |",
    "| --- | ---: |",
    `| Enriched albums | ${report.totals.enrichedAlbums} |`,
    `| Classified albums | ${report.totals.classifiedAlbums} |`,
    `| Automatic classifications | ${report.totals.automaticClassifications} |`,
    `| Manual overrides | ${report.totals.manualOverrides} |`,
    `| No genre evidence | ${report.totals.unclassifiedNoGenres} |`,
    `| Unmapped genre evidence | ${report.totals.unclassifiedUnmapped} |`,
    `| Ambiguous genre evidence | ${report.totals.unclassifiedAmbiguous} |`,
    `| Orphan manual overrides | ${report.totals.orphanManualOverrides} |`,
    "",
    "## Music Types",
    "",
    "| Music Type | Albums |",
    "| --- | ---: |",
    ...typeRows,
    "",
    "## Genre coverage",
    "",
    `- Detailed genres: **${report.totals.detailedGenres}**`,
    `- Mapped genres: **${report.totals.mappedGenres}**`,
    `- Ambiguous genres: **${report.totals.ambiguousGenres}**`,
    `- Unmapped genres: **${report.totals.unmappedGenres}**`,
    "",
    "Missing genre evidence remains unclassified. Needle does not infer Music Type from album title, artist name, listening behavior, or other unsupported signals.",
  ].join("\n");
}

function classifyAlbum(
  album: SpotifyAlbumEnrichment,
  artistById: Map<string, SpotifyArtistEnrichment>,
  override: ManualMusicTypeOverride | null,
): AlbumMusicTypeClassification {
  const detailedGenres = collectAlbumGenres(album, artistById);
  const matches = detailedGenres.map((genre) => mapGenreToMusicType(genre.name));
  const votes = emptyVotes();
  const ambiguousGenres: string[] = [];
  const unmappedGenres: string[] = [];

  for (const match of matches) {
    if (match.music_type) votes[match.music_type] += 1;
    else if (match.candidate_types.length > 1) ambiguousGenres.push(match.genre);
    else unmappedGenres.push(match.genre);
  }

  const automaticMusicType = chooseAutomaticMusicType(votes);
  let status: AlbumMusicTypeStatus;
  if (override) status = "manual_override";
  else if (detailedGenres.length === 0) status = "unclassified_no_genres";
  else if (automaticMusicType) status = "classified";
  else if (Object.values(votes).some((count) => count > 0) || ambiguousGenres.length > 0) status = "unclassified_ambiguous";
  else status = "unclassified_unmapped";

  return {
    canonical_album_id: album.canonical_album_id,
    spotify_album_id: album.spotify_album_id,
    detailed_genres: detailedGenres,
    music_type: override?.music_type ?? automaticMusicType,
    automatic_music_type: automaticMusicType,
    status,
    classification_source: override ? "manual_override" : automaticMusicType ? "mapping_v1" : null,
    taxonomy_version: MUSIC_TYPE_TAXONOMY_VERSION,
    mapping_version: GENRE_MAPPING_VERSION,
    votes,
    matched_genres: matches,
    ambiguous_genres: [...ambiguousGenres].sort(),
    unmapped_genres: [...unmappedGenres].sort(),
    manual_override: override,
  };
}

function collectAlbumGenres(
  album: SpotifyAlbumEnrichment,
  artistById: Map<string, SpotifyArtistEnrichment>,
): DetailedGenreEvidence[] {
  const byNormalized = new Map<string, DetailedGenreEvidence>();
  for (const artistId of album.artist_ids) {
    const artist = artistById.get(artistId);
    if (!artist) continue;
    for (const genreName of artist.genres) {
      const normalizedName = normalizeGenre(genreName);
      if (!normalizedName) continue;
      const source: GenreProvenance = {
        provider: "spotify",
        spotify_artist_id: artist.spotify_artist_id,
        enriched_at: artist.enriched_at,
      };
      const current = byNormalized.get(normalizedName);
      if (!current) {
        byNormalized.set(normalizedName, {
          name: genreName,
          normalized_name: normalizedName,
          sources: [source],
        });
      } else if (!current.sources.some((existing) => existing.spotify_artist_id === source.spotify_artist_id)) {
        current.sources.push(source);
        current.sources.sort((a, b) => a.spotify_artist_id.localeCompare(b.spotify_artist_id));
      }
    }
  }
  return [...byNormalized.values()].sort((a, b) => a.normalized_name.localeCompare(b.normalized_name));
}

function buildGenreCatalog(classifications: AlbumMusicTypeClassification[]): GenreCatalogEntry[] {
  const catalog = new Map<string, GenreCatalogEntry>();
  for (const classification of classifications) {
    for (const genre of classification.detailed_genres) {
      const match = mapGenreToMusicType(genre.name);
      const mappingStatus = match.music_type ? "mapped" : match.candidate_types.length > 1 ? "ambiguous" : "unmapped";
      const current = catalog.get(genre.normalized_name);
      if (!current) {
        catalog.set(genre.normalized_name, {
          name: genre.name,
          normalized_name: genre.normalized_name,
          music_type: match.music_type,
          rule_id: match.rule_id,
          mapping_status: mappingStatus,
          spotify_artist_ids: sortedUnique(genre.sources.map((source) => source.spotify_artist_id)),
          canonical_album_ids: [classification.canonical_album_id],
        });
      } else {
        current.spotify_artist_ids = sortedUnique([
          ...current.spotify_artist_ids,
          ...genre.sources.map((source) => source.spotify_artist_id),
        ]);
        current.canonical_album_ids = sortedUnique([...current.canonical_album_ids, classification.canonical_album_id]);
      }
    }
  }
  return [...catalog.values()].sort((a, b) => a.normalized_name.localeCompare(b.normalized_name));
}

function chooseAutomaticMusicType(votes: Record<MusicType, number>): MusicType | null {
  const ranked = MUSIC_TYPES.map((musicType) => ({ musicType, count: votes[musicType] })).sort(
    (a, b) => b.count - a.count,
  );
  if (ranked[0].count === 0) return null;
  if (ranked[1] && ranked[1].count === ranked[0].count) return null;
  return ranked[0].musicType;
}

function emptyVotes(): Record<MusicType, number> {
  return Object.fromEntries(MUSIC_TYPES.map((musicType) => [musicType, 0])) as Record<MusicType, number>;
}

function emptyGenreMatch(genre: string, normalizedGenre: string): GenreRuleMatch {
  return {
    genre,
    normalized_genre: normalizedGenre,
    music_type: null,
    rule_id: null,
    matched_phrase: null,
    candidate_types: [],
  };
}

export function normalizeGenre(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function containsPhrase(value: string, phrase: string): boolean {
  return ` ${value} `.includes(` ${phrase} `);
}

function sortedMusicTypes(values: MusicType[]): MusicType[] {
  const set = new Set(values);
  return MUSIC_TYPES.filter((musicType) => set.has(musicType));
}

function sortedUnique(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function unique(values: string[]): boolean {
  return new Set(values).size === values.length;
}

function isMusicType(value: unknown): value is MusicType {
  return typeof value === "string" && (MUSIC_TYPES as readonly string[]).includes(value);
}

function assertOverrideFile(value: unknown): asserts value is ManualMusicTypeOverrideFile {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.overrides)) {
    throw new Error("Music Type override file must be a version 1 object with an overrides array.");
  }
  for (const override of value.overrides) {
    if (
      !isRecord(override) ||
      typeof override.canonical_album_id !== "string" ||
      !isMusicType(override.music_type) ||
      (override.note !== undefined && typeof override.note !== "string") ||
      (override.updated_at !== undefined && typeof override.updated_at !== "string")
    ) {
      throw new Error("Music Type override file contains an invalid override record.");
    }
  }
}

function assertAlbumEnrichment(value: unknown): asserts value is SpotifyAlbumEnrichment[] {
  if (!Array.isArray(value)) throw new Error("spotify-album-enrichment.json must contain an array.");
  for (const album of value) {
    if (
      !isRecord(album) ||
      typeof album.canonical_album_id !== "string" ||
      typeof album.spotify_album_id !== "string" ||
      !Array.isArray(album.artist_ids)
    ) {
      throw new Error("spotify-album-enrichment.json contains an invalid album record.");
    }
  }
}

function assertArtistEnrichment(value: unknown): asserts value is SpotifyArtistEnrichment[] {
  if (!Array.isArray(value)) throw new Error("spotify-artist-enrichment.json must contain an array.");
  for (const artist of value) {
    if (
      !isRecord(artist) ||
      typeof artist.spotify_artist_id !== "string" ||
      !Array.isArray(artist.genres) ||
      typeof artist.enriched_at !== "string"
    ) {
      throw new Error("spotify-artist-enrichment.json contains an invalid artist record.");
    }
  }
}

function isMissingFileError(error: unknown): boolean {
  return isRecord(error) && error.code === "ENOENT";
}

async function readJson(filePath: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as unknown;
  } catch (error: unknown) {
    if (isMissingFileError(error)) {
      throw new Error(`Required 1.05 artifact is missing: ${filePath}`);
    }
    throw error;
  }
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
