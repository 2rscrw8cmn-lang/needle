# Album detail

## Purpose

Album detail is Needle's archival view for one canonical record. It answers three questions:

1. what is this record?
2. what does the listener's own history say about it?
3. what personal state has the listener explicitly attached to it?

The route is contextual rather than primary navigation:

```text
/album/:albumId
```

Library, History, Explore, and Home link by stable `canonical_album_id`.

## Runtime source

Album detail reads only the runtime D1 schema. It never reads raw Spotify export data or private `.needle/` artifacts at request time.

The primary query joins:

- `albums`;
- `listener_album_summaries`;
- `personal_album_state` by left join.

Session evidence comes from the minimized `album_sessions` table. Raw event IDs, device/IP/country fields, and source export rows never reach the product route.

## Product terminology

**Full Play** means exactly one session with runtime `evidence_status = 'full'`.

**Full Plays** is therefore backed by `listener_album_summaries.full_session_count`. It must never be implemented as a cosmetic rename of `qualifying_session_count`, because the latter includes both Full and Near-Complete sessions.

Near-Complete evidence remains visible separately.

The internal importer/data contract may continue to use terms such as `qualifying_session_count` where they are technically useful. Product UI should prefer reader-facing language and must not call the combined metric Full Plays.

## Personal state

Album detail exposes three explicit listener-owned fields:

- **Favorite**;
- **Revisit**;
- **Review**.

They are stored in `personal_album_state` and are never generated from playback history.

The existing database column `personal_album_state.notes` is intentionally retained to avoid a naming-only migration. In product language, that field is **Review / Reviews**; it must not be labeled Notes in the UI.

The personal-state table remains outside generated archive import ownership. Archive reimports must not delete or overwrite Favorite, Revisit, or Review state.

The form posts to:

```text
/album/:albumId/state
```

and upserts only the corresponding `personal_album_state` row.

## Visual hierarchy

Current functional hierarchy:

1. large artwork;
2. album title, artist, release metadata, Music Type when available;
3. personal Favorite / Revisit / Review state;
4. listener-history summary;
5. meaningful session timeline;
6. Spotify destination when enrichment provides one.

This is a functional hierarchy, not the final visual-design lock.

## Listener-history summary

The summary surfaces:

- first meaningful listen;
- last meaningful listen;
- **Full Play / Full Plays**;
- listening-year span;
- Near-Complete count;
- Sparse/Review evidence counts only when present;
- individual listening years linked back to `/library?heard=<year>`.

No preference, rating, mood, or personality score is inferred from listening history.

## Evidence language

Database statuses are translated into product language:

| Runtime status | Product language |
| --- | --- |
| `full` | Full Play |
| `near_complete` | Nearly complete listen |
| `sparse` | Brief appearance |
| `review` | Listening evidence |

The visible timeline lists only `full` and `near_complete` sessions. Sparse and Review evidence remains represented in lifetime summary counts but is not expanded into low-signal rows.

## Timeline bound

The route loads the latest **100 Full/Near-Complete** minimized session rows, ordered newest first.

The combined count may still be used internally to report how many meaningful session rows exist, but the UI must not label that combined count Full Plays.

## Catalog uncertainty

`catalog_review_status = review` is shown only as a restrained trust note because it may affect canonical/edition confidence. This catalog-review state is unrelated to the listener-authored **Review** field.

## Spotify boundary

When `albums.spotify_url` is present, Album detail exposes an outbound **Open in Spotify** link. Needle does not embed Spotify playback in V1.

## Error states

Two read states remain distinct:

- **record not found** — no current canonical album matches the route ID;
- **archive unavailable** — the D1 read failed.

A personal-state write failure returns an error rather than pretending the state was saved.

## Deferred

Later Album work may add:

- related records from the listener's own archive;
- enriched track-list presentation if it improves the archival experience;
- richer genre/Music Type context once real classification coverage is reviewed;
- final visual refinement of the personal-state editor.
