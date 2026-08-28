import { env } from "cloudflare:workers";
import type { Metadata } from "next";
import Link from "next/link";

import { AlbumArtwork } from "../components/album-artwork";
import {
  LIBRARY_SORT_LABELS,
  countLibraryAlbums,
  loadLibraryAlbums,
  loadLibraryFacets,
  normalizeLibraryQuery,
  type LibraryAlbum,
  type LibraryFacets,
  type NormalizedLibraryQuery,
} from "../../lib/library/library";
import { LibraryControls } from "./library-controls";
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
        <LibraryHeader count={null} />
        <section className={styles.libraryState} aria-labelledby="library-error-title">
          <p className={styles.stateEyebrow}>Archive unavailable</p>
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
      <LibraryHeader count={totalCount} />
      <LibraryControls
        query={query}
        facets={facets}
        hasCustomView={hasCustomView}
        shownCount={albums.length}
      />

      {noArchive ? (
        <section className={styles.libraryState} aria-labelledby="library-empty-title">
          <p className={styles.stateEyebrow}>No records yet</p>
          <h2 id="library-empty-title">The archive is empty.</h2>
          <p>
            Albums appear here after Needle reconciles a Full or Near-Complete listen into the current archive.
          </p>
        </section>
      ) : noMatches ? (
        <section className={styles.libraryState} aria-labelledby="library-filter-empty-title">
          <p className={styles.stateEyebrow}>No matches</p>
          <h2 id="library-filter-empty-title">Nothing matches this view.</h2>
          <p>
            Try another archive view. <Link href="/library">Reset the Library</Link> to return to every record.
          </p>
        </section>
      ) : (
        <section className={styles.archiveSection} aria-labelledby="library-view-title">
          <div className={styles.archiveHeading}>
            <div>
              <p className={styles.archiveEyebrow}>Current view</p>
              <h2 id="library-view-title">{libraryViewLabel(query)}</h2>
            </div>
            <p>{albums.length.toLocaleString()} {albums.length === 1 ? "record" : "records"}</p>
          </div>

          <div className={styles.libraryGrid} aria-label={`${albums.length} albums in the Library`}>
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
                  <h3>{album.title}</h3>
                  <div className={styles.albumByline}>
                    <p>{album.artistName}</p>
                    <span>{archiveDateLabel(album)}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function LibraryHeader({ count }: { count: number | null }) {
  return (
    <header className={styles.libraryHeader}>
      <div className={styles.libraryHeading}>
        <p className={styles.libraryEyebrow}>Personal listening archive</p>
        <h1 className={styles.libraryTitle}>Library</h1>
      </div>
      <div
        className={styles.libraryHeaderMeta}
        aria-label={count === null ? "Archive count unavailable" : `${count} records in the archive`}
      >
        <span>{count === null ? "—" : count.toLocaleString()}</span>
        <small>records</small>
      </div>
    </header>
  );
}

function libraryViewLabel(query: NormalizedLibraryQuery): string {
  if (query.search) return `Search: “${query.search}”`;

  const filters: string[] = [];
  if (query.decade !== null) filters.push(`${query.decade}s releases`);
  if (query.listeningYear !== null) filters.push(`heard in ${query.listeningYear}`);

  if (filters.length > 0) return filters.join(" · ");
  return LIBRARY_SORT_LABELS[query.sort];
}

function archiveDateLabel(album: LibraryAlbum): string {
  const firstHeard = yearFromTimestamp(album.firstMeaningfulListenAt);
  if (firstHeard !== null) return `First heard ${firstHeard}`;
  if (album.releaseYear !== null) return `Released ${album.releaseYear}`;
  return "Archive record";
}

function yearFromTimestamp(value: string | null): number | null {
  if (!value) return null;
  const match = /^(\d{4})/.exec(value);
  return match ? Number(match[1]) : null;
}

function firstParam(value: SearchParamValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
