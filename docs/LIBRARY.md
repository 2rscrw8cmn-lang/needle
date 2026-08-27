# Library

## Purpose

Needle's Library is the fast, artwork-first working collection. It reads the approved Phase 1 runtime schema from D1 and never reads raw Spotify export files or generated `.needle/` artifacts at runtime.

## Membership query

The Library query lives in `lib/library/library.ts`.

A record is eligible only when:

```text
albums.is_current = 1
albums.archive_member = 1
listener_album_summaries.archive_member = 1
```

This preserves D-009 at the product boundary: the default Library contains albums with at least one Full or Near-Complete qualifying session.

Sparse-only and unresolved review evidence may remain in importer/audit data but does not appear in the default cover wall or search results.

## Current row contract

The query returns enough data for the artwork wall and later Library controls without exposing database column naming directly to components:

- stable canonical album ID;
- album title;
- primary artist name;
- original release date / parsed release year;
- provider artwork URL;
- Music Type when available;
- first/last meaningful listen timestamps;
- qualifying session count.

The cover wall currently displays only artwork, album title, and artist. Other fields are intentionally retained in the UI row contract for later sorting/filtering/history-aware work rather than adding visible metadata everywhere now.

## Search

Issue 2.04 adds search through the shareable URL parameter:

```text
/library?q=<query>
```

Search checks:

- album title;
- primary artist name.

Matching is case-insensitive substring matching inside the current D-009 Library only. Search never widens the result set to sparse, review-only, or inactive albums.

User input is passed to D1 through bound parameters. `%`, `_`, and backslash are escaped before building the `LIKE` pattern so those characters remain literal user input rather than SQL wildcard syntax.

Search is intentionally simple in V1 at this stage:

- no fuzzy matching;
- no semantic/vector search;
- no autocomplete;
- no external search service;
- no Genre/Music Type text search yet.

A copied/reloaded `/library?q=...` URL recreates the same search state without client-side state storage.

## Empty states

Three states remain distinct:

1. **empty archive** — D1 has no current D-009 Library members;
2. **no search matches** — the archive has records, but the current `q` does not match album/artist;
3. **archive unavailable** — the D1 read failed.

Needle never fills any of these states with fake sample albums.

## Temporary default order

Until 2.05 adds explicit user-selectable sorting, the cover wall and search results use a deterministic collection-style order:

1. primary artist name, case-insensitive;
2. album title, case-insensitive;
3. canonical album ID as a stable final tie-breaker.

This is not intended to limit the eventual sort options.

## Layout

The wall is systematic but not card-based:

- large desktop: 7 columns;
- medium desktop: 6 or 5 columns;
- tablet: 4 columns;
- phone: 2 columns.

There are no card backgrounds, permanent badges, stats, or controls around each cover. Album title and artist sit quietly below the artwork.

`AlbumArtwork` from 2.02 owns image geometry/fallback behavior; the Library owns only grid placement and visible identity text.

## Runtime behavior

`/library` is force-dynamic because it reads Cloudflare D1 at request time. Loading the approved Phase 1 `archive-import.sql` therefore makes real records appear without rebuilding or changing the route.

The existing Cloudflare `env.DB` binding is the source of truth.

## Deferred to later Library issues

The current Library still defers:

- filters;
- user-selected sorting;
- Album detail navigation/implementation;
- Favorite/Revisit controls;
- listening-history timeline;
- Open in Spotify.

Those features should consume the same canonical IDs and D1 runtime contract rather than creating parallel collection data sources.
