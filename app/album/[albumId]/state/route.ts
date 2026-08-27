import { env } from "cloudflare:workers";

import { normalizeAlbumId, savePersonalAlbumState } from "../../../../lib/album/album";

interface AlbumStateRouteContext {
  params: Promise<{ albumId: string }>;
}

export async function POST(request: Request, { params }: AlbumStateRouteContext) {
  const { albumId: rawAlbumId } = await params;
  const albumId = normalizeAlbumId(rawAlbumId);
  if (!albumId) return new Response("Invalid album", { status: 400 });

  const form = await request.formData();
  const favorite = form.get("favorite") === "1";
  const revisit = form.get("revisit") === "1";
  const reviewValue = form.get("review");
  const review = typeof reviewValue === "string" ? reviewValue : "";

  try {
    await savePersonalAlbumState(env.DB, albumId, { favorite, revisit, review });
  } catch {
    return new Response("Could not save personal album state", { status: 500 });
  }

  const destination = new URL(`/album/${encodeURIComponent(albumId)}?saved=1`, request.url);
  return Response.redirect(destination, 303);
}
