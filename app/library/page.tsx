import { env } from "cloudflare:workers";
import type { Metadata } from "next";
import Link from "next/link";

import { AlbumArtwork } from "../components/album-artwork";
import {
  countLibraryAlbums,
  loadLibraryAlbums,
  normalizeLibrarySearch,
  type LibraryAlbum,
} from "../../lib/library/library";
import styles from "./library.module.css";

export const metadata: Metadata = {
  title: "Library",
};

export const dynamic = "force-dynamic";

interface LibraryPageProps {
  searchParams: Promise<{ q?: string | string[] }>;
}

export default async function LibraryPage({ searchParams }: LibraryPageProps) {
  const params = await searchParams;
  const rawSearch = Array.isArray(params.q) ? params.q[0] : params.q;
  const search = normalizeLibrarySearch(rawSearch);

  let albums: LibraryAlbum[];
  let totalCount: number;

  try {
    if (search) {
      [albums, totalCount] = await Promise.all([
        loadLibraryAlbums(env.DB, { search }),
        countLibraryAlbums(env.DB),
      ]);
    } else {
      albums = await loadLibraryAlbums(env.DB);
      totalCount = albums.length;
    }
  } catch {
    return (
      <main className={styles.libraryPage}>
        <LibraryHeader count={null} countLabel="albums" />
        <LibrarySearch search={search} />
        <section className={styles.libraryState} aria-labelledby="library-error-title">
          <p className="archive-label">Archive unavailable</p>
          <h2 id="library-error-title">The library could not be read.</h2>
          <p>Needle could not reach the current archive. Try again after the database connection is available.</p>
        </section>
      </main>
    );
  }

  const noArchive = totalCount === 0;
  const noMatches = Boolean(search) && albums.length === 0 && totalCount > 0;

  return (
    <main className={styles.libraryPage}>
      <LibraryHeader
        count={search ? albums.length : totalCount}
        countLabel={search ? "matches" : totalCount === 1 ? "album" : "albums"}
      />
      <LibrarySearch search={search} />

      {noArchive ? (
        <section className={styles.libraryState} aria-labelledby="library-empty-title">
          <p className="archive-label">No records yet</p>
          <h2 id="library-empty-title">The archive is empty.</h2>
          <p>
            Albums appear here after Needle reconciles a Full or Near-Complete listen into the current archive.
          </p>
        </section>
      ) : noMatches ? (
        <section className={styles.libraryState} aria-labelledby="library-search-empty-title">
          <p className="archive-label">No matches</p>
          <h2 id="library-search-empty-title">Nothing found for “{search}”.</h2>
          <p>
            Search checks album titles and primary artists in the current Library. <Link href="/library">Clear the search</Link> to return to all records.
          </p>
        </section>
      ) : (
        <section className={styles.libraryGrid} aria-label={`${albums.length} albums in the Library`}>
          {albums.map((album) => (
            <article className={styles.albumTile} key={album.canonicalAlbumId}>
              <AlbumArtwork
                src={album.artworkUrl}
                albumTitle={album.title}
                artistName={album.artistName}
                scale="grid"
              />
              <div className={styles.albumIdentity}>
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

function LibraryHeader({ count, countLabel }: { count: number | null; countLabel: string }) {
  return (
    <header className={styles.libraryHeader}>
      <div>
        <p className="page-kicker">Find and inspect</p>
        <h1 className={styles.libraryTitle}>Library</h1>
      </div>
      <div
        className={styles.libraryHeaderMeta}
        aria-label={count === null ? "Album count unavailable" : `${count} ${countLabel}`}
      >
        <span>{count === null ? "—" : count.toLocaleString()}</span>
        <small>{countLabel}</small>
      </div>
    </header>
  );
}

function LibrarySearch({ search }: { search: string }) {
  return (
    <form className={styles.librarySearch} action="/library" method="get" role="search">
      <label htmlFor="library-search">Search library</label>
      <div className={styles.librarySearchField}>
        <input
          id="library-search"
          name="q"
          type="search"
          defaultValue={search}
          placeholder="Album or artist"
          autoComplete="off"
        />
        <button type="submit">Search</button>
        {search ? <Link href="/library">Clear</Link> : null}
      </div>
    </form>
  );
}
