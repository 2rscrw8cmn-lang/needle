import { env } from "cloudflare:workers";
import type { Metadata } from "next";
import Link from "next/link";

import { AlbumArtwork } from "../components/album-artwork";
import {
  loadHistoryYear,
  loadHistoryYears,
  resolveHistoryYear,
  type HistoryYearView,
} from "../../lib/history/history";
import styles from "./history.module.css";

export const metadata: Metadata = {
  title: "History",
};

export const dynamic = "force-dynamic";

type SearchParamValue = string | string[] | undefined;

interface HistoryPageProps {
  searchParams: Promise<{ year?: SearchParamValue }>;
}

export default async function HistoryPage({ searchParams }: HistoryPageProps) {
  const params = await searchParams;

  let years: number[];
  let selectedYear: number | null;
  let history: HistoryYearView | null = null;

  try {
    years = await loadHistoryYears(env.DB);
    selectedYear = resolveHistoryYear(firstParam(params.year), years);
    if (selectedYear !== null) {
      history = await loadHistoryYear(env.DB, selectedYear);
    }
  } catch {
    return <HistoryUnavailable />;
  }

  if (!history || selectedYear === null) {
    return <HistoryEmpty />;
  }

  return (
    <main className={styles.historyPage}>
      <header className={styles.historyHeader}>
        <div>
          <p className="page-kicker">Understand the archive over time</p>
          <h1>History</h1>
        </div>
        <p className={styles.selectedYear}>{selectedYear}</p>
      </header>

      <nav className={styles.yearNav} aria-label="Listening year">
        {years.map((year) => (
          <Link
            key={year}
            href={`/history?year=${year}`}
            aria-current={year === selectedYear ? "page" : undefined}
          >
            {year}
          </Link>
        ))}
      </nav>

      <section className={styles.yearIntro} aria-labelledby="year-title">
        <div>
          <p className="archive-label">Listening year</p>
          <h2 id="year-title">{selectedYear}</h2>
        </div>
        <p className={styles.yearStatement}>
          {history.totals.albums.toLocaleString()} {history.totals.albums === 1 ? "record" : "records"} with qualifying listening evidence.
        </p>
      </section>

      <dl className={styles.yearSummary}>
        <SummaryItem label="Albums" value={history.totals.albums} />
        <SummaryItem label="First heard" value={history.totals.firstHeard} />
        <SummaryItem label="Revisited" value={history.totals.revisited} />
        <SummaryItem label="Qualifying listens" value={history.totals.qualifyingListens} />
      </dl>

      {history.albums.length === 0 ? (
        <section className={styles.historyState}>
          <p className="archive-label">No qualifying records</p>
          <h2>No albums reached the History view for {selectedYear}.</h2>
        </section>
      ) : (
        <section className={styles.albumWall} aria-label={`Albums listened to in ${selectedYear}`}>
          {history.albums.map((album) => (
            <article className={styles.albumEntry} key={album.canonicalAlbumId}>
              <Link className={styles.albumLink} href={`/album/${encodeURIComponent(album.canonicalAlbumId)}`}>
                <AlbumArtwork
                  src={album.artworkUrl}
                  albumTitle={album.title}
                  artistName={album.artistName}
                  scale="grid"
                />
                <div className={styles.albumIdentity}>
                  <p className={styles.albumEvidence}>
                    {album.firstHeardInYear ? "First heard" : "Revisited"}
                    <span>·</span>
                    {album.yearQualifyingSessionCount} {album.yearQualifyingSessionCount === 1 ? "listen" : "listens"}
                  </p>
                  <h3>{album.title}</h3>
                  <p>{album.artistName}</p>
                </div>
              </Link>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}

function SummaryItem({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value.toLocaleString()}</dd>
    </div>
  );
}

function HistoryEmpty() {
  return (
    <main className={styles.historyState}>
      <p className="archive-label">No listening history yet</p>
      <h1>History will appear when the archive has qualifying album listens.</h1>
      <Link href="/library">Return to Library</Link>
    </main>
  );
}

function HistoryUnavailable() {
  return (
    <main className={styles.historyState}>
      <p className="archive-label">Archive unavailable</p>
      <h1>Listening history could not be read.</h1>
      <p>Needle could not reach the current archive. Try again after the database connection is available.</p>
      <Link href="/library">Return to Library</Link>
    </main>
  );
}

function firstParam(value: SearchParamValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
