# Data Audit

## Purpose

This document records what Needle's source material actually contains before application code is built around it.

Sources reviewed:

- Spotify extended streaming-history JSON files spanning 2011 through 2026, with split files in several years;
- `spotify_album_history_analysis.xlsx`, the prior album/session analysis workbook.

The real source files are private ingestion material and belong locally under `data/history/`. They are not application assets and are not tracked on the Phase 0 branch.

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

### Catalog resolution

`Catalog Matches` contains all 402 album candidates and stores Spotify-grounded catalog information such as selected edition, Spotify album ID, release date, standard track count, observed/missing tracks, coverage, confidence, and edition ambiguity.

| Status | Albums |
| --- | ---: |
| Matched | 349 |
| Needs review | 53 |
| **Total** | **402** |

Match confidence:

- high: 143
- medium: 206
- unresolved: 53

Edition ambiguity must remain explicit. Standard, deluxe, remastered, reissued, compilation, single-release, and re-recorded identities cannot safely be flattened by album-title strings alone.

## Fields already supported

The current history/analysis gives Needle strong support for:

- album and artist names;
- Spotify album IDs for resolved candidates;
- release dates;
- expected track counts;
- first/last listening evidence;
- full/near/sparse session counts;
- session timing and duration;
- track coverage;
- album-level play/time totals;
- catalog confidence and edition ambiguity.

## Fields still requiring enrichment or app state

- album artwork;
- Music Type;
- detailed genre taxonomy;
- country/origin if desired;
- personal rating, if later added;
- Favorite/Revisit state;
- personal notes;
- manual corrections for unresolved catalog records.

Artwork and Spotify links can be enriched after album identity is resolved. Music Type and Genre need a documented enrichment/taxonomy step and must not be guessed independently in UI code.

## Date-range verification — resolved

The initial Phase 0 audit incorrectly reported a future-dated session in October 2026. That was **an audit conversion error**, not a future listening event in the workbook.

Direct inspection of the `Session Details` sheet shows:

- earliest `session_start_utc` Excel serial: `41093.77563923611` → **2012-07-03 18:36:55 UTC**;
- latest `session_start_utc` Excel serial: `46257.71521388889` → **2026-08-23 17:09:54 UTC**.

The latest row is album rank 375, **Petey USA — `oooo`**, session 2. It is before the project date of 2026-08-25.

There is therefore **no future-date blocker** in the current analysis workbook. The importer should still validate/quarantine impossible future timestamps as a general safety rule.

## Private source-data location

Accepted local layout:

```text
data/history/
├── Streaming_History_Audio_*.json
└── spotify_album_history_analysis.xlsx
```

Everything in `data/history/` is Git-ignored except its README. The Phase 0 branch no longer tracks either the raw JSON export or the analysis workbook.

### Historical exposure caveat

The source files were previously committed while the repository was public. Removing them from the current branch and adding `.gitignore` prevents future tracking, but older Git commits may still contain the files. A separate Git-history rewrite/private-repo remediation is required if historical removal is desired.

## What the audit changes in the product plan

1. Preserve **evidence/classification**, not merely a boolean `listened` flag.
2. Keep canonical Album separate from Spotify AlbumEdition.
3. Preserve all usable candidate evidence during import even if Library hides weak records by default.
4. Decide Library membership independently from ingestion.
5. Treat Genre/Music Type enrichment as a real workstream.
6. Minimize raw playback fields before persistence.
7. Give the 53 catalog-review candidates an explicit review/fallback path.

## Phase 0 data questions still open

- What evidence threshold determines default Library membership?
- How should near-complete sessions appear versus full sessions?
- How should deluxe/remaster/re-recorded editions collapse or remain separate in UI?
- What enrichment source provides artwork and genre data?
- What is the canonical Music Type taxonomy?
- What historical Git/privacy remediation, if any, should be done for the already-public source commits?
