# Phase 1 Archive Reconciliation

## Purpose

Issue 1.07 is the Phase 1 exit layer. It turns the private import artifacts from 1.03–1.06 into the stable album/history records Needle's product surfaces can query and proves the cross-stage dataset reconciles structurally.

The private Spotify export remains an importer input only. Phase 2+ runtime code reads Cloudflare D1, not the raw export or normalized playback-event files.

## Command

After 1.04, 1.05, and 1.06 have completed successfully:

```bash
npm run history:reconcile
```

Default input/output directory:

```text
data/history/.needle/
```

The command requires these completed artifacts:

- `sessionization-report.json`
- `album-sessions.json`
- `canonical-albums.json`
- `spotify-album-editions.json`
- `album-resolution-links.json`
- `album-resolution-report.json`
- `spotify-album-enrichment.json`
- `spotify-artist-enrichment.json`
- `spotify-track-enrichment.json`
- `spotify-enrichment-report.json`
- `album-music-type-classifications.json`
- `genre-catalog.json`
- `music-type-taxonomy-report.json`

## Outputs

1.07 writes private generated artifacts to the ignored `.needle/` directory:

```text
listener-album-summaries.json
runtime-archive.json
archive-reconciliation-report.json
archive-reconciliation-report.md
archive-import.sql
```

`runtime-archive.json` is a deterministic, privacy-minimized representation of the data intended for product/runtime persistence. `archive-import.sql` loads that representation into the D1 schema created by `migrations/0001_archive.sql`.

## Listener summary contract

One `ListenerAlbumSummary` is emitted for each canonical album.

### First / last meaningful listen

"Meaningful" at this layer means a **Full or Near-Complete qualifying album session**. Sparse or Review sessions are retained in counts but do not establish first/last meaningful listening dates.

### D-009 archive membership

The rule is deliberately simple and exact:

```text
archive_member = full_session_count + near_complete_session_count > 0
```

No Spotify artwork, genre, catalog confidence, release date, or Music Type field can promote or demote an album from the default Library. Those are separate dimensions of metadata confidence/coverage.

### Revisit inputs

1.07 stores observable inputs rather than editorial conclusions:

- qualifying session count;
- distinct listening months;
- distinct listening years;
- first/last meaningful dates;
- evidence span in days;
- whether qualifying evidence repeats;
- whether evidence spans multiple months/years or at least one year.

Later Home/History features may turn those facts into restrained editorial modules. 1.07 does not infer mood, importance, or personality.

## Canonical collapse

Sessions are produced by 1.03 against provisional `source_album_key` identities. 1.04 may map multiple source titles/editions onto one canonical album. 1.07 uses `album-resolution-links.json` to aggregate those source sessions into one canonical listener summary.

Sessions whose source identity still has no canonical album remain in the private audit artifacts. They are counted in the reconciliation report but are not copied into runtime D1 tables until identity is resolved.

## Runtime privacy boundary

The runtime archive intentionally excludes:

- raw Spotify playback rows;
- raw/normalized playback events;
- event IDs from album sessions;
- IP addresses;
- device/platform details;
- country;
- offline/incognito fields;
- raw source file/row references.

Runtime album sessions retain only the album-level evidence required for product history:

- stable session ID;
- canonical album ID;
- start/end timestamps;
- duration;
- Full/Near/Sparse/Review status;
- minimized coverage counts.

## D1 schema

`migrations/0001_archive.sql` establishes the Phase 1 runtime tables:

- `import_batches`
- `artists`
- `albums`
- `album_editions`
- `tracks`
- `album_sessions`
- `listener_album_summaries`
- `genres`
- `album_genres`
- `personal_album_state`

The schema is intentionally product-oriented. Raw playback events remain private importer material rather than becoming runtime application rows.

## Loading D1

Apply migrations first:

```bash
npm run db:migrate:local
```

Then load the generated archive:

```bash
npm run db:load-archive:local
```

For the remote D1 database, review the reconciliation report before running:

```bash
npm run db:migrate:remote
npm run db:load-archive:remote
```

Do not load a partial 1.04/1.05 run into remote D1.

## Reimport and PersonalAlbumState

Imported/derived data and personal app state have different lifecycles.

`archive-import.sql`:

- replaces current derived editions, tracks, sessions, summaries, and genre links;
- upserts current artists/albums;
- marks albums/artists absent from the new import as inactive rather than deleting them;
- **never deletes or overwrites `personal_album_state`**.

Keeping old album identity rows inactive allows favorite/revisit/notes state to survive even if an album temporarily disappears from a later import. If the same canonical ID returns, its prior personal state reconnects automatically.

## Workbook reconciliation

The prior workbook remains a calibration reference, not a target.

Workbook-derived default Library expectation:

- 243 confirmed complete at least twice;
- 23 confirmed complete once;
- 71 near-complete;
- **337 default Library members** under D-009.

1.07 reports the actual canonical Library count and delta from 337. A non-zero delta does not automatically fail reconciliation. It must remain visible and be explained from encoded session rules, catalog review, or canonical edition collapse before the real Phase 1 exit is accepted.

## Coverage is not identity

The final report separately measures:

- source-album catalog resolution;
- Spotify enrichment coverage;
- artwork coverage;
- Music Type classification coverage.

Missing Spotify metadata or genre coverage does not destroy valid listening evidence or canonical history. Coverage gaps are explicit product/data debt.

## Phase 2 handoff

After the real 1.07 reconciliation passes and the generated archive is loaded into D1, Phase 2 can begin against real data.

The sanitized `fixtures/archive/phase1-runtime-reference.json` snapshot exists so Library/History code can be developed and tested without using the private listening archive.
