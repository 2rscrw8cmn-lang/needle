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
import { loadExplore, type ExploreCrossTimeAlbum, type ExploreView } from "../../lib/explore/explore";
import { BrowseIndex } from "./browse-index";
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

      {explore.crossTimeAlbums.length > 0 ? (
        <LongMemoryFeature albums={explore.crossTimeAlbums} />
      ) : null}

      <section className={styles.archiveSection} id="archive" aria-labelledby="archive-title">
        <div className={styles.archiveHeading}>
          <div className={styles.archiveHeadingCopy}>
            <p className={styles.sectionEyebrow}>The archive</p>
            <h2 id="archive-title">The archive.</h2>
            <p className={styles.archiveView}>{archiveViewLabel(query)}</p>
          </div>
          <p className={styles.archiveCount}>
            {hasCustomView
              ? `${albums.length.toLocaleString()} of ${totalCount.toLocaleString()}`
              : `${totalCount.toLocaleString()} records`}
          </p>
        </div>

        <ExploreControls query={query} facets={facets} hasCustomView={hasCustomView} />

        {noMatches ? (
          <div className={styles.archiveEmpty}>
            <p className={styles.sectionEyebrow}>No matches</p>
            <h3>Nothing matches this route through the archive.</h3>
            <Link href="/explore#archive">Return to every record</Link>
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

      <BrowseIndex
        artists={explore.artists}
        decades={explore.decades}
        listeningYears={facets.listeningYears}
      />
    </main>
  );
}

function ExploreHeader({ count }: { count: number }) {
  return (
    <header className={styles.exploreHeader}>
      <div>
        <p className={styles.headerEyebrow}>Personal listening archive</p>
        <h1>Explore</h1>
        <p className={styles.exploreLede}>A listening archive, from different angles.</p>
      </div>
      <div className={styles.headerCount} aria-label={`${count} records in the archive`}>
        <span>{count.toLocaleString()}</span>
        <small>records</small>
      </div>
    </header>
  );
}

function LongMemoryFeature({ albums }: { albums: ExploreCrossTimeAlbum[] }) {
  const lead = albums[0];
  const supporting = albums.slice(1, 5);
  const firstYear = yearFromTimestamp(lead.firstMeaningfulListenAt);
  const lastYear = yearFromTimestamp(lead.lastMeaningfulListenAt);

  return (
    <section className={styles.featureSection} aria-labelledby="feature-title">
      <div className={styles.featureIntro}>
        <p className={styles.sectionEyebrow}>Long memory</p>
        <h2 id="feature-title">Records that stayed.</h2>
        <p>
          A record that has kept showing up across the archive, surrounded by a few others with the same long reach.
        </p>
      </div>

      <div className={styles.featureComposition}>
        <Link
          href={`/album/${encodeURIComponent(lead.canonicalAlbumId)}`}
          className={styles.featureLead}
        >
          <AlbumArtwork
            src={lead.artworkUrl}
            albumTitle={lead.title}
            artistName={lead.artistName}
            scale="feature"
          />
          <div className={styles.featureLeadIdentity}>
            <span>{featureSpanLabel(firstYear, lastYear, lead.distinctListeningYears)}</span>
            <h3>{lead.title}</h3>
            <p>{lead.artistName}</p>
          </div>
        </Link>

        <div className={styles.featureSupporting}>
          {supporting.map((album) => (
            <Link
              key={album.canonicalAlbumId}
              href={`/album/${encodeURIComponent(album.canonicalAlbumId)}`}
              className={styles.featureSupportRecord}
            >
              <AlbumArtwork
                src={album.artworkUrl}
                albumTitle={album.title}
                artistName={album.artistName}
                scale="shelf"
              />
              <div>
                <span>{album.distinctListeningYears} listening years</span>
                <h3>{album.title}</h3>
                <p>{album.artistName}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
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

function archiveViewLabel(query: NormalizedLibraryQuery): string {
  if (query.search) return `Matches for “${query.search}”`;
  if (query.listeningYear !== null) return `Heard in ${query.listeningYear}`;
  if (query.decade !== null) return `${query.decade}s releases`;

  switch (query.sort) {
    case "album": return "Albums A–Z";
    case "release": return "Newest releases";
    case "recent": return "Recently listened";
    case "first": return "First heard";
    case "revisited": return "Most revisited";
    default: return "Every record, artist A–Z";
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

function featureSpanLabel(firstYear: number | null, lastYear: number | null, years: number): string {
  if (firstYear !== null && lastYear !== null && firstYear !== lastYear) return `${firstYear} → ${lastYear}`;
  return `${years} listening years`;
}

function yearFromTimestamp(value: string | null): number | null {
  if (!value) return null;
  const match = /^(\d{4})/.exec(value);
  return match ? Number(match[1]) : null;
}

function firstParam(value: SearchParamValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
