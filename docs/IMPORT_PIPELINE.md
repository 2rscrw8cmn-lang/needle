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

Likely retained:

- timestamp;
- milliseconds played;
- track name;
- album artist name;
- album name;
- Spotify track URI;
- skip/reason fields only where they materially improve session logic.

Do not persist to the app database:

- IP address;
- exact raw device/platform history unless proven necessary;
- incognito/device metadata unrelated to album history;
- podcast/audiobook metadata for V1.

Issue 1.01 establishes this source-minimization boundary before normalization. The original private export may remain available for reproducible reprocessing, but it is not the application database.

## Stage 3 — Normalize playback events

- convert Spotify URIs to stable IDs;
- normalize timestamps to UTC;
- preserve original display strings for audit;
- define exact-event duplicate handling;
- retain `ms_played` without inventing full-track completion where duration is unknown.

Output: normalized `PlaybackEvent` records.

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

The specific enrichment provider/API is a Phase 0 architecture decision.

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

Every import should report at minimum:

- source files read;
- raw rows;
- music rows accepted;
- podcast/audiobook rows excluded;
- invalid/future rows quarantined;
- unique track IDs;
- derived sessions by status;
- canonical albums;
- matched/unresolved editions;
- enriched/unenriched albums;
- Music Type coverage;
- before/after changes versus previous import.

The earlier-stage metrics become available incrementally. Issue 1.01 covers source files, row/content counts, quarantine, schema diagnostics, and minimized music rows; later issues add identity/session/catalog/taxonomy metrics.

## Fixtures

The repository should ultimately contain a small sanitized fixture dataset representing hard cases:

- normal standard album;
- deluxe edition;
- remaster/reissue;
- re-recording;
- near-complete listen;
- sparse single-track play;
- unresolved edition;
- future/invalid timestamp.

Fixtures must not contain real IP addresses or unnecessary private source metadata. Issue 1.01 adds the first source-validation fixture; later data issues should extend it rather than committing real history.
