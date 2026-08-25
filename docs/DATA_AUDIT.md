# Data Audit

## Purpose

This document records what Needle's source material actually contains before application code is built around it.

Sources reviewed:

- Spotify extended streaming-history JSON files spanning 2011 through 2026, with split files in several years;
- `spotify_album_history_analysis.xlsx`, the prior album/session analysis workbook.

The real source files are private ingestion material and belong locally under `data/history/`. They are not application assets and are not tracked in Git.

## Raw Spotify event shape

Observed audio-history records include fields such as:

- `ts`
- `platform`
- `ms_played`
- `conn_country`
- `ip_addr`
- `master_metadata_track_name`
- `master_metadata_album_artist_name`
- `master_metadata_album_album_name`
- `spotify_track_uri`
- podcast/episode and audiobook fields
- `reason_start` / `reason_end`
- `shuffle`
- `skipped`
- `offline`
- `offline_timestamp`
- `incognito_mode`

### Consequence

The source export contains personal operational metadata Needle does not need in its application database, particularly IP address and detailed device/platform history.

The ingestion pipeline must whitelist required fields rather than copying raw rows wholesale.

## Prior analysis workbook

### Sheets

- **Summary**
- **Confirmed Twice**
- **Review Queue**
- **Catalog Matches**
- **Session Details**
- **Catalog Match Review**

### Album candidate results

The analysis reviewed **402 album candidates**.

| Classification | Albums |
| --- | ---: |
| Confirmed complete in at least 2 sessions | 243 |
| Confirmed once | 23 |
| Near-complete | 71 |
| Single-track / sparse | 49 |
| Review-other | 16 |
| **Total** | **402** |

402 is the analysis candidate set, not necessarily every album title ever present in a raw playback row.

### Session reconstruction

The workbook contains **2,012 derived session-detail rows**.

| Session status | Sessions |
| --- | ---: |
| Full | 567 |
| Near-complete | 718 |
| Single-track / sparse | 449 |
| Review | 278 |
| **Total** | **2,012** |

This is materially useful to Needle because it distinguishes album-level listening evidence from isolated track playback.

### Catalog resolution — corrected audit

Direct inspection during Issue 1.04 confirmed that the workbook's `Catalog Matches` sheet is **MusicBrainz-grounded**, not Spotify-grounded. It contains fields such as `release_group_id`, `selected_release_id`, and MusicBrainz source URLs. The workbook remains useful as a calibration/reference implementation, but Needle does not depend on those MusicBrainz IDs at runtime.

The current 402 workbook catalog rows break down as:

| Workbook match status | Albums |
| --- | ---: |
| `matched_standard_release` | 349 |
| `needs_match_review` | 41 |
| `matched_but_edition_ambiguous` | 11 |
| `matched_nonofficial_catalog_release` | 1 |
| **Total** | **402** |

Needle therefore treats **349** as the workbook's accepted standard-release reference and **53** as the review reference (41 + 11 + 1).

Current workbook `match_confidence` values are:

- high: 361
- none: 41

Current explicit `edition_ambiguity` values are:

- yes: 11
- no: 391

Earlier audit notes describing 143 high / 206 medium / 53 unresolved confidence and Spotify album IDs were stale and should not be used as implementation targets.

Edition ambiguity must remain explicit. Standard, deluxe, remastered, reissued, compilation, single-release, and re-recorded identities cannot safely be flattened by album-title strings alone.

### Needle runtime catalog source

Per D-015, Spotify is Needle's primary V1 runtime catalog provider. Issue 1.04 resolves canonical Album vs Spotify AlbumEdition identity directly against Spotify using observed Spotify track identity, catalog search, artist/title evidence, and track-list overlap. The workbook is calibration only and is **not required for another listener's import**.

## Fields already supported by source history/workbook

The current history/analysis gives Needle strong support for:

- source album and artist names;
- Spotify track IDs from the raw listening export;
- first/last listening evidence;
- full/near/sparse session counts;
- session timing and duration;
- track coverage;
- album-level play/time totals;
- workbook catalog confidence/ambiguity as calibration evidence.

The workbook's MusicBrainz release IDs are reference data, not Needle's Spotify AlbumEdition identifiers.

## Fields still requiring runtime resolution, enrichment, or app state

- Spotify album-edition identity for current imports;
- album artwork;
- Spotify destination URL;
- canonical release metadata;
- Music Type;
- detailed genre taxonomy;
- country/origin if desired;
- personal rating, if later added;
- Favorite/Revisit state;
- personal notes;
- manual corrections for unresolved catalog records.

Artwork and full Spotify metadata enrichment follow identity resolution in 1.05. Music Type and Genre need a documented enrichment/taxonomy step and must not be guessed independently in UI code.

## Date-range verification — resolved

The initial Phase 0 audit incorrectly reported a future-dated session in October 2026. That was **an audit conversion error**, not a future listening event in the workbook.

Direct inspection of the `Session Details` sheet shows:

- earliest `session_start_utc` Excel serial: `41093.77563923611` → **2012-07-03 18:36:55 UTC**;
- latest `session_start_utc` Excel serial: `46257.71521388889` → **2026-08-23 17:09:54 UTC**.

There is therefore **no future-date blocker** in the current analysis workbook. The importer still validates/quarantines impossible future timestamps as a general safety rule.

## Private source-data location

Accepted local layout:

```text
data/history/
├── Streaming_History_Audio_*.json
└── spotify_album_history_analysis.xlsx
```

Everything in `data/history/` is Git-ignored except its README.

### Historical exposure caveat

The source files were previously committed while the repository was public. Active Git branch history was rewritten to a sanitized root on 2026-08-25. GitHub-hosted orphaned objects/caches or old clones remain a separate platform/operational concern and must not be pushed back into active history.

## What the audit changes in the product plan

1. Preserve **evidence/classification**, not merely a boolean `listened` flag.
2. Keep canonical Album separate from Spotify AlbumEdition.
3. Preserve all usable candidate evidence during import even if Library hides weak records by default.
4. Decide Library membership independently from ingestion.
5. Treat Genre/Music Type enrichment as a real workstream.
6. Minimize raw playback fields before persistence.
7. Give catalog-review candidates an explicit review/fallback path.
8. Treat the workbook as calibration, not a runtime dependency or metadata provider.
