"use client";

import Link from "next/link";
import {
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from "react";

import type { HomeAlbum, HomeHistoryYear, HomeView } from "../../lib/home/home";
import { AlbumArtwork } from "./album-artwork";
import styles from "../home.module.css";

interface HomeIssueProps {
  home: HomeView;
  initialIssueIndex: number;
  issueNumber: number;
  issueDate: string;
}

type LeadLayoutId = "archive-ledger" | "feature-satellites" | "gallery-lead";

interface IssueLead {
  eyebrow: string;
  headline: string;
  rule: string;
  body: string;
  albums: HomeAlbum[];
}

interface IssueSection {
  title: string;
  note: string;
  albums: HomeAlbum[];
}

interface IssueDefinition {
  number: number;
  date: string;
  layoutId: LeadLayoutId;
  slugline: string;
  lead: IssueLead;
  sectionTwo: IssueSection;
  sectionThree: IssueSection;
}

interface LeadLayoutProps {
  issue: IssueDefinition;
}

const LEAD_LAYOUTS = {
  "archive-ledger": ArchiveLedgerLead,
  "feature-satellites": FeatureSatellitesLead,
  "gallery-lead": GalleryLead,
} satisfies Record<LeadLayoutId, (props: LeadLayoutProps) => ReactNode>;

export function HomeIssue({ home, initialIssueIndex, issueNumber, issueDate }: HomeIssueProps) {
  const issues = useMemo(
    () => buildIssues(home, issueNumber, issueDate, initialIssueIndex),
    [home, issueNumber, issueDate, initialIssueIndex],
  );
  const [issueIndex, setIssueIndex] = useState(initialIssueIndex % issues.length);
  const [selectedYear, setSelectedYear] = useState<number | null>(home.history.at(-1)?.year ?? null);
  const issue = issues[issueIndex];

  return (
    <main className={`${styles.homePage} home-shell`}>
      <section className={styles.issueIndex} aria-label="Needle issue index">
        {issues.map((entry, index) => (
          <button
            type="button"
            className={styles.issueIndexItem}
            data-selected={index === issueIndex ? "true" : "false"}
            aria-pressed={index === issueIndex}
            onClick={() => setIssueIndex(index)}
            key={`${entry.number}-${entry.slugline}`}
          >
            <span className={styles.issueIndexMeta}>
              <span>Issue N° {String(entry.number).padStart(3, "0")}</span>
              <span>{entry.date}</span>
            </span>
            <strong>{entry.slugline}</strong>
          </button>
        ))}
      </section>

      <section className={styles.leadSection} aria-labelledby="home-lead-title">
        <MarginNote
          numeral="I"
          lines={[
            `Issue N° ${String(issue.number).padStart(3, "0")}`,
            issue.date,
            `${home.archive.archiveCount.toLocaleString()} records`,
            archiveRange(home),
          ]}
          note={issue.lead.rule}
        />
        <div className={styles.leadBody}>
          <IssueLeadFrame issue={issue} key={issue.number} />
        </div>
      </section>

      <section className={styles.sectionGrid} aria-labelledby="home-shelf-title">
        <MarginNote
          numeral="II"
          lines={[`Issue N° ${String(issue.number).padStart(3, "0")}`]}
          note={issue.sectionTwo.note}
        />
        <div className={styles.sectionBody}>
          <p className={styles.mobileMarginNote}>{issue.sectionTwo.note}</p>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.eyebrow}>Section II · Issue shelf</p>
              <h2 id="home-shelf-title">{issue.sectionTwo.title}</h2>
            </div>
            <Link href="/library">Open library →</Link>
          </div>
          <DragShelf key={issue.number}>
            {issue.sectionTwo.albums.map((album, index) => (
              <Link
                className={styles.shelfItem}
                href={`/album/${encodeURIComponent(album.canonicalAlbumId)}`}
                key={album.canonicalAlbumId}
              >
                <AlbumArtwork
                  src={album.artworkUrl}
                  albumTitle={album.title}
                  artistName={album.artistName}
                  scale="shelf"
                />
                <span>{catalogRef(issueIndex * 100 + index)}</span>
              </Link>
            ))}
          </DragShelf>
        </div>
      </section>

      <section className={styles.sectionGrid} aria-labelledby="home-module-title">
        <MarginNote numeral="III" lines={[issue.sectionThree.title]} note={issue.sectionThree.note} />
        <div className={styles.sectionBody}>
          <p className={styles.mobileMarginNote}>{issue.sectionThree.note}</p>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.eyebrow}>Section III · Archive view</p>
              <h2 id="home-module-title">{issue.sectionThree.title}</h2>
            </div>
          </div>
          <div className={styles.moduleGrid}>
            {issue.sectionThree.albums.map((album, index) => (
              <Link
                className={styles.moduleItem}
                href={`/album/${encodeURIComponent(album.canonicalAlbumId)}`}
                key={album.canonicalAlbumId}
              >
                <AlbumArtwork
                  src={album.artworkUrl}
                  albumTitle={album.title}
                  artistName={album.artistName}
                  scale="grid"
                />
                <div className={styles.moduleIdentity}>
                  <div>
                    <h3>{album.title}</h3>
                    <p>{album.artistName}</p>
                  </div>
                  <span>{catalogRef(issueIndex * 4 + index)}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.sectionGrid} aria-labelledby="home-history-title">
        <MarginNote numeral="IV" lines={[archiveRange(home)]} note="First heard versus returning records, year by year." />
        <div className={styles.sectionBody}>
          <p className={styles.mobileMarginNote}>First heard versus returning records, year by year.</p>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.eyebrow}>Section IV · History</p>
              <h2 id="home-history-title">Years in the archive.</h2>
            </div>
            <div className={styles.chartLegend} aria-label="Chart legend">
              <span><i className={styles.legendFirst} />First heard</span>
              <span><i className={styles.legendReturning} />Returning</span>
            </div>
          </div>
          <HistoryChart years={home.history} selectedYear={selectedYear} onSelect={setSelectedYear} />
        </div>
      </section>
    </main>
  );
}

function MarginNote({ numeral, lines, note }: { numeral: string; lines: string[]; note: string }) {
  return (
    <aside className={styles.marginColumn}>
      <span className={styles.roman}>{numeral}</span>
      <div className={styles.marginFacts}>
        {lines.map((line) => <span key={line}>{line}</span>)}
      </div>
      <p>{note}</p>
    </aside>
  );
}

function IssueLeadFrame({ issue }: LeadLayoutProps) {
  const Layout = LEAD_LAYOUTS[issue.layoutId];
  return (
    <div className={styles.issueLeadFrame} data-layout={issue.layoutId}>
      <Layout issue={issue} />
    </div>
  );
}

function ArchiveLedgerLead({ issue }: LeadLayoutProps) {
  const hero = issue.lead.albums[0];
  if (!hero) return null;
  return (
    <div className={`${styles.leadLayout} ${styles.archiveLedger}`}>
      <LeadCopy lead={issue.lead} hero={hero} />
      <MetaRail album={hero} />
      <HeroAlbum album={hero} />
    </div>
  );
}

function FeatureSatellitesLead({ issue }: LeadLayoutProps) {
  const [hero, second, third] = issue.lead.albums;
  if (!hero) return null;
  return (
    <div className={`${styles.leadLayout} ${styles.featureSatellites}`}>
      <LeadCopy lead={issue.lead} hero={hero} />
      <div className={styles.featureArtwork}>
        <HeroAlbum album={hero} />
        <div className={styles.satelliteAlbums} aria-label="Supporting records">
          {second ? <CompactAlbum album={second} /> : null}
          {third ? <CompactAlbum album={third} /> : null}
        </div>
        <MetaRail album={hero} />
      </div>
    </div>
  );
}

function GalleryLead({ issue }: LeadLayoutProps) {
  const [hero, second, third] = issue.lead.albums;
  if (!hero) return null;
  return (
    <div className={`${styles.leadLayout} ${styles.galleryLead}`}>
      <LeadCopy lead={issue.lead} hero={hero} />
      <div className={styles.galleryAlbums} aria-label="Lead records">
        <HeroAlbum album={hero} />
        {second ? <CompactAlbum album={second} /> : null}
        {third ? <CompactAlbum album={third} /> : null}
      </div>
    </div>
  );
}

function LeadCopy({ lead, hero }: { lead: IssueLead; hero: HomeAlbum }) {
  return (
    <div className={styles.leadCopy}>
      <p className={styles.eyebrow}>{lead.eyebrow}</p>
      <h1 id="home-lead-title">{lead.headline}</h1>
      <div className={styles.leadRule} />
      <p className={styles.leadText}>{lead.body}</p>
      <Link className={styles.leadCta} href={`/album/${encodeURIComponent(hero.canonicalAlbumId)}`}>Open lead record <span>→</span></Link>
    </div>
  );
}

function DragShelf({ children }: { children: ReactNode }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ active: false, moved: false, startX: 0, startScrollLeft: 0 });
  const [dragging, setDragging] = useState(false);

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    const scroller = scrollerRef.current;
    if (!scroller) return;
    dragRef.current = {
      active: true,
      moved: false,
      startX: event.clientX,
      startScrollLeft: scroller.scrollLeft,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!dragRef.current.active || !scrollerRef.current) return;
    const distance = event.clientX - dragRef.current.startX;
    if (!dragRef.current.moved && Math.abs(distance) > 7) {
      dragRef.current.moved = true;
      setDragging(true);
    }
    if (!dragRef.current.moved) return;
    event.preventDefault();
    scrollerRef.current.scrollLeft = dragRef.current.startScrollLeft - distance;
  }

  function endDrag(event: PointerEvent<HTMLDivElement>) {
    if (!dragRef.current.active) return;
    dragRef.current.active = false;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function protectDraggedLink(event: MouseEvent<HTMLDivElement>) {
    if (!dragRef.current.moved) return;
    event.preventDefault();
    event.stopPropagation();
    dragRef.current.moved = false;
  }

  return (
    <div
      ref={scrollerRef}
      className={styles.shelfScroller}
      data-dragging={dragging ? "true" : "false"}
      aria-label="Issue shelf albums"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onClickCapture={protectDraggedLink}
      onDragStart={(event) => event.preventDefault()}
    >
      {children}
    </div>
  );
}

function HeroAlbum({ album }: { album: HomeAlbum }) {
  return (
    <Link className={styles.heroAlbum} href={`/album/${encodeURIComponent(album.canonicalAlbumId)}`}>
      <AlbumArtwork
        src={album.artworkUrl}
        albumTitle={album.title}
        artistName={album.artistName}
        scale="feature"
        priority
      />
      <div className={styles.heroIdentity}>
        <div>
          <h2>{album.title}</h2>
          <p>{album.artistName}</p>
        </div>
        <span>{yearFromTimestamp(album.firstMeaningfulListenAt) ?? "—"}</span>
      </div>
    </Link>
  );
}

function CompactAlbum({ album }: { album: HomeAlbum }) {
  return (
    <Link className={styles.compactAlbum} href={`/album/${encodeURIComponent(album.canonicalAlbumId)}`}>
      <AlbumArtwork src={album.artworkUrl} albumTitle={album.title} artistName={album.artistName} scale="grid" />
      <h3>{album.title}</h3>
      <p>{album.artistName}</p>
    </Link>
  );
}

function MetaRail({ album }: { album: HomeAlbum }) {
  const entries = [
    ["First heard", yearFromTimestamp(album.firstMeaningfulListenAt) ?? "—"],
    ["Last heard", yearFromTimestamp(album.lastMeaningfulListenAt) ?? "—"],
    ["Full plays", album.fullPlayCount],
  ];
  return (
    <dl className={styles.metaRail}>
      {entries.map(([label, value]) => (
        <div key={label}>
          <dd>{value}</dd>
          <dt>{label}</dt>
        </div>
      ))}
    </dl>
  );
}

function HistoryChart({
  years,
  selectedYear,
  onSelect,
}: {
  years: HomeHistoryYear[];
  selectedYear: number | null;
  onSelect: (year: number) => void;
}) {
  const maxAlbums = Math.max(1, ...years.map((year) => year.albumCount));
  const selected = years.find((year) => year.year === selectedYear) ?? years.at(-1) ?? null;

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const nextIndex = event.key === "ArrowLeft" ? Math.max(0, index - 1) : Math.min(years.length - 1, index + 1);
    onSelect(years[nextIndex].year);
    document.getElementById(`home-history-${years[nextIndex].year}`)?.focus();
  }

  if (years.length === 0) {
    return <p className={styles.localError}>No year history is available in the current archive.</p>;
  }

  return (
    <div className={styles.historyLayout}>
      <div className={styles.chart} role="group" aria-label="Archive history by year">
        {years.map((year, index) => {
          const height = Math.max(8, (year.albumCount / maxAlbums) * 100);
          const firstShare = year.albumCount === 0 ? 0 : (year.firstHeardCount / year.albumCount) * 100;
          return (
            <button
              id={`home-history-${year.year}`}
              type="button"
              className={styles.yearColumn}
              key={year.year}
              data-selected={year.year === selected?.year ? "true" : "false"}
              onClick={() => onSelect(year.year)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              aria-label={`${year.year}: ${year.firstHeardCount} first heard, ${year.returningCount} returning records`}
            >
              <span className={styles.yearPlot}>
                <span className={styles.yearBar} style={{ height: `${height}%` }}>
                  <i className={styles.firstSegment} style={{ height: `${firstShare}%` }} />
                  <i className={styles.returningSegment} style={{ height: `${100 - firstShare}%` }} />
                </span>
              </span>
              <span className={styles.yearLabel}>{String(year.year).slice(2)}</span>
            </button>
          );
        })}
      </div>
      {selected ? (
        <aside className={styles.selectedYear}>
          <span>Selected</span>
          <strong>{selected.year}</strong>
          <p>{selected.albumCount} records · {selected.fullPlayCount} Full Plays</p>
          <p>{selected.firstHeardCount} first heard · {selected.returningCount} returning</p>
          <Link href={`/history?year=${selected.year}`}>Open year →</Link>
        </aside>
      ) : null}
    </div>
  );
}

function buildIssues(
  home: HomeView,
  currentIssueNumber: number,
  currentIssueDate: string,
  currentIssueIndex: number,
): IssueDefinition[] {
  const featured = home.featured;
  const recent = home.recentlyRevisited;
  const stale = home.worthAnotherListen;
  const shared = [featured, ...recent, ...home.rotating].filter((album): album is HomeAlbum => Boolean(album));
  const issueMeta = [0, 1, 2].map((index) => buildIssueMeta(currentIssueNumber, currentIssueDate, index - currentIssueIndex));

  return [
    {
      ...issueMeta[0],
      layoutId: "archive-ledger",
      slugline: "Still in the archive",
      lead: {
        eyebrow: "A record across time",
        headline: "Still in the archive.",
        rule: "The record with the longest reach across your listening history.",
        body: featured ? storyFor(featured) : "A record supported by the longest span of listening evidence in the current archive.",
        albums: [featured, ...recent].filter((album): album is HomeAlbum => Boolean(album)).slice(0, 3),
      },
      sectionTwo: {
        title: "Records carried across time.",
        note: "A shelf built around records that keep returning across the archive.",
        albums: uniqueAlbums(shared).slice(0, 12),
      },
      sectionThree: {
        title: "Most carried forward",
        note: "Records ordered by Full Plays, then by the number of listening years they span.",
        albums: rotateAlbums(uniqueAlbums(shared), 0, 4),
      },
    },
    {
      ...issueMeta[1],
      layoutId: "feature-satellites",
      slugline: "Recent returns",
      lead: {
        eyebrow: "Back in rotation",
        headline: "Returned to, recently.",
        rule: "Records heard again most recently after appearing in more than one listening year.",
        body: recent[0] ? storyFor(recent[0]) : "A recent return supported by listening evidence across more than one year.",
        albums: [recent[0] ?? featured, recent[1], recent[2]].filter((album): album is HomeAlbum => Boolean(album)),
      },
      sectionTwo: {
        title: "Back in rotation.",
        note: "The records that have reappeared most recently after crossing more than one listening year.",
        albums: uniqueAlbums([...recent, ...home.rotating]).slice(0, 12),
      },
      sectionThree: {
        title: "Recent returns",
        note: "A deterministic view of records that have crossed more than one listening year.",
        albums: uniqueAlbums([...recent, ...home.rotating]).slice(0, 4),
      },
    },
    {
      ...issueMeta[2],
      layoutId: "gallery-lead",
      slugline: "Deep archive",
      lead: {
        eyebrow: "From deeper in the archive",
        headline: "Further back on the shelf.",
        rule: "Records ordered from the oldest last-heard evidence in the current archive.",
        body: stale[0] ? storyFor(stale[0]) : "A record surfaced from the oldest last-heard evidence still represented in the archive.",
        albums: [stale[0] ?? featured, stale[1], stale[2]].filter((album): album is HomeAlbum => Boolean(album)),
      },
      sectionTwo: {
        title: "Not heard in a while.",
        note: "A shelf pulled from the oldest last-heard evidence still represented in the archive.",
        albums: uniqueAlbums([...stale, ...home.shelf]).slice(0, 12),
      },
      sectionThree: {
        title: "Deep archive",
        note: "A quieter pass through records whose last meaningful listen sits further back in time.",
        albums: uniqueAlbums([...stale, ...home.rotating]).slice(0, 4),
      },
    },
  ];
}

function buildIssueMeta(currentNumber: number, currentDate: string, dayOffset: number) {
  const parsed = new Date(`${currentDate} 12:00:00 UTC`);
  const date = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  date.setUTCDate(date.getUTCDate() + dayOffset);
  return {
    number: Math.max(1, currentNumber + dayOffset),
    date: new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
      timeZone: "UTC",
    }).format(date),
  };
}

function uniqueAlbums(albums: HomeAlbum[]): HomeAlbum[] {
  const seen = new Set<string>();
  return albums.filter((album) => {
    if (seen.has(album.canonicalAlbumId)) return false;
    seen.add(album.canonicalAlbumId);
    return true;
  });
}

function rotateAlbums(albums: HomeAlbum[], offset: number, count: number): HomeAlbum[] {
  if (albums.length <= count) return albums.slice(0, count);
  return Array.from({ length: count }, (_, index) => albums[(offset + index) % albums.length]);
}

function storyFor(album: HomeAlbum): string {
  const first = yearFromTimestamp(album.firstMeaningfulListenAt);
  const last = yearFromTimestamp(album.lastMeaningfulListenAt);
  if (first && last && first !== last) {
    return `${album.title} first appears in ${first} and returns as late as ${last}, spanning ${album.distinctListeningYears} listening years with ${album.fullPlayCount} Full ${album.fullPlayCount === 1 ? "Play" : "Plays"}.`;
  }
  return `${album.title} carries ${album.fullPlayCount} Full ${album.fullPlayCount === 1 ? "Play" : "Plays"} across ${album.distinctListeningYears} listening ${album.distinctListeningYears === 1 ? "year" : "years"}.`;
}

function yearFromTimestamp(value: string | null): number | null {
  if (!value) return null;
  const match = /^(\d{4})/.exec(value);
  return match ? Number(match[1]) : null;
}

function archiveRange(home: HomeView): string {
  if (!home.archive.minYear || !home.archive.maxYear) return "Archive years unavailable";
  return `${home.archive.minYear}—${home.archive.maxYear}`;
}

function catalogRef(index: number): string {
  return `N-${String(index + 1).padStart(4, "0")}`;
}
