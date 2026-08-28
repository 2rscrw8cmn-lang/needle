"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";

interface SearchResult {
  canonicalAlbumId: string;
  title: string;
  artistName: string;
  artworkUrl: string | null;
  releaseYear: number | null;
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [status, setStatus] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultRefs = useRef<Array<HTMLAnchorElement | null>>([]);

  const closeSearch = useCallback((restoreFocus = true) => {
    setOpen(false);
    setQuery("");
    setResults([]);
    setStatus("");
    setActiveIndex(-1);
    resultRefs.current = [];
    if (restoreFocus) window.requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      closeSearch();
    }

    function onPointerDown(event: globalThis.PointerEvent) {
      if (rootRef.current?.contains(event.target as Node)) return;
      closeSearch();
    }

    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [closeSearch, open]);

  useEffect(() => {
    const normalized = query.trim();
    if (normalized.length < 2) {
      setResults([]);
      setStatus(normalized ? "Type one more character." : "");
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setStatus("Searching archive…");
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(normalized)}`, {
          signal: controller.signal,
        });
        const payload = await response.json() as { results?: SearchResult[]; error?: string };
        const next = payload.results ?? [];
        setResults(next);
        setActiveIndex(-1);
        setStatus(payload.error ?? (next.length === 0 ? "No records found." : `${next.length} results`));
      } catch (error) {
        if ((error as Error).name !== "AbortError") setStatus("Archive search unavailable.");
      }
    }, 140);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    if (activeIndex < 0) return;
    resultRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  function moveActive(direction: 1 | -1, focusResult: boolean) {
    if (results.length === 0) return;
    setActiveIndex((current) => {
      const next = current < 0
        ? (direction === 1 ? 0 : results.length - 1)
        : (current + direction + results.length) % results.length;
      if (focusResult) window.requestAnimationFrame(() => resultRefs.current[next]?.focus());
      return next;
    });
  }

  function handleSearchKeys(event: ReactKeyboardEvent<HTMLInputElement | HTMLAnchorElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      moveActive(event.key === "ArrowDown" ? 1 : -1, event.currentTarget !== inputRef.current);
      return;
    }
    if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      resultRefs.current[activeIndex]?.click();
    }
  }

  return (
    <div ref={rootRef} className="global-search" data-open={open ? "true" : "false"}>
      <button
        ref={triggerRef}
        className="global-search__trigger"
        type="button"
        aria-expanded={open}
        aria-controls="global-search-panel"
        onClick={() => open ? closeSearch() : setOpen(true)}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" focusable="false">
          <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="m16 16 4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
        </svg>
        <span>Search the archive</span>
      </button>

      {open ? (
        <div className="global-search__panel" id="global-search-panel">
          <div className="global-search__field">
            <label htmlFor="global-search-input">Search album or artist</label>
            <input
              ref={inputRef}
              id="global-search-input"
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveIndex(-1);
              }}
              onKeyDown={handleSearchKeys}
              placeholder="Album or artist"
              autoComplete="off"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={results.length > 0}
              aria-controls="global-search-results"
              aria-activedescendant={activeIndex >= 0 ? `global-search-result-${activeIndex}` : undefined}
            />
            <button type="button" onClick={() => closeSearch()} aria-label="Close archive search">Close</button>
          </div>
          <p className="global-search__status" aria-live="polite">{status}</p>
          {results.length > 0 ? (
            <div className="global-search__results" id="global-search-results" role="listbox">
              {results.map((album, index) => (
                <Link
                  ref={(node) => { resultRefs.current[index] = node; }}
                  id={`global-search-result-${index}`}
                  href={`/album/${encodeURIComponent(album.canonicalAlbumId)}`}
                  className="global-search__result"
                  key={album.canonicalAlbumId}
                  role="option"
                  aria-selected={index === activeIndex}
                  data-active={index === activeIndex ? "true" : "false"}
                  onFocus={() => setActiveIndex(index)}
                  onMouseEnter={() => setActiveIndex(index)}
                  onKeyDown={handleSearchKeys}
                  onClick={() => closeSearch()}
                >
                  <span className="global-search__art" aria-hidden="true">
                    {album.artworkUrl ? <img src={album.artworkUrl} alt="" /> : null}
                  </span>
                  <span className="global-search__identity">
                    <strong>{album.title}</strong>
                    <span>{album.artistName}{album.releaseYear ? ` · ${album.releaseYear}` : ""}</span>
                  </span>
                  <span aria-hidden="true">→</span>
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
