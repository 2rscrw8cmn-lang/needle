"use client";

import Link from "next/link";
import { useMemo, useState, type CSSProperties, type KeyboardEvent } from "react";

import type { HomeAlbum, HomeHistoryYear, HomeView } from "../../lib/home/home";
import { AlbumArtwork } from "./album-artwork";
import styles from "../home.module.css";

interface HomeIssueProps {
  home: HomeView;
  initialIssueIndex: number;
  issueNumber: number;
  issueDate: string;
}

type LeadTemplate = "A" | "B" | "C";

interface IssueDefinition {
  template: LeadTemplate;
  eyebrow: string;
  headline: string;
  rule: string;
  body: string;
  moduleTitle: string;
  moduleNote: string;
  leadAlbums: HomeAlbum[];
}

export function HomeIssue({ home, initialIssueIndex, issueNumber, issueDate }: HomeIssueProps) {
  const issues = useMemo(() => buildIssues(home), [home]);
  const [issueIndex, setIssueIndex] = useState(initialIssueIndex % issues.length);
  const [selectedYear, setSelectedYear] = useState<number | null>(home.history.at(-1)?.year ?? null);
  const issue = issues[issueIndex];
  const rotatingAlbums = rotateAlbums(home.rotating, issueIndex * 4, 4);

  function turnIssue(direction: -1 | 1) {
    setIssueIndex((current) => (current + direction + issues.length) % issues.length);
  }

  return (
    <main className={`${styles.homePage} home-shell`}>
      <section className={styles.issueBar} aria-label="Current Needle issue">
        <p className={styles.issueMeta}>Issue N° {String(issueNumber).padStart(2, "0")} · {issueDate}</p>
        <p className={styles.issueRule}>{issue.rule}</p>
        <div className={styles.issueTurner}>
          <span>Turn the issue</span>
          <button type="button" onClick={() => turnIssue(-1)} aria-label="Previous issue">‹</button>
          <button type="button" onClick={() => turnIssue(1)} aria-label="Next issue">›</button>
        </div>
      </section>

      <section className={styles.leadSection} aria-labelledby="home-lead-title">
        <MarginNote
          numeral="I"
          lines={[
            `${home.archive.archiveCount.toLocaleString()} records`,
            archiveRange(home),
            `Compiled ${issueDate}`,
          ]}
          note={issue.rule}
        />
        <div className={styles.leadBody}>
          <p className={styles.mobileMarginNote}>{issue.rule}</p>
          {issue.template === "A" ? <LeadA issue={issue} /> : null}
          {issue.template === "B" ? <LeadB issue={issue} /> : null}
          {issue.template === "C" ? <LeadC issue={issue} /> : null}
        </div>
      </section>

      <section className={styles.sectionGrid} aria-labelledby="home-shelf-title">
        <MarginNote
          numeral="II"
          lines={[`${home.archive.archiveCount.toLocaleString()} archive entries`]}
          note="A chronological shelf from the current archive."
        />
        <div className={styles.sectionBody}>
          <p className={styles.mobileMarginNote}>A chronological shelf from the current archive.</p>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.eyebrow}>Section II · Shelf</p>
              <h2 id="home-shelf-title">The archive, in order.</h2>
            </div>
            <Link href="/library">View all ({home.archive.archiveCount.toLocaleString()}) →</Link>
          </div>
          <div className={styles.shelfScroller}>
            {home.shelf.map((album, index) => (
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
                <span>{catalogRef(index)}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.sectionGrid} aria-labelledby="home-module-title">
        <MarginNote numeral="III" lines={[issue.moduleTitle]} note={issue.moduleNote} />
        <div className={styles.sectionBody}>
          <p className={styles.mobileMarginNote}>{issue.moduleNote}</p>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.eyebrow}>Section III · Archive view</p>
              <h2 id="home-module-title">{issue.moduleTitle}</h2>
            </div>
          </div>
          <div className={styles.moduleGrid}>
            {rotatingAlbums.map((album, index) => (
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

function LeadA({ issue }: { issue: IssueDefinition }) {
  const hero = issue.leadAlbums[0];
  if (!hero) return null;
  return (
    <div className={`${styles.lead} ${styles.leadA}`}>
      <LeadCopy issue={issue} hero={hero} />
      <MetaRail album={hero} />
      <HeroAlbum album={hero} />
    </div>
  );
}

function LeadB({ issue }: { issue: IssueDefinition }) {
  const [hero, second, third] = issue.leadAlbums;
  if (!hero) return null;
  return (
    <div className={`${styles.lead} ${styles.leadB}`}>
      <LeadCopy issue={issue} hero={hero} />
      <div className={styles.leadBArtwork}>
        <HeroAlbum album={hero} />
        <div className={styles.leadPair}>
          {second ? <CompactAlbum album={second} /> : null}
          {third ? <CompactAlbum album={third} /> : null}
        </div>
        <MetaRail album={hero} horizontal />
      </div>
    </div>
  );
}

function LeadC({ issue }: { issue: IssueDefinition }) {
  const [hero, second, third] = issue.leadAlbums;
  if (!hero) return null;
  const albums = [hero, second, third].filter((album): album is HomeAlbum => Boolean(album));
  return (
    <div className={`${styles.lead} ${styles.leadC}`}>
      <div className={styles.leadCIntro}>
        <p className={styles.eyebrow}>{issue.eyebrow}</p>
        <h1 id="home-lead-title">{issue.headline}</h1>
        <div className={styles.leadCBody}>
          <p>{issue.body}</p>
          <Link className={styles.leadCta} href={`/album/${encodeURIComponent(hero.canonicalAlbumId)}`}>Open lead record <span>→</span></Link>
        </div>
      </div>
      <div className={styles.leadTrio}>
        {albums.map((album) => <CompactAlbum album={album} key={album.canonicalAlbumId} />)}
      </div>
    </div>
  );
}

function LeadCopy({ issue, hero }: { issue: IssueDefinition; hero: HomeAlbum }) {
  return (
    <div className={styles.leadCopy}>
      <p className={styles.eyebrow}>{issue.eyebrow}</p>
      <h1 id="home-lead-title">{issue.headline}</h1>
      <div className={styles.leadRule} />
      <p className={styles.leadText}>{issue.body}</p>
      <Link className={styles.leadCta} href={`/album/${encodeURIComponent(hero.canonicalAlbumId)}`}>Open lead record <span>→</span></Link>
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

function MetaRail({ album, horizontal = false }: { album: HomeAlbum; horizontal?: boolean }) {
  const entries = [
    ["First heard", yearFromTimestamp(album.firstMeaningfulListenAt) ?? "—"],
    ["Last heard", yearFromTimestamp(album.lastMeaningfulListenAt) ?? "—"],
    ["Full plays", album.fullPlayCount],
    ["Listening years", album.distinctListeningYears],
    ["Qualifying listens", album.qualifyingSessionCount],
  ];
  return (
    <dl className={`${styles.metaRail} ${horizontal ? styles.metaRailHorizontal : ""}`}>
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

function buildIssues(home: HomeView): IssueDefinition[] {
  const featured = home.featured;
  const recent = home.recentlyRevisited;
  const stale = home.worthAnotherListen;

  return [
    {
      template: "A",
      eyebrow: "A record across time",
      headline: "Still in the archive.",
      rule: "The record with the longest reach across your listening history.",
      body: featured ? storyFor(featured) : "A record supported by the longest span of listening evidence in the current archive.",
      moduleTitle: "Most carried forward",
      moduleNote: "Records ordered by Full Plays, then by the number of listening years they span.",
      leadAlbums: [featured, ...recent].filter((album): album is HomeAlbum => Boolean(album)).slice(0, 3),
    },
    {
      template: "B",
      eyebrow: "Back in rotation",
      headline: "Returned to, recently.",
      rule: "Records heard again most recently after appearing in more than one listening year.",
      body: recent[0] ? storyFor(recent[0]) : "A recent return supported by listening evidence across more than one year.",
      moduleTitle: "Recent returns",
      moduleNote: "A deterministic view of records that have crossed more than one listening year.",
      leadAlbums: [recent[0] ?? featured, recent[1], recent[2]].filter((album): album is HomeAlbum => Boolean(album)),
    },
    {
      template: "C",
      eyebrow: "From deeper in the archive",
      headline: "Further back on the shelf.",
      rule: "Records ordered from the oldest last-heard evidence in the current archive.",
      body: stale[0] ? storyFor(stale[0]) : "A record surfaced from the oldest last-heard evidence still represented in the archive.",
      moduleTitle: "Deep archive",
      moduleNote: "A quieter pass through records whose last meaningful listen sits further back in time.",
      leadAlbums: [stale[0] ?? featured, stale[1], stale[2]].filter((album): album is HomeAlbum => Boolean(album)),
    },
  ];
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
