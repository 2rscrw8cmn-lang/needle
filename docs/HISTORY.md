# History

## Purpose

History organizes Needle's archive around **listening years and records**, not a raw stream of track plays.

The current surface is:

```text
/history?year=YYYY
```

It answers:

1. which archive records had meaningful Full/Near-Complete listening evidence in this year?
2. which were first heard in this year versus revisited from earlier history?
3. how many true **Full Plays** occurred in the year?

## Runtime source

History reads only the runtime D1 schema:

- `albums` for canonical identity/artwork;
- `listener_album_summaries` for current archive membership and first-listen history;
- minimized `album_sessions` for year-specific Full/Near-Complete listening evidence.

It never reads raw Spotify playback exports, event IDs, device/IP/country fields, or private `.needle/` files at request time.

## Year navigation

Available years are derived from current archive-member `listening_years_json` values. They are not hard-coded.

The newest available year is the default. A valid `year=YYYY` query parameter selects another available year. Unknown or malformed values safely fall back to the newest available year.

## Which albums appear

An album appears in a selected year only when it is a current archive member and has at least one minimized session in the year with:

```text
evidence_status IN ('full', 'near_complete')
```

Sparse and Review sessions do not create a History-year album entry.

## Full Plays vs Near-Complete

The product term **Full Play / Full Plays** maps only to:

```text
evidence_status = 'full'
```

History separately counts Near-Complete sessions. The year wall may show both when useful, but it must not call the combined Full + Near-Complete count Full Plays.

Internally, the combined Full/Near-Complete count is retained as `year_meaningful_session_count` for ordering and membership logic.

## First heard vs revisited

History uses `first_meaningful_listen_at`:

- **First heard** — stored first meaningful listen occurred in the selected year;
- **Revisited** — stored first meaningful listen predates the selected year.

This is historical evidence, not an inferred preference label.

## Year summary

The year header reports:

- albums with meaningful album evidence;
- first-heard albums;
- revisited albums;
- **Full Play / Full Plays** within the selected year.

These totals support the cover wall rather than becoming a dashboard.

## Album wall

Each entry shows:

- artwork;
- First heard / Revisited state;
- Full Plays and Near-Complete evidence for the selected year when present;
- album title;
- artist.

Each record links to `/album/:albumId`.

## Sorting

The initial wall orders records by:

1. combined Full/Near-Complete session count within the year, descending;
2. Full Play count, descending;
3. artist A–Z;
4. album A–Z;
5. canonical ID.

The combined count is useful for ordering but is not surfaced under the Full Plays label.

## Deferred

Later History work may add:

- Music Type/Genre composition after real taxonomy coverage exists;
- cross-year record spans;
- defined listening eras where the data supports an explainable rule;
- restrained charts where they add information beyond the cover wall;
- deeper year-to-year comparison.

No mood, personality, taste score, or rating should be inferred from playback history.
