import { env } from "cloudflare:workers";
import type { Metadata } from "next";
import Link from "next/link";

import { AlbumArtwork } from "../components/album-artwork";
import {
  LIBRARY_SORTS,
  LIBRARY_SORT_LABELS,
  countLibraryAlbums,
  loadLibraryAlbums,
  loadLibraryFacets,
  normalizeLibraryQuery,
  type LibraryAlbum,
  type LibraryFacets,
  type NormalizedLibraryQuery,
} from "../../lib/library/library";
import styles from "./library.module.css";

export const metadata: Metadata = {
  title: "Library",
};

export const dynamic = "force-dynamic";

type SearchParamValue = string | string[] | undefined;

interface LibraryPageProps {
  searchParams: Promise<{
    q?: SearchParamValue;
    sort?: SearchParamValue;
    decade?: SearchParamValue;
    heard?: SearchParamValue;
  }>;
}

export default async function LibraryPage({ searchParams }: LibraryPageProps) {
  const params = await searchParams;
  const query = normalizeLibraryQuery({
    search: firstParam(params.q),
    sort: firstParam(params.sort),
    decade: firstParam(params.decade),
    listeningYear: firstParam(params.heard),
  });

  let albums: LibraryAlbum[];
  let totalCount: number;
  let facets: LibraryFacets;

  try {
    [albums, totalCount, facets] = await Promise.all([
      loadLibraryAlbums(env.DB, query),
      countLibraryAlbums(env.DB),
      loadLibraryFacets(env.DB),
    ]);
  } catch {
    return (
      <main className={styles.libraryPage}>
        <LibraryHeader count={null} countLabel="albums" />
        <section className={styles.libraryState} aria-labelledby="library-error-title">
          <p className="archive-label">Archive unavailable</p>
          <h2 id="library-error-title">The library could not be read.</h2>
          <p>Needle could not reach the current archive. Try again after the database connection is available.</p>
        </section>
      </main>
    );
  }

  const hasFilters = Boolean(
    query.search || query.decade !== null || query.listeningYear !== null,
  );
  const hasCustomView = hasFilters || query.sort !== "artist";
  const noArchive = totalCount === 0;
  const noMatches = hasFilters && albums.length === 0 && totalCount > 0;

  return (
    <main className={styles.libraryPage}>
      <LibraryHeader
        count={hasFilters ? albums.length : totalCount}
        countLabel={hasFilters ? "matches" : totalCount === 1 ? "album" : "albums"}
      />
      <LibraryControls query={query} facets={facets} hasCustomView={hasCustomView} />

      {noArchive ? (
        <section className={styles.libraryState} aria-labelledby="library-empty-title">
          <p className="archive-label">No records yet</p>
          <h2 id="library-empty-title">The archive is empty.</h2>
          <p>
            Albums appear here after Needle reconciles a Full or Near-Complete listen into the current archive.
          </p>
        </section>
      ) : noMatches ? (
        <section className={styles.libraryState} aria-labelledby="library-filter-empty-title">
          <p className="archive-label">No matches</p>
          <h2 id="library-filter-empty-title">Nothing matches this view.</h2>
          <p>
            Try another search or filter combination. <Link href="/library">Clear all controls</Link> to return to the full Library.
          </p>
        </section>
      ) : (
        <section className={styles.libraryGrid} aria-label={`${albums.length} albums in the Library`}>
          {albums.map((album) => (
            <Link
              className={styles.albumTile}
              href={`/album/${encodeURIComponent(album.canonicalAlbumId)}`}
              key={album.canonicalAlbumId}
              aria-label={`${album.title} by ${album.artistName}`}
            >
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
            </Link>
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

function LibraryControls({
  query,
  facets,
  hasCustomView,
}: {
  query: NormalizedLibraryQuery;
  facets: LibraryFacets;
  hasCustomView: boolean;
}) {
  return (
    <form className={styles.libraryControls} action="/library" method="get" role="search">
      <div className={styles.librarySearch}>
        <label htmlFor="library-search">Search library</label>
        <div className={styles.librarySearchField}>
          <input
            id="library-search"
            name="q"
            type="search"
            defaultValue={query.search}
            placeholder="Album or artist"
            autoComplete="off"
          />
        </div>
      </div>

      <div className={styles.libraryFilterBar}>
        <label className={styles.controlField}>
          <span>Sort</span>
          <select name="sort" defaultValue={query.sort}>
            {LIBRARY_SORTS.map((sort) => (
              <option key={sort} value={sort}>{LIBRARY_SORT_LABELS[sort]}</option>
            ))}
          </select>
        </label>

        <label className={styles.controlField}>
          <span>Release</span>
          <select name="decade" defaultValue={query.decade ?? ""}>
            <option value="">All decades</option>
            {facets.decades.map((decade) => (
              <option key={decade} value={decade}>{decade}s</option>
            ))}
          </select>
        </label>

        <label className={styles.controlField}>
          <span>Listened</span>
          <select name="heard" defaultValue={query.listeningYear ?? ""}>
            <option value="">All years</option>
            {facets.listeningYears.map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </label>

        <div className={styles.controlActions}>
          <button type="submit">Apply</button>
          {hasCustomView ? <Link href="/library">Clear all</Link> : null}
        </div>
      </div>
    </form>
  );
}

function firstParam(value: SearchParamValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
