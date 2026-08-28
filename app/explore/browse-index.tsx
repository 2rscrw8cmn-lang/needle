"use client";

import Link from "next/link";
import { useState } from "react";

import type { ExploreArtist, ExploreDecade } from "../../lib/explore/explore";
import styles from "./explore.module.css";

type BrowseMode = "artists" | "decades" | "years";

interface BrowseIndexProps {
  artists: ExploreArtist[];
  decades: ExploreDecade[];
  listeningYears: number[];
}

const BROWSE_MODES: Array<{ id: BrowseMode; label: string }> = [
  { id: "artists", label: "Artists" },
  { id: "decades", label: "Decades" },
  { id: "years", label: "Listening years" },
];

export function BrowseIndex({ artists, decades, listeningYears }: BrowseIndexProps) {
  const [mode, setMode] = useState<BrowseMode>("artists");

  return (
    <section className={styles.browseSection} aria-labelledby="browse-title">
      <div className={styles.browseHeading}>
        <div>
          <p className={styles.sectionEyebrow}>Browse the archive by</p>
          <h2 id="browse-title">Find another way in.</h2>
        </div>
        <div className={styles.browseTabs} role="tablist" aria-label="Browse archive by">
          {BROWSE_MODES.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={mode === item.id}
              className={styles.browseTab}
              onClick={() => setMode(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.browsePanel} role="tabpanel">
        {mode === "artists" ? (
          <div className={styles.artistIndex}>
            {artists.map((artist) => (
              <Link key={artist.artistId} href={`/explore?q=${encodeURIComponent(artist.name)}#archive`}>
                <span>{artist.name}</span>
                <small>{artist.albumCount.toLocaleString()}</small>
              </Link>
            ))}
          </div>
        ) : null}

        {mode === "decades" ? (
          <div className={styles.decadeIndex}>
            {decades.map((item) => (
              <Link key={item.decade} href={`/explore?decade=${item.decade}#archive`}>
                <strong>{item.decade}s</strong>
                <span>{item.albumCount.toLocaleString()} {item.albumCount === 1 ? "record" : "records"}</span>
              </Link>
            ))}
          </div>
        ) : null}

        {mode === "years" ? (
          <div className={styles.yearIndex}>
            {listeningYears.map((year) => (
              <Link key={year} href={`/explore?heard=${year}#archive`}>
                <strong>{year}</strong>
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
