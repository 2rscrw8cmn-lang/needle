# History

## Purpose

History organizes Needle's archive around **listening years and records**, not a raw stream of track plays.

The first History surface is:

```text
/history?year=YYYY
```

It answers:

1. which archive records had qualifying listening evidence in this year?
2. which of those records were first heard in this year versus revisited from earlier history?
3. how many qualifying album-listen sessions occurred in the year?

## Runtime source

History reads only the Phase 1 runtime D1 schema:

- `albums` for canonical identity/artwork;
- `listener_album_summaries` for current archive membership and first-listen history;
- minimized `album_sessions` for year-specific Full/Near-Complete listening evidence.

It never reads raw Spotify playback exports, event IDs, device/IP/country fields, or private `.needle/` files at request time.

## Year navigation

Available years are derived from current archive-member `listening_years_json` values. They are not hard-coded.

The newest available year is the default. A valid `year=YYYY` query parameter selects another available year. Unknown or malformed values safely fall back to the newest available year.

The URL remains shareable and reloadable.

## Which albums appear

An album appears in a selected year only when all of the following are true:

```text
albums.is_current = 1
albums.archive_member = 1
listener_album_summaries.archive_member = 1
```

and the album has at least one minimized session in the selected year with:

```text
evidence_status IN ('full', 'near_complete')
```

Sparse and Review sessions do not create a History-year album entry. They remain preserved in the runtime evidence and Album summary where appropriate.

## First heard vs revisited

History uses `first_meaningful_listen_at` from the listener summary:

- **First heard** — the stored first meaningful listen occurred in the selected year;
- **Revisited** — the stored first meaningful listen predates the selected year.

This is historical evidence, not an inferred preference label.

## Year summary

The current year header reports four restrained totals:

- albums with qualifying evidence;
- first-heard albums;
- revisited albums;
- qualifying Full/Near-Complete sessions within the year.

These totals support the cover wall rather than becoming a dashboard.

## Album wall

The year wall remains artwork-first. Each entry shows:

- artwork;
- First heard / Revisited state;
- qualifying-listen count within the selected year;
- album title;
- artist.

Each record links to its stable `/album/:albumId` route.

The current cached preview has 0% artwork enrichment, so the same fallback artwork primitive is expected until 1.05 enrichment populates `artwork_url`.

## Sorting

The initial year wall orders records by:

1. qualifying session count within the selected year, descending;
2. artist A–Z;
3. album A–Z;
4. canonical ID as a deterministic tie breaker.

This makes repeated records surface naturally without inventing a score.

## Deferred

Later History work may add:

- Music Type/Genre composition after real taxonomy coverage exists;
- cross-year record spans;
- defined listening eras where the data supports an explainable rule;
- restrained charts where they add information beyond the cover wall;
- deeper year-to-year comparison.

No mood, personality, taste score, or rating should be inferred from playback history.
