import { env } from "cloudflare:workers";
import Link from "next/link";

import { AlbumArtwork } from "./components/album-artwork";
import { loadHome, type HomeAlbum, type HomeView } from "../lib/home/home";
import styles from "./home.module.css";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let home: HomeView;
  try {
    home = await loadHome(env.DB);
  } catch {
    return <HomeUnavailable />;
  }

  if (!home.featured) return <HomeEmpty />;

  return (
    <main className={styles.homePage}>
      <header className={styles.homeHeader}>
        <p className="page-kicker">Personal music archive</p>
        <h1>A record of listening.</h1>
        <p>Return to the records that have shaped your archive, surfaced from your own listening history rather than a recommendation feed.</p>
      </header>

      <section className={styles.featured} aria-labelledby="featured-title">
        <Link className={styles.featuredArtwork} href={`/album/${encodeURIComponent(home.featured.canonicalAlbumId)}`}>
          <AlbumArtwork
            src={home.featured.artworkUrl}
            albumTitle={home.featured.title}
            artistName={home.featured.artistName}
            scale="feature"
            priority
          />
        </Link>
        <div className={styles.featuredCopy}>
          <p className="archive-label">From your history</p>
          <h2 id="featured-title">{home.featured.title}</h2>
          <p className={styles.featuredArtist}>{home.featured.artistName}</p>
          <p className={styles.featuredStory}>{featuredStory(home.featured)}</p>
          <Link className="text-link" href={`/album/${encodeURIComponent(home.featured.canonicalAlbumId)}`}>Open record</Link>
        </div>
      </section>

      {home.recentlyRevisited.length > 0 ? (
        <HomeShelf
          title="Recently revisited"
          kicker="Back in rotation"
          albums={home.recentlyRevisited}
          context={(album) => `Last heard ${formatMonthYear(album.lastMeaningfulListenAt)}`}
        />
      ) : null}

      {home.worthAnotherListen.length > 0 ? (
        <HomeShelf
          title="Worth another listen"
          kicker="From deeper in the archive"
          albums={home.worthAnotherListen}
          context={(album) => `Last heard ${formatMonthYear(album.lastMeaningfulListenAt)}`}
        />
      ) : null}

      <footer className={styles.homeFooter}>
        <p>Everything here is derived from stored album-listening evidence.</p>
        <div>
          <Link href="/history">Browse history</Link>
          <Link href="/explore">Explore the archive</Link>
        </div>
      </footer>
    </main>
  );
}

function HomeShelf({
  title,
  kicker,
  albums,
  context,
}: {
  title: string;
  kicker: string;
  albums: HomeAlbum[];
  context: (album: HomeAlbum) => string;
}) {
  return (
    <section className={styles.homeShelf} aria-labelledby={`home-${title.toLowerCase().replaceAll(" ", "-")}`}>
      <div className={styles.shelfHeading}>
        <p className="archive-label">{kicker}</p>
        <h2 id={`home-${title.toLowerCase().replaceAll(" ", "-")}`}>{title}</h2>
      </div>
      <div className={styles.shelfGrid}>
        {albums.map((album) => (
          <article key={album.canonicalAlbumId} className={styles.shelfAlbum}>
            <Link href={`/album/${encodeURIComponent(album.canonicalAlbumId)}`}>
              <AlbumArtwork
                src={album.artworkUrl}
                albumTitle={album.title}
                artistName={album.artistName}
                scale="grid"
              />
              <div className={styles.albumIdentity}>
                <p className={styles.albumContext}>{context(album)}</p>
                <h3>{album.title}</h3>
                <p>{album.artistName}</p>
              </div>
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}

function featuredStory(album: HomeAlbum): string {
  const first = yearFromTimestamp(album.firstMeaningfulListenAt);
  const last = yearFromTimestamp(album.lastMeaningfulListenAt);
  const years = album.distinctListeningYears;
  const plays = album.fullPlayCount;
  const playLabel = plays === 1 ? "Full Play" : "Full Plays";

  if (first && last && first !== last) {
    return `First heard in ${first}, last heard in ${last}. This record appears across ${years} listening ${years === 1 ? "year" : "years"} with ${plays} ${playLabel}.`;
  }
  return `This record has ${plays} ${playLabel} across ${years} listening ${years === 1 ? "year" : "years"}.`;
}

function formatMonthYear(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}

function yearFromTimestamp(value: string | null): number | null {
  if (!value) return null;
  const match = /^(\d{4})/.exec(value);
  return match ? Number(match[1]) : null;
}

function HomeEmpty() {
  return (
    <main className={styles.homeState}>
      <p className="archive-label">No archive yet</p>
      <h1>A record of listening.</h1>
      <p>Home will begin rediscovering records once meaningful album history is loaded.</p>
      <Link href="/library">Enter the Library</Link>
    </main>
  );
}

function HomeUnavailable() {
  return (
    <main className={styles.homeState}>
      <p className="archive-label">Archive unavailable</p>
      <h1>Home could not read the collection.</h1>
      <p>Needle could not reach the current archive. Try again after the database connection is available.</p>
      <Link href="/library">Enter the Library</Link>
    </main>
  );
}
