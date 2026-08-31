"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import {
  LIBRARY_SORTS,
  LIBRARY_SORT_LABELS,
  type LibraryFacets,
  type NormalizedLibraryQuery,
} from "../../lib/library/library";
import styles from "./explore.module.css";

interface ExploreControlsProps {
  query: NormalizedLibraryQuery;
  facets: LibraryFacets;
  hasCustomView: boolean;
}

interface Option {
  value: string;
  label: string;
}

export function ExploreControls({ query, facets, hasCustomView }: ExploreControlsProps) {
  const router = useRouter();
  const controlsRef = useRef<HTMLDivElement>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  useEffect(() => {
    if (!openMenu) return;

    function onPointerDown(event: PointerEvent) {
      if (!controlsRef.current?.contains(event.target as Node)) setOpenMenu(null);
    }

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [openMenu]);

  function updateView(name: "sort" | "decade" | "heard", value: string) {
    const params = new URLSearchParams();
    if (query.search) params.set("q", query.search);
    if (query.sort !== "artist") params.set("sort", query.sort);
    if (query.decade !== null) params.set("decade", String(query.decade));
    if (query.listeningYear !== null) params.set("heard", String(query.listeningYear));

    if (value) params.set(name, value);
    else params.delete(name);
    if (name === "sort" && value === "artist") params.delete("sort");

    setOpenMenu(null);
    const next = params.toString();
    router.replace(next ? `/explore?${next}` : "/explore", { scroll: false });
  }

  const sortOptions: Option[] = LIBRARY_SORTS.map((sort) => ({
    value: sort,
    label: LIBRARY_SORT_LABELS[sort],
  }));
  const decadeOptions: Option[] = [
    { value: "", label: "All" },
    ...facets.decades.map((decade) => ({ value: String(decade), label: `${decade}s` })),
  ];
  const heardOptions: Option[] = [
    { value: "", label: "All" },
    ...facets.listeningYears.map((year) => ({ value: String(year), label: String(year) })),
  ];

  return (
    <div className={styles.archiveControls} ref={controlsRef} aria-label="Archive view controls">
      <ArchiveSelect
        id="archive-order"
        label="Order"
        value={query.sort}
        options={sortOptions}
        open={openMenu === "order"}
        onToggle={() => setOpenMenu((current) => current === "order" ? null : "order")}
        onClose={() => setOpenMenu(null)}
        onChange={(value) => updateView("sort", value)}
      />
      <ArchiveSelect
        id="archive-release"
        label="Release"
        value={query.decade === null ? "" : String(query.decade)}
        options={decadeOptions}
        open={openMenu === "release"}
        onToggle={() => setOpenMenu((current) => current === "release" ? null : "release")}
        onClose={() => setOpenMenu(null)}
        onChange={(value) => updateView("decade", value)}
      />
      <ArchiveSelect
        id="archive-heard"
        label="Heard"
        value={query.listeningYear === null ? "" : String(query.listeningYear)}
        options={heardOptions}
        open={openMenu === "heard"}
        onToggle={() => setOpenMenu((current) => current === "heard" ? null : "heard")}
        onClose={() => setOpenMenu(null)}
        onChange={(value) => updateView("heard", value)}
      />
      <div className={styles.archiveReset}>
        {hasCustomView ? <Link href="/explore">Reset view</Link> : <span>All records</span>}
      </div>
    </div>
  );
}

function ArchiveSelect({
  id,
  label,
  value,
  options,
  open,
  onToggle,
  onClose,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: Option[];
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onChange: (value: string) => void;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const [activeIndex, setActiveIndex] = useState(selectedIndex);

  useEffect(() => {
    if (open) setActiveIndex(selectedIndex);
  }, [open, selectedIndex]);

  const selected = options[selectedIndex] ?? options[0];

  function choose(index: number) {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" && open) {
      event.preventDefault();
      onClose();
      triggerRef.current?.focus();
      return;
    }

    if (!open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      event.preventDefault();
      setActiveIndex(event.key === "ArrowDown" ? selectedIndex : Math.max(0, selectedIndex));
      onToggle();
      return;
    }

    if (!open) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(options.length - 1, index + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(0, index - 1));
    } else if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(options.length - 1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      choose(activeIndex);
    } else if (event.key === "Tab") {
      onClose();
    }
  }

  return (
    <div className={styles.archiveSelect} onKeyDown={onKeyDown}>
      <span className={styles.archiveSelectLabel}>{label}</span>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className={styles.archiveSelectTrigger}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={`${id}-menu`}
        onClick={onToggle}
      >
        <span>{selected?.label}</span>
        <span aria-hidden="true">{open ? "↑" : "↓"}</span>
      </button>
      {open ? (
        <div className={styles.archiveMenu} id={`${id}-menu`} role="menu" aria-labelledby={id}>
          {options.map((option, index) => (
            <button
              key={`${id}-${option.value || "all"}`}
              type="button"
              role="menuitemradio"
              aria-checked={option.value === value}
              data-active={activeIndex === index ? "true" : "false"}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => choose(index)}
            >
              <span>{option.label}</span>
              <span aria-hidden="true">{option.value === value ? "✓" : ""}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ArchiveControlNote({ children }: { children: ReactNode }) {
  return <span className={styles.archiveControlNote}>{children}</span>;
}
