# Library Cover Wall

## Purpose

Issue 2.03 is Needle's first real product collection surface. It reads the approved Phase 1 runtime schema from D1 and presents the default Library as an artwork-first wall.

The page does not read raw Spotify export files or generated `.needle/` artifacts at runtime.

## Membership query

The Library query lives in `lib/library/library.ts`.

A record is eligible only when:

```text
albums.is_current = 1
albums.archive_member = 1
listener_album_summaries.archive_member = 1
```

This preserves D-009 at the product boundary: the default Library contains albums with at least one Full or Near-Complete qualifying session.

Sparse-only and unresolved review evidence may remain in importer/audit data but does not appear in the default cover wall.

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

2.03 displays only artwork, album title, and artist. The other fields are intentionally retained in the UI row contract for later sorting/filtering/history-aware work rather than adding visible metadata everywhere now.

## Temporary default order

Until 2.05 adds explicit user-selectable sorting, the cover wall uses a deterministic collection-style order:

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

## Empty and unavailable states

An empty D1 archive does not trigger fake sample records. The page explains that the archive is empty and waits for reconciled Library members.

A D1 read failure is presented separately from an empty archive so infrastructure failures are not mistaken for a listener with no records.

## Runtime behavior

`/library` is force-dynamic because it reads Cloudflare D1 at request time. Loading the approved Phase 1 `archive-import.sql` therefore makes real records appear without rebuilding or changing the route.

The existing Cloudflare `env.DB` binding is the source of truth.

## Deferred to later Library issues

2.03 does not add:

- search;
- filters;
- user-selected sorting;
- Album detail navigation/implementation;
- Favorite/Revisit controls;
- listening-history timeline;
- Open in Spotify.

Those features should consume the same canonical IDs and D1 runtime contract rather than creating parallel collection data sources.
