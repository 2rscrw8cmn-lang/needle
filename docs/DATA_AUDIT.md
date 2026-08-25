# Data Audit

## Purpose

This document records what Needle's current source material actually contains before any application model or UI is built around it.

Sources reviewed:

- Spotify extended streaming-history JSON files committed at the repository root, spanning files named from 2011 through 2026 with split files in several years;
- `spotify_album_history_analysis.xlsx`, the prior album/session analysis workbook.

The workbook is a derived analysis product. The raw Spotify export remains the source for playback events.

## Raw Spotify event shape

Observed audio-history records contain fields including:

- `ts`
- `platform`
- `ms_played`
- `conn_country`
- `ip_addr`
- `master_metadata_track_name`
- `master_metadata_album_artist_name`
- `master_metadata_album_album_name`
- `spotify_track_uri`
- podcast/episode fields
- audiobook fields
- `reason_start`
- `reason_end`
- `shuffle`
- `skipped`
- `offline`
- `offline_timestamp`
- `incognito_mode`

### Consequence

The raw export contains personally identifying/sensitive operational metadata that Needle does not need in its application database, particularly IP address and detailed device/platform history.

The ingestion pipeline should whitelist required fields rather than copying raw rows wholesale.

## Prior analysis workbook

### Sheets

The workbook contains:

- **Summary**
- **Confirmed Twice**
- **Review Queue**
- **Catalog Matches**
- **Session Details**
- **Catalog Match Review**

### Album candidate results

The prior analysis reviewed **402 album candidates**.

| Classification | Albums |
| --- | ---: |
| Confirmed complete in at least 2 sessions | 243 |
| Confirmed once | 23 |
| Near-complete | 71 |
| Single-track / sparse | 49 |
| Review-other | 16 |
| **Total** | **402** |

Important: 402 is the analysis candidate set, not necessarily every album title ever present in any raw track-play row.

### Session reconstruction

The workbook contains **2,012 derived session-detail rows**.

Workbook session classifications:

| Session status | Sessions |
| --- | ---: |
| Full | 567 |
| Near-complete | 718 |
| Single-track / sparse | 449 |
| Review | 278 |
| **Total** | **2,012** |

The workbook's session logic is materially useful to Needle because it attempts to distinguish listening to an album as an album from isolated track playback.

The analysis describes the matching rule as using canonical full-album track signatures and requiring observed session coverage of a standard full-album signature for a complete-session classification.

### Catalog resolution

`Catalog Matches` contains all 402 album candidates and stores Spotify-grounded catalog information including:

- selected edition name;
- `spotify_album_id`;
- standard release name/date;
- standard track count;
- observed tracks;
- missing tracks;
- standard-track coverage;
- match confidence;
- edition ambiguity;
- review reason/status.

Catalog resolution status:

| Status | Albums |
| --- | ---: |
| Matched | 349 |
| Needs review | 53 |
| **Total** | **402** |

Match-confidence distribution among the candidate set:

- high: 143
- medium: 206
- none/unresolved: 53

Edition ambiguity is significant and must be modeled rather than discarded. The catalog data includes cases where standard, deluxe, remastered, re-recorded, compilation, or single-release identities can overlap.

## Fields available for the product

The existing analysis already gives Needle strong support for:

- album/artist names;
- Spotify album identifiers for resolved candidates;
- release dates;
- expected track counts;
- first/last listening evidence;
- full/near/sparse session counts;
- session timing and duration;
- track coverage;
- album-level play/time totals;
- match confidence and edition ambiguity.

## Fields NOT currently supplied by the workbook

Needle still needs enrichment or new app data for:

- album artwork;
- Music Type;
- detailed genre taxonomy;
- country/origin if desired;
- user rating;
- Favorite/Revisit state;
- personal notes;
- manually corrected canonical metadata where catalog review remains unresolved.

Artwork and Spotify album links can be derived/enriched once album identity is resolved. Music Type and Genre require an explicit enrichment/taxonomy step; they should not be guessed in UI code.

## Date anomaly requiring verification

The workbook reports an earliest derived session corresponding to approximately **2012-07-27 12:30 UTC** and a latest derived session corresponding to approximately **2026-10-25 13:00 UTC**.

The latter is later than the current project date (2026-08-25). Treat it as an **audit anomaly**, not valid history, until checked against the underlying raw record(s) and date-conversion logic.

Possible causes to investigate include:

- malformed or future-dated source event;
- workbook/date-serial conversion issue;
- analysis artifact;
- unexpected source data.

No editorial feature should use future-dated history until this is resolved.

## Privacy / repository blocker

The repository is currently public while the raw export is committed.

Before broader development/sharing, one of these must happen:

1. make the repository private; or
2. remove raw source files and purge them from Git history, then ingest them from a local/private location.

A `.gitignore` rule alone does not remove already committed data.

## What the audit changes in the product plan

1. Needle should preserve **evidence/classification**, not merely a boolean `listened` flag.
2. Canonical album identity must be separate from a specific Spotify edition.
3. All candidate rows should be retained during import even if the default Library later hides sparse/unresolved records.
4. The UI inclusion rule for “in my archive” must be a product decision independent of ingestion.
5. Genre/Music Type enrichment is a real Phase 1 workstream, not existing source data.
6. Raw playback fields should be minimized before persistence.
7. The 53 catalog-review candidates need an explicit review path or fallback behavior.

## Phase 0 data questions still open

- What exact evidence threshold determines default Library membership?
- How should near-complete sessions be presented versus full sessions?
- How should deluxe/remaster/re-recorded editions collapse or remain separate in the UI?
- What enrichment source will provide artwork and genre data?
- What is the canonical Music Type taxonomy?
- What caused the future-dated derived session?
