"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

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
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      setQuery("");
      setResults([]);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

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

  return (
    <div className="global-search" data-open={open ? "true" : "false"}>
      <button
        className="global-search__trigger"
        type="button"
        aria-expanded={open}
        aria-controls="global-search-panel"
        onClick={() => setOpen((value) => !value)}
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
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Album or artist"
              autoComplete="off"
            />
            <button type="button" onClick={() => setOpen(false)} aria-label="Close archive search">Close</button>
          </div>
          <p className="global-search__status" aria-live="polite">{status}</p>
          {results.length > 0 ? (
            <div className="global-search__results">
              {results.map((album) => (
                <Link
                  href={`/album/${encodeURIComponent(album.canonicalAlbumId)}`}
                  className="global-search__result"
                  key={album.canonicalAlbumId}
                  onClick={() => setOpen(false)}
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
