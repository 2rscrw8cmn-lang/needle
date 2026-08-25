# Import Pipeline

## Goal

Convert the private Spotify extended streaming-history export into a stable Needle dataset without leaking unnecessary raw personal metadata or baking edition ambiguity into UI code.

```text
RAW SPOTIFY EXPORT
        ↓
VALIDATE + MINIMIZE
        ↓
NORMALIZE PLAYBACK EVENTS
        ↓
RESOLVE TRACK IDENTITY
        ↓
SESSIONIZE ALBUM LISTENING
        ↓
RESOLVE CANONICAL ALBUM + EDITION
        ↓
CLASSIFY LISTENING EVIDENCE
        ↓
ENRICH ARTWORK / RELEASE / GENRE
        ↓
ASSIGN NEEDLE MUSIC TYPE
        ↓
BUILD LISTENER ALBUM SUMMARIES
        ↓
NEEDLE DATABASE
```

## Stage 1 — Source discovery and validation

- discover all expected `Streaming_History_Audio_*.json` files;
- record an import batch manifest;
- validate JSON shape;
- validate timestamps;
- reject/quarantine impossible future timestamps;
- separate audio tracks from podcast/audiobook rows;
- report field/null-rate changes rather than silently accepting schema drift.

Output: import manifest + validated source stream.

### Issue 1.01 implementation contract

Run the local validator from the repository root:

```bash
npm run history:validate
```

By default it reads the private source files in `data/history/` and writes private generated outputs to:

```text
data/history/.needle/
├── import-manifest.json
├── import-report.json
├── import-report.md
├── validated-music.json
└── quarantine.json
```

The entire `data/history/` directory remains Git-ignored except its README, so generated reports and minimized history are local ingestion artifacts rather than repository assets.

`import-manifest.json` is input-derived only. It records naturally ordered source filenames, byte counts, SHA-256 fingerprints, parse status, row counts, and a batch ID derived from those file identities. It does not contain listening-row values.

`import-report.json` and `import-report.md` report:

- music, podcast, audiobook, unknown/mixed, accepted, excluded, and quarantined counts;
- fatal file errors;
- observed/missing/unexpected field names;
- per-file null rates;
- field-set and null-rate changes relative to the first valid source file;
- quarantine reasons.

Reports intentionally contain field names and row references, not raw private field values.

`validated-music.json` is the source-minimized stream passed to the next import stage. Its whitelist is currently:

- source filename + source row number for provenance;
- `ts`;
- `ms_played`;
- `master_metadata_track_name`;
- `master_metadata_album_artist_name`;
- `master_metadata_album_album_name`;
- `spotify_track_uri`;
- `reason_start`;
- `reason_end`;
- `skipped`.

It explicitly excludes IP address, platform/device, country, offline metadata, incognito metadata, and podcast/audiobook payload fields.

`quarantine.json` stores only source file, row number, content category, and reason codes. It does not duplicate the offending source row.

Malformed JSON and non-array top-level files make the validation run fail visibly. Invalid individual rows are quarantined while valid rows continue through the validation stage.

Future-date validation uses the execution time by default with a five-minute clock-skew tolerance. For reproducible audits/tests, pass a fixed cutoff:

```bash
npm run history:validate -- --as-of 2026-08-25T23:59:59Z
```

Given identical input files and the same `--as-of` cutoff, the manifest, reports, minimized stream, and quarantine output are deterministic.

## Stage 2 — Data minimization

Whitelist fields required for music-history reconstruction.

Retained by 1.01:

- timestamp;
- milliseconds played;
- track name;
- album artist name;
- album name;
- Spotify track URI;
- reason start/end;
- skipped state;
- source file/row provenance.

Do not persist to the app database:

- IP address;
- exact raw device/platform history;
- country where it is not needed for the product;
- incognito/offline/device metadata unrelated to album history;
- podcast/audiobook metadata for V1.

The original private export may remain available for reproducible reprocessing, but it is not the application database.

## Stage 3 — Normalize playback events

- convert Spotify track URIs to stable Spotify track IDs when valid;
- normalize timestamps to canonical UTC ISO strings;
- preserve source display strings rather than guessing canonical names;
- define conservative exact-event duplicate handling;
- retain `ms_played` without inventing full-track completion where duration is unknown;
- preserve source-file/row and import-batch provenance.

Output: normalized `PlaybackEvent` records.

### Issue 1.02 implementation contract

After 1.01 validation passes, run:

```bash
npm run history:normalize
```

The command reads these private 1.01 artifacts from `data/history/.needle/`:

- `import-manifest.json`;
- `import-report.json`;
- `validated-music.json`.

It refuses to continue when manifest/report batch IDs differ, when the 1.01 report is failing, when accepted-row counts do not reconcile, or when source file/row provenance falls outside the manifest.

It writes:

```text
data/history/.needle/
├── normalized-playback-events.json
├── normalization-report.json
└── normalization-report.md
```

Each normalized playback event contains:

- stable `event_id`;
- current `import_batch_id`;
- canonical UTC `played_at`;
- `ms_played`;
- `spotify_track_id` when the URI can be parsed;
- original minimized Spotify track URI for audit/fallback;
- explicit identity status: `spotify`, `metadata_only`, or `unparseable_spotify_uri`;
- source track / album artist / album display strings;
- reason start/end and skipped state;
- one or more source file/row references.

### Stable event identity

`event_id` is a SHA-256-derived identifier based on the normalized playback payload and **does not include the import batch or source location**. Therefore the same historical event receives the same event ID when it appears in a later Spotify export/reimport.

Import provenance remains separate through `import_batch_id` and `source_refs`.

### Exact duplicate rule

Needle collapses two validated rows only when all event-defining values match after timestamp normalization:

- canonical UTC timestamp;
- milliseconds played;
- Spotify URI/parsed-ID state;
- track name;
- album artist name;
- album name;
- reason start;
- reason end;
- skipped state.

This is deliberately conservative. Same title/artist/album alone is never enough to deduplicate a play. When exact duplicates collapse, every source file/row reference is retained on the surviving normalized event.

The normalization report must satisfy:

```text
validated music rows = normalized events + duplicate rows collapsed
```

and its validated-row count must match `acceptedMusicRows` from the 1.01 import report.

### Missing track identity

A null Spotify track URI is valid at this stage. The event remains `metadata_only` using preserved track/artist/album strings for later identity resolution.

A non-null URI that does not parse as `spotify:track:<id>` is retained but marked `unparseable_spotify_uri`. 1.02 does not guess a track ID from text.

### Privacy boundary

1.02 reads only the minimized 1.01 artifacts; it does not re-read raw export rows. Unknown extra fields are ignored rather than copied into normalized events. IP address, platform/device, country, offline, incognito, podcast, and audiobook data therefore remain outside the normalized playback-event representation.

## Stage 4 — Resolve track identity

Prefer Spotify track URI/ID over artist/title string matching.

When historical rows lack usable Spotify identity, use a documented fallback rather than silently merging by normalized strings.

Output: event → Track linkage with confidence/provenance.

## Stage 5 — Sessionize album listening

The prior workbook already demonstrates useful album-session reconstruction and should be treated as reference behavior.

Sessionization must account for:

- chronological proximity;
- album identity/edition evidence;
- unique track coverage;
- expected track count/signature;
- repeated or out-of-order tracks;
- sparse accidental plays;
- edition mismatch.

Output: candidate `AlbumSession` records.

## Stage 6 — Resolve canonical album and edition

Use catalog information to distinguish:

- canonical Album;
- specific Spotify AlbumEdition;
- standard edition target;
- deluxe/remaster/reissue alternatives;
- ambiguous or unresolved candidates.

Do not automatically merge re-recordings or materially distinct releases because their titles are similar.

The current workbook provides Spotify album IDs for 349 of 402 candidate albums and isolates 53 candidates for catalog review.

Output: Album + AlbumEdition mappings with confidence.

## Stage 7 — Classify listening evidence

Initial vocabulary should preserve the analysis model:

- Full
- Near-complete
- Single-track/sparse
- Review

Classification should be deterministic and testable. Each session should retain the inputs necessary to explain its status.

Output: classified AlbumSession records.

## Stage 8 — Enrich catalog metadata

Needed for the product but not supplied completely by the analysis workbook:

- artwork URL/reference;
- canonical/preferred Spotify album URL;
- release metadata corrections;
- detailed genre(s).

Enrichment must be cached/persisted so normal Needle page loads do not depend on re-enriching the entire collection.

## Stage 9 — Assign Music Type

Map detailed genre/enrichment data to Needle's broad Music Type taxonomy using a deterministic mapping table with manual override support.

Do not infer Music Type separately in each UI component.

Output: one primary Music Type per album plus detailed Genre relationships.

## Stage 10 — Build listener summaries

Derive fast album-level data from sessions:

- first/last evidence;
- qualifying session counts;
- full/near/sparse counts;
- total listening time/plays;
- listener classification;
- archive inclusion state.

These summaries are rebuildable projections, not the authoritative historical source.

## Reimport contract

A new Spotify export should be ingestible without manual rebuilding of the app.

Reimport must:

1. be idempotent;
2. avoid duplicate playback events/sessions;
3. preserve manual PersonalAlbumState;
4. preserve documented catalog overrides unless explicitly invalidated;
5. surface changed classifications for review;
6. produce an audit report with counts and anomalies.

## Validation outputs

Every import should ultimately report at minimum:

- source files read;
- raw rows;
- music rows accepted;
- podcast/audiobook rows excluded;
- invalid/future rows quarantined;
- normalized playback events and duplicate rows collapsed;
- Spotify track-ID coverage;
- derived sessions by status;
- canonical albums;
- matched/unresolved editions;
- enriched/unenriched albums;
- Music Type coverage;
- before/after changes versus previous import.

The metrics become available incrementally. 1.01 covers source validation/minimization; 1.02 adds normalized-event, duplicate, identity-coverage, and reconciliation metrics; later issues add sessions/catalog/taxonomy metrics.

## Fixtures

Use small sanitized fixtures representing hard cases. Never commit real private source history.

Current/expected cases include:

- normal music event;
- missing Spotify track URI;
- exact duplicate rows;
- malformed Spotify URI;
- future/invalid timestamp;
- podcast/audiobook exclusion;
- schema drift;
- later: deluxe/remaster/re-recording/session/catalog ambiguity.
