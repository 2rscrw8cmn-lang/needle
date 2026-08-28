"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  LIBRARY_SORTS,
  LIBRARY_SORT_LABELS,
  type LibraryFacets,
  type NormalizedLibraryQuery,
} from "../../lib/library/library";
import styles from "./library.module.css";

interface LibraryControlsProps {
  query: NormalizedLibraryQuery;
  facets: LibraryFacets;
  hasCustomView: boolean;
  shownCount: number;
}

export function LibraryControls({
  query,
  facets,
  hasCustomView,
  shownCount,
}: LibraryControlsProps) {
  const router = useRouter();

  function updateView(name: "sort" | "decade" | "heard", value: string) {
    const params = new URLSearchParams();

    if (query.search) params.set("q", query.search);
    if (query.sort !== "artist") params.set("sort", query.sort);
    if (query.decade !== null) params.set("decade", String(query.decade));
    if (query.listeningYear !== null) params.set("heard", String(query.listeningYear));

    if (value) params.set(name, value);
    else params.delete(name);

    if (name === "sort" && value === "artist") params.delete("sort");

    const next = params.toString();
    router.replace(next ? `/library?${next}` : "/library", { scroll: false });
  }

  return (
    <section className={styles.libraryControls} aria-label="Library view controls">
      <div className={styles.controlSummary}>
        <span>Archive index</span>
        <strong>{shownCount.toLocaleString()} shown</strong>
      </div>

      <label className={styles.controlField}>
        <span>Order</span>
        <select
          aria-label="Order Library"
          value={query.sort}
          onChange={(event) => updateView("sort", event.target.value)}
        >
          {LIBRARY_SORTS.map((sort) => (
            <option key={sort} value={sort}>{LIBRARY_SORT_LABELS[sort]}</option>
          ))}
        </select>
      </label>

      <label className={styles.controlField}>
        <span>Release</span>
        <select
          aria-label="Filter by release decade"
          value={query.decade ?? ""}
          onChange={(event) => updateView("decade", event.target.value)}
        >
          <option value="">All decades</option>
          {facets.decades.map((decade) => (
            <option key={decade} value={decade}>{decade}s</option>
          ))}
        </select>
      </label>

      <label className={styles.controlField}>
        <span>Listened</span>
        <select
          aria-label="Filter by listening year"
          value={query.listeningYear ?? ""}
          onChange={(event) => updateView("heard", event.target.value)}
        >
          <option value="">All years</option>
          {facets.listeningYears.map((year) => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
      </label>

      <div className={styles.controlReset}>
        {hasCustomView ? <Link href="/library">Reset view</Link> : <span>Full archive</span>}
      </div>
    </section>
  );
}
