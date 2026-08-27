# Album detail

## Purpose

Album detail is Needle's archival view for one canonical record. It answers two questions before anything else:

1. what is this record?
2. what does the listener's own history say about it?

The route is contextual rather than primary navigation:

```text
/album/:albumId
```

Library tiles link by stable `canonical_album_id`.

## Runtime source

Album detail reads only the Phase 1 runtime D1 schema. It never reads raw Spotify export data or private `.needle/` artifacts at request time.

The primary query joins:

- `albums`;
- `listener_album_summaries`.

The route renders only a current canonical album (`albums.is_current = 1`). The route ID is always a bound D1 parameter.

Session evidence comes from the minimized `album_sessions` table. Raw event IDs, device/IP/country fields, and source export rows never reach the product route.

## Visual hierarchy

The page follows the Information Architecture order:

1. large artwork;
2. album title, artist, release metadata, Music Type when available;
3. listener-history summary;
4. session/evidence timeline;
5. Spotify destination when enrichment provides one.

Personal Favorite/Revisit/notes and related-record modules remain deferred.

The current cached preview has 0% artwork, Spotify enrichment, and Music Type coverage. The detail page therefore treats those fields as optional and stays useful through identity and history evidence alone.

## Listener-history summary

The summary surfaces explainable stored evidence:

- first meaningful listen;
- last meaningful listen;
- qualifying Full/Near-Complete session count;
- listening-year span;
- Full count;
- Near-Complete count;
- Sparse/Review counts only when present;
- individual listening years, linked back to `/library?heard=<year>`.

No preference, rating, mood, or personality score is inferred.

## Evidence language

Database statuses are translated into reader-facing language:

| Runtime status | Product language |
| --- | --- |
| `full` | Front-to-back listen |
| `near_complete` | Nearly complete listen |
| `sparse` | Brief appearance |
| `review` | Listening evidence |

A timeline row may include credible track count and approximate session duration as context. It does not expose raw event detail or technical coverage rules.

## Timeline bound

The route loads the latest **100** minimized session rows, ordered newest first.

The listener summary remains the source for total counts, so the UI can say `Latest 100 of 245` without fetching hundreds of rows merely to render one page. The limit is a presentation/performance boundary; it does not alter Phase 1 evidence or counts.

## Catalog uncertainty

`catalog_review_status = review` is shown only as a restrained trust note because it may affect canonical/edition confidence. Missing release metadata does not block the page.

## Spotify boundary

When `albums.spotify_url` is present, Album detail exposes an outbound **Open in Spotify** link. Needle does not embed Spotify playback in V1.

## Error states

Two states remain distinct:

- **record not found** — no current canonical album matches the route ID;
- **archive unavailable** — the D1 read failed.

Both return the user to Library without substituting fake content.

## Deferred

Later Album work may add:

- Favorite/Revisit/notes editing against `personal_album_state`;
- related records from the listener's own archive;
- enriched track-list presentation if it improves the archival experience;
- richer genre/Music Type context once real classification coverage is reviewed.
