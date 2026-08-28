import { env } from "cloudflare:workers";
import type { Metadata } from "next";
import Link from "next/link";

import { AlbumArtwork } from "../components/album-artwork";
import {
  countLibraryAlbums,
  loadLibraryAlbums,
  loadLibraryFacets,
  normalizeLibraryQuery,
  type LibraryAlbum,
  type LibraryFacets,
  type NormalizedLibraryQuery,
} from "../../lib/library/library";
import { loadExplore, type ExploreView } from "../../lib/explore/explore";
import { ExploreControls } from "./explore-controls";
import styles from "./explore.module.css";

export const metadata: Metadata = {
  title: "Explore",
};

export const dynamic = "force-dynamic";

type SearchParamValue = string | string[] | undefined;

interface ExplorePageProps {
  searchParams: Promise<{
    q?: SearchParamValue;
    sort?: SearchParamValue;
    decade?: SearchParamValue;
    heard?: SearchParamValue;
  }>;
}

export default async function ExplorePage({ searchParams }: ExplorePageProps) {
  const params = await searchParams;
  const query = normalizeLibraryQuery({
    search: firstParam(params.q),
    sort: firstParam(params.sort),
    decade: firstParam(params.decade),
    listeningYear: firstParam(params.heard),
  });

  let explore: ExploreView;
  let albums: LibraryAlbum[];
  let totalCount: number;
  let facets: LibraryFacets;

  try {
    [explore, albums, totalCount, facets] = await Promise.all([
      loadExplore(env.DB),
      loadLibraryAlbums(env.DB, query),
      countLibraryAlbums(env.DB),
      loadLibraryFacets(env.DB),
    ]);
  } catch {
    return <ExploreUnavailable />;
  }

  if (totalCount === 0) return <ExploreEmpty />;

  const hasFilters = Boolean(query.search || query.decade !== null || query.listeningYear !== null);
  const hasCustomView = hasFilters || query.sort !== "artist";
  const noMatches = hasFilters && albums.length === 0;

  return (
    <main className={styles.explorePage}>
      <ExploreHeader count={totalCount} />

      <section className={styles.discoverySection} aria-labelledby="ways-title">
        <div className={styles.sectionHeading}>
          <p className={styles.sectionEyebrow}>Ways into the archive</p>
          <h2 id="ways-title">Take another route.</h2>
        </div>
        <div className={styles.routeGrid}>
          <ExploreRoute
            index="01"
            href="/explore?sort=recent"
            title="Recent returns"
            description="Records closest to now."
          />
          <ExploreRoute
            index="02"
            href="/explore?sort=revisited"
            title="Most revisited"
            description="The records you keep coming back to."
          />
          <ExploreRoute
            index="03"
            href="/explore?sort=first"
            title="First heard"
            description="Start at the beginning of the archive."
          />
          <ExploreRoute
            index="04"
            href="#release-eras"
            title="Release eras"
            description="Move through the collection by decade."
          />
        </div>
      </section>

      {explore.crossTimeAlbums.length > 0 ? (
        <section className={styles.memorySection} aria-labelledby="memory-title">
          <div className={styles.sectionHeadingCompact}>
            <div>
              <p className={styles.sectionEyebrow}>Across your history</p>
              <h2 id="memory-title">Records with a long memory.</h2>
            </div>
            <p>Spanning multiple listening years</p>
          </div>
          <div className={styles.memoryShelf}>
            {explore.crossTimeAlbums.slice(0, 8).map((album) => (
              <Link
                key={album.canonicalAlbumId}
                href={`/album/${encodeURIComponent(album.canonicalAlbumId)}`}
                className={styles.memoryRecord}
              >
                <AlbumArtwork
                  src={album.artworkUrl}
                  albumTitle={album.title}
                  artistName={album.artistName}
                  scale="shelf"
                />
                <div className={styles.memoryIdentity}>
                  <span>{album.distinctListeningYears} listening years</span>
                  <h3>{album.title}</h3>
                  <p>{album.artistName}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className={styles.archiveSection} aria-labelledby="archive-title">
        <div className={styles.archiveHeading}>
          <div>
            <p className={styles.sectionEyebrow}>The archive</p>
            <h2 id="archive-title">{archiveTitle(query)}</h2>
          </div>
          {hasCustomView ? (
            <p>{albums.length.toLocaleString()} of {totalCount.toLocaleString()}</p>
          ) : null}
        </div>

        <ExploreControls query={query} facets={facets} hasCustomView={hasCustomView} />

        {noMatches ? (
          <div className={styles.archiveEmpty}>
            <p className={styles.sectionEyebrow}>No matches</p>
            <h3>Nothing matches this route through the archive.</h3>
            <Link href="/explore">Return to every record</Link>
          </div>
        ) : (
          <div className={styles.archiveGrid} aria-label={`${albums.length} records in the archive`}>
            {albums.map((album) => {
              const context = archiveContext(album, query);
              return (
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
                    <p>{album.artistName}</p>
                    {context ? <span>{context}</span> : null}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section className={styles.indexSection} id="release-eras" aria-labelledby="decade-title">
        <div className={styles.sectionHeadingCompact}>
          <div>
            <p className={styles.sectionEyebrow}>Release index</p>
            <h2 id="decade-title">By decade.</h2>
          </div>
        </div>
        <div className={styles.decadeIndex}>
          {explore.decades.map((item) => (
            <Link key={item.decade} href={`/explore?decade=${item.decade}`}>
              <strong>{item.decade}s</strong>
              <span>{item.albumCount.toLocaleString()} {item.albumCount === 1 ? "record" : "records"}</span>
            </Link>
          ))}
        </div>
      </section>

      {explore.artists.length > 0 ? (
        <section className={styles.indexSection} aria-labelledby="artists-title">
          <div className={styles.sectionHeadingCompact}>
            <div>
              <p className={styles.sectionEyebrow}>Collection index</p>
              <h2 id="artists-title">Artists.</h2>
            </div>
          </div>
          <div className={styles.artistIndex}>
            {explore.artists.map((artist) => (
              <Link key={artist.artistId} href={`/explore?q=${encodeURIComponent(artist.name)}`}>
                <span>{artist.name}</span>
                <small>{artist.albumCount.toLocaleString()}</small>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}

function ExploreHeader({ count }: { count: number }) {
  return (
    <header className={styles.exploreHeader}>
      <div>
        <p className={styles.headerEyebrow}>Personal listening archive</p>
        <h1>Explore</h1>
        <p className={styles.exploreLede}>Different ways into a listening archive.</p>
      </div>
      <div className={styles.headerCount} aria-label={`${count} records in the archive`}>
        <span>{count.toLocaleString()}</span>
        <small>records</small>
      </div>
    </header>
  );
}

function ExploreRoute({
  index,
  href,
  title,
  description,
}: {
  index: string;
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link href={href} className={styles.routeLink}>
      <span>{index}</span>
      <strong>{title}</strong>
      <p>{description}</p>
    </Link>
  );
}

function ExploreEmpty() {
  return (
    <main className={styles.exploreState}>
      <p className={styles.sectionEyebrow}>Nothing to explore yet</p>
      <h1>The archive is still empty.</h1>
      <p>Records appear here after Needle reconciles listening history into the archive.</p>
    </main>
  );
}

function ExploreUnavailable() {
  return (
    <main className={styles.exploreState}>
      <p className={styles.sectionEyebrow}>Archive unavailable</p>
      <h1>Explore could not read the collection.</h1>
      <p>Needle could not reach the current archive. Try again after the database connection is available.</p>
    </main>
  );
}

function archiveTitle(query: NormalizedLibraryQuery): string {
  if (query.search) return `Matches for “${query.search}”`;
  if (query.listeningYear !== null) return `Heard in ${query.listeningYear}.`;
  if (query.decade !== null) return `${query.decade}s releases.`;

  switch (query.sort) {
    case "album": return "Albums A–Z.";
    case "release": return "Newest releases.";
    case "recent": return "Recently listened.";
    case "first": return "First heard.";
    case "revisited": return "Most revisited.";
    default: return "Every record.";
  }
}

function archiveContext(album: LibraryAlbum, query: NormalizedLibraryQuery): string | null {
  if (query.listeningYear !== null) return `Heard · ${query.listeningYear}`;
  if (query.decade !== null) return album.releaseYear === null ? null : `Release · ${album.releaseYear}`;

  switch (query.sort) {
    case "recent": {
      const year = yearFromTimestamp(album.lastMeaningfulListenAt);
      return year === null ? null : `Last heard · ${year}`;
    }
    case "first": {
      const year = yearFromTimestamp(album.firstMeaningfulListenAt);
      return year === null ? null : `First heard · ${year}`;
    }
    case "revisited":
      return `${album.qualifyingSessionCount.toLocaleString()} qualifying listens`;
    case "release":
      return album.releaseYear === null ? null : `Release · ${album.releaseYear}`;
    default:
      return null;
  }
}

function yearFromTimestamp(value: string | null): number | null {
  if (!value) return null;
  const match = /^(\d{4})/.exec(value);
  return match ? Number(match[1]) : null;
}

function firstParam(value: SearchParamValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
