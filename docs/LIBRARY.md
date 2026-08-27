# Library

## Purpose

Needle's Library is the fast, artwork-first working collection. It reads the approved runtime schema from D1 and never reads raw Spotify export files or generated `.needle/` artifacts at runtime.

## Membership query

The Library query lives in `lib/library/library.ts`.

A record is eligible only when:

```text
albums.is_current = 1
albums.archive_member = 1
listener_album_summaries.archive_member = 1
```

This preserves D-009 at the product boundary: the default Library contains albums with at least one Full or Near-Complete listening session. Sparse-only and unresolved review evidence may remain in importer/audit data but does not appear in the default cover wall, search results, filters, or sort views.

## Current row contract

The Library query maps D1 rows into a product-facing album object containing:

- stable canonical album ID;
- album title;
- primary artist name;
- original release date / parsed release year;
- provider artwork URL;
- Music Type when available;
- first/last meaningful listen timestamps;
- internal combined Full/Near-Complete session count;
- actual listening years.

The cover wall displays only artwork, album title, and artist. History fields support collection controls without turning each tile into a statistics card.

Every visible Library tile links to `/album/:canonicalAlbumId`, where the same canonical record expands into Album detail.

## Product terminology

The internal combined Full/Near-Complete count remains useful for membership and the **Most revisited** sort. It is not presented as **Full Plays**.

In visible product language:

- **Full Play / Full Plays** means Full sessions only;
- Near-Complete evidence remains separate;
- listener-authored text is **Review / Reviews**, never Notes.

## URL state

Library views are server-rendered and shareable. Supported query parameters are:

```text
/library?q=<search>&sort=<sort>&decade=<YYYY>&heard=<YYYY>
```

Invalid values are ignored or normalized to the safe default rather than interpolated into SQL.

### Search — `q`

Search checks album title and primary artist name using case-insensitive substring matching. `%`, `_`, and backslash are escaped so they remain literal input. Search values are bound D1 parameters.

### Sort — `sort`

Sort is a fixed whitelist, never arbitrary SQL:

- `artist` — Artist A–Z; default;
- `album` — Album A–Z;
- `release` — release year, newest first, unknown dates last;
- `recent` — most recently meaningfully listened first;
- `first` — earliest first meaningful listen first;
- `revisited` — combined Full/Near-Complete session count first, then listening-year span and recency.

Every sort includes stable artist/title/canonical-ID tie breakers.

`revisited` is listening-history evidence, not an inferred rating or preference score.

### Why there is no Revisited checkbox

Phase 1.03 only promotes a provisional album after it has at least two Full/Near-Complete qualifying sessions. Phase 1.07 defines `repeat_qualifying_sessions` as that same `qualifying_session_count >= 2` threshold. Therefore the binary repeat flag does not discriminate among the current canonical Library candidates and is not useful as a filter.

The **Most revisited** sort remains useful because it ranks albums by the actual combined session count, then by the number of listening years and recency. It is intentionally different from the listener-owned **Revisit** state on Album detail.

### Release decade — `decade`

The release-decade filter uses the album's known original release year. Available decades are derived from current D1 Library rows rather than hard-coded catalog values.

An album with no known release date does not match a decade filter.

### Listening year — `heard`

Listening-year filtering uses `listener_album_summaries.listening_years_json` and SQLite `json_each`. It answers “which Library albums did I meaningfully listen to in this year?” and is intentionally independent of release year.

Available listening years are derived from current D1 evidence.

## Query composition and SQL safety

Search, decade, and listening-year filters compose in one D1 query. Search patterns and numeric filter values are bound parameters. Only the accepted sort identifier selects a pre-authored ORDER BY clause.

No filter can widen results outside current D-009 membership.

## Personal state

Favorite, Revisit, and Review are listener-owned fields stored in `personal_album_state` and edited on Album detail. They are outside generated archive-import ownership and survive reimports.

The storage column for Review remains `personal_album_state.notes` as an implementation detail; product UI calls it **Review**.

Library filtering by Favorite/Revisit may be added later if it proves useful, but those states already exist and persist.

## Music Type and Genre boundary

Music Type and Genre controls remain absent until real 1.05/1.06 classification coverage is available and reviewed. The UI must not imply taxonomy evidence that does not exist.

## Empty states

Three states remain distinct:

1. **empty archive** — D1 has no current D-009 Library members;
2. **no matches** — the archive has records, but the current search/filter combination returns none;
3. **archive unavailable** — the D1 read failed.

Needle never fills any state with fake sample albums.

## Layout

The collection control area stays thin and editorial rather than becoming a filter drawer or dashboard. The artwork wall remains the primary visual object:

- large desktop: 7 columns;
- medium desktop: 6 or 5 columns;
- tablet: 4 columns;
- phone: 2 columns.

There are no card backgrounds, permanent badges, stats, or controls around each cover. Album title and artist sit quietly below the artwork.

`AlbumArtwork` owns image geometry/fallback behavior; the Library owns grid placement and visible identity text.

## Runtime behavior

`/library` is force-dynamic because it reads Cloudflare D1 at request time. Loading either the approved final archive or the explicitly local-only cached preview therefore updates the collection without rebuilding the page.

The existing Cloudflare `env.DB` binding is the runtime source of truth.

## Deferred

The current product still defers:

- Music Type / Genre filters pending real enrichment coverage;
- related-record modules;
- richer Spotify/enrichment presentation beyond the outbound Album-detail destination;
- final visual-polish pass.

Those features should consume the same canonical IDs and D1 runtime contract rather than creating parallel collection data sources.
