import { env } from "cloudflare:workers";
import type { Metadata } from "next";
import Link from "next/link";

import { AlbumArtwork } from "../components/album-artwork";
import { loadExplore, type ExploreView } from "../../lib/explore/explore";
import styles from "./explore.module.css";

export const metadata: Metadata = {
  title: "Explore",
};

export const dynamic = "force-dynamic";

export default async function ExplorePage() {
  let explore: ExploreView;
  try {
    explore = await loadExplore(env.DB);
  } catch {
    return <ExploreUnavailable />;
  }

  const hasArchive = explore.decades.length > 0 || explore.artists.length > 0 || explore.crossTimeAlbums.length > 0;
  if (!hasArchive) return <ExploreEmpty />;

  return (
    <main className={styles.explorePage}>
      <header className={styles.exploreHeader}>
        <p className="page-kicker">Browse without a target</p>
        <h1>Explore</h1>
        <p>Move through the archive by release era, artist, and the records that keep returning across time.</p>
      </header>

      <section className={styles.exploreSection} aria-labelledby="decade-title">
        <div className={styles.sectionHeading}>
          <p className="archive-label">Release era</p>
          <h2 id="decade-title">By decade</h2>
        </div>
        <div className={styles.decadeGrid}>
          {explore.decades.map((item) => (
            <Link key={item.decade} href={`/library?decade=${item.decade}`} className={styles.decadeLink}>
              <span>{item.decade}s</span>
              <small>{item.albumCount.toLocaleString()} {item.albumCount === 1 ? "album" : "albums"}</small>
            </Link>
          ))}
        </div>
      </section>

      {explore.crossTimeAlbums.length > 0 ? (
        <section className={styles.exploreSection} aria-labelledby="cross-time-title">
          <div className={styles.sectionHeading}>
            <p className="archive-label">Across your history</p>
            <h2 id="cross-time-title">Records that stayed with you</h2>
          </div>
          <div className={styles.albumShelf}>
            {explore.crossTimeAlbums.map((album) => (
              <article key={album.canonicalAlbumId} className={styles.albumEntry}>
                <Link href={`/album/${encodeURIComponent(album.canonicalAlbumId)}`}>
                  <AlbumArtwork
                    src={album.artworkUrl}
                    albumTitle={album.title}
                    artistName={album.artistName}
                    scale="grid"
                  />
                  <div className={styles.albumIdentity}>
                    <p className={styles.albumEvidence}>{album.distinctListeningYears} listening years · {album.qualifyingSessionCount} qualifying listens</p>
                    <h3>{album.title}</h3>
                    <p>{album.artistName}</p>
                  </div>
                </Link>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className={styles.exploreSection} aria-labelledby="artists-title">
        <div className={styles.sectionHeading}>
          <p className="archive-label">Collection index</p>
          <h2 id="artists-title">Artists</h2>
        </div>
        <div className={styles.artistList}>
          {explore.artists.map((artist) => (
            <Link key={artist.artistId} href={`/library?q=${encodeURIComponent(artist.name)}`}>
              <span>{artist.name}</span>
              <small>{artist.albumCount.toLocaleString()} {artist.albumCount === 1 ? "album" : "albums"}</small>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}

function ExploreEmpty() {
  return (
    <main className={styles.exploreState}>
      <p className="archive-label">Nothing to explore yet</p>
      <h1>Explore will fill in as the archive gains records.</h1>
      <Link href="/library">Return to Library</Link>
    </main>
  );
}

function ExploreUnavailable() {
  return (
    <main className={styles.exploreState}>
      <p className="archive-label">Archive unavailable</p>
      <h1>Explore could not read the collection.</h1>
      <p>Needle could not reach the current archive. Try again after the database connection is available.</p>
      <Link href="/library">Return to Library</Link>
    </main>
  );
}
