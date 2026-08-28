export type ArtworkScale = "thumbnail" | "grid" | "feature" | "shelf" | "micro";

export function normalizeArtworkUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:") return null;
    if (parsed.username || parsed.password) return null;
    return trimmed;
  } catch {
    return null;
  }
}

export function albumArtworkAlt(albumTitle: string, artistName: string): string {
  return `${albumTitle} by ${artistName} album artwork`;
}

export function albumArtworkUnavailableLabel(albumTitle: string, artistName: string): string {
  return `${albumTitle} by ${artistName}; artwork unavailable`;
}
