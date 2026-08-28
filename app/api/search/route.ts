import { env } from "cloudflare:workers";

import { loadLibraryAlbums, normalizeLibrarySearch } from "../../../lib/library/library";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = normalizeLibrarySearch(url.searchParams.get("q"));

  if (query.length < 2) return Response.json({ results: [] });

  try {
    const albums = await loadLibraryAlbums(env.DB, { search: query, sort: "artist" });
    return Response.json({
      results: albums.slice(0, 8).map((album) => ({
        canonicalAlbumId: album.canonicalAlbumId,
        title: album.title,
        artistName: album.artistName,
        artworkUrl: album.artworkUrl,
        releaseYear: album.releaseYear,
      })),
    });
  } catch {
    return Response.json({ results: [], error: "Archive search unavailable." }, { status: 503 });
  }
}
