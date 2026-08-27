import { env } from "cloudflare:workers";
import type { Metadata } from "next";

import { AlbumArtwork } from "../components/album-artwork";
import { loadLibraryAlbums, type LibraryAlbum } from "../../lib/library/library";

export const metadata: Metadata = {
  title: "Library",
};

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  let albums: LibraryAlbum[];

  try {
    albums = await loadLibraryAlbums(env.DB);
  } catch {
    return (
      <main className="library-page">
        <LibraryHeader count={null} />
        <section className="library-state" aria-labelledby="library-error-title">
          <p className="archive-label">Archive unavailable</p>
          <h2 id="library-error-title">The library could not be read.</h2>
          <p>Needle could not reach the current archive. Try again after the database connection is available.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="library-page">
      <LibraryHeader count={albums.length} />

      {albums.length === 0 ? (
        <section className="library-state" aria-labelledby="library-empty-title">
          <p className="archive-label">No records yet</p>
          <h2 id="library-empty-title">The archive is empty.</h2>
          <p>
            Albums appear here after Needle reconciles a Full or Near-Complete listen into the current archive.
          </p>
        </section>
      ) : (
        <section className="library-grid" aria-label={`${albums.length} albums in the Library`}>
          {albums.map((album) => (
            <article className="album-tile" key={album.canonicalAlbumId}>
              <AlbumArtwork
                src={album.artworkUrl}
                albumTitle={album.title}
                artistName={album.artistName}
                scale="grid"
              />
              <div className="album-tile__identity">
                <h2>{album.title}</h2>
                <p>{album.artistName}</p>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}

function LibraryHeader({ count }: { count: number | null }) {
  return (
    <header className="library-header">
      <div>
        <p className="page-kicker">Find and inspect</p>
        <h1 className="library-title">Library</h1>
      </div>
      <div className="library-header__meta" aria-label={count === null ? "Album count unavailable" : `${count} albums`}>
        <span>{count === null ? "—" : count.toLocaleString()}</span>
        <small>{count === 1 ? "album" : "albums"}</small>
      </div>
    </header>
  );
}
