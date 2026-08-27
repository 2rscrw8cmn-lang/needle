import { env } from "cloudflare:workers";
import type { Metadata } from "next";
import Link from "next/link";

import { AlbumArtwork } from "../../components/album-artwork";
import { loadAlbumDetail, type AlbumDetail } from "../../../lib/album/album";
import styles from "./album.module.css";

export const metadata: Metadata = {
  title: "Album",
};

export const dynamic = "force-dynamic";

type SearchParamValue = string | string[] | undefined;

interface AlbumPageProps {
  params: Promise<{ albumId: string }>;
  searchParams: Promise<{ saved?: SearchParamValue }>;
}

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

export default async function AlbumPage({ params, searchParams }: AlbumPageProps) {
  const [{ albumId }, query] = await Promise.all([params, searchParams]);
  const saved = firstParam(query.saved) === "1";

  let album: AlbumDetail | null;
  try {
    album = await loadAlbumDetail(env.DB, albumId);
  } catch {
    return <AlbumUnavailable />;
  }

  if (!album) {
    return <AlbumNotFound />;
  }

  const otherEvidenceCount = album.sparseSessionCount + album.reviewSessionCount;
  const albumRouteId = encodeURIComponent(album.canonicalAlbumId);

  return (
    <main className={styles.albumPage}>
      <div className={styles.backRow}>
        <Link href="/library">← Library</Link>
      </div>

      <section className={styles.albumHero} aria-labelledby="album-title">
        <div className={styles.artworkColumn}>
          <AlbumArtwork
            src={album.artworkUrl}
            albumTitle={album.title}
            artistName={album.artistName}
            scale="feature"
            priority
          />
        </div>

        <div className={styles.identityColumn}>
          <p className="page-kicker">From your archive</p>
          <h1 id="album-title" className={styles.albumTitle}>{album.title}</h1>
          <p className={styles.artistName}>{album.artistName}</p>

          <div className={styles.catalogMeta} aria-label="Album metadata">
            {album.releaseYear ? <span>{album.releaseYear}</span> : null}
            {album.musicType ? <span>{album.musicType}</span> : null}
            {album.catalogReviewStatus === "review" ? <span>Catalog match under review</span> : null}
          </div>

          {album.spotifyUrl ? (
            <a
              className={styles.spotifyLink}
              href={album.spotifyUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open in Spotify ↗
            </a>
          ) : null}
        </div>
      </section>

      <section className={styles.personalSection} aria-labelledby="personal-title">
        <div className={styles.sectionHeading}>
          <p className="archive-label">Your record</p>
          <h2 id="personal-title">Personal state</h2>
        </div>

        <form
          className={styles.personalForm}
          action={`/album/${albumRouteId}/state`}
          method="post"
        >
          <div className={styles.personalToggles}>
            <label>
              <input
                name="favorite"
                type="checkbox"
                value="1"
                defaultChecked={album.personalState.favorite}
              />
              <span>Favorite</span>
            </label>
            <label>
              <input
                name="revisit"
                type="checkbox"
                value="1"
                defaultChecked={album.personalState.revisit}
              />
              <span>Revisit</span>
            </label>
          </div>

          <label className={styles.reviewField}>
            <span>Review</span>
            <textarea
              name="review"
              maxLength={10000}
              rows={6}
              defaultValue={album.personalState.review}
              placeholder="Write your review of this record…"
            />
          </label>

          <div className={styles.personalActions}>
            <button type="submit">Save</button>
            {saved ? <span role="status">Saved</span> : null}
          </div>
        </form>
      </section>

      <section className={styles.historySection} aria-labelledby="history-title">
        <div className={styles.sectionHeading}>
          <p className="archive-label">Your history with this record</p>
          <h2 id="history-title">Listening history</h2>
        </div>

        <dl className={styles.historySummary}>
          <SummaryItem label="First heard" value={formatDate(album.firstMeaningfulListenAt)} />
          <SummaryItem label="Last heard" value={formatDate(album.lastMeaningfulListenAt)} />
          <SummaryItem
            label={album.fullSessionCount === 1 ? "Full Play" : "Full Plays"}
            value={album.fullSessionCount.toLocaleString()}
          />
          <SummaryItem label="Listening years" value={formatYearSpan(album.listeningYears)} />
        </dl>

        <div className={styles.evidenceSummary}>
          <EvidenceCount label="Nearly complete" count={album.nearCompleteSessionCount} />
          {album.sparseSessionCount > 0 ? <EvidenceCount label="Brief appearances" count={album.sparseSessionCount} /> : null}
          {album.reviewSessionCount > 0 ? <EvidenceCount label="Other evidence" count={album.reviewSessionCount} /> : null}
        </div>

        {album.listeningYears.length > 0 ? (
          <div className={styles.yearLinks} aria-label="Listening years">
            {album.listeningYears.map((year) => (
              <Link key={year} href={`/library?heard=${year}`}>{year}</Link>
            ))}
          </div>
        ) : null}
      </section>

      <section className={styles.timelineSection} aria-labelledby="timeline-title">
        <div className={styles.timelineHeading}>
          <div>
            <p className="archive-label">Listening evidence</p>
            <h2 id="timeline-title">Listening sessions</h2>
          </div>
          <p className={styles.timelineCount}>
            {formatSessionCount(album.sessions.length, album.qualifyingSessionCount)}
          </p>
        </div>

        {otherEvidenceCount > 0 ? (
          <p className={styles.timelineNote}>
            {otherEvidenceCount.toLocaleString()} brief or uncertain {otherEvidenceCount === 1 ? "appearance is" : "appearances are"} summarized above rather than listed here.
          </p>
        ) : null}

        {album.sessions.length === 0 ? (
          <p className={styles.noSessions}>No Full or Near-Complete listening sessions are available for this record.</p>
        ) : (
          <ol className={styles.timelineList}>
            {album.sessions.map((session) => (
              <li className={styles.timelineRow} key={session.sessionId}>
                <time dateTime={session.startedAt}>{formatDate(session.startedAt)}</time>
                <strong>{session.evidenceLabel}</strong>
                <span>{formatSessionContext(session.sessionMinutes, session.credibleUniqueTracks)}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function EvidenceCount({ label, count }: { label: string; count: number }) {
  return (
    <span>
      <strong>{count.toLocaleString()}</strong> {label}
    </span>
  );
}

function AlbumNotFound() {
  return (
    <main className={styles.albumState}>
      <p className="archive-label">Record not found</p>
      <h1>This album is not in the current archive.</h1>
      <p>The link may point to an older canonical record or a record that has not reached the current archive.</p>
      <Link href="/library">Return to Library</Link>
    </main>
  );
}

function AlbumUnavailable() {
  return (
    <main className={styles.albumState}>
      <p className="archive-label">Archive unavailable</p>
      <h1>This record could not be read.</h1>
      <p>Needle could not reach the current archive. Try again after the database connection is available.</p>
      <Link href="/library">Return to Library</Link>
    </main>
  );
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : dateFormatter.format(date);
}

function formatYearSpan(years: number[]): string {
  if (years.length === 0) return "—";
  if (years.length === 1) return String(years[0]);
  return `${years[0]}–${years[years.length - 1]}`;
}

function formatSessionCount(visible: number, total: number): string {
  if (visible < total) return `Latest ${visible.toLocaleString()} of ${total.toLocaleString()}`;
  return `${total.toLocaleString()} ${total === 1 ? "session" : "sessions"}`;
}

function formatSessionContext(minutes: number, tracks: number): string {
  const roundedMinutes = Math.max(0, Math.round(minutes));
  const minuteLabel = `${roundedMinutes} min`;
  if (tracks <= 0) return minuteLabel;
  return `${tracks} ${tracks === 1 ? "track" : "tracks"} · ${minuteLabel}`;
}

function firstParam(value: SearchParamValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
