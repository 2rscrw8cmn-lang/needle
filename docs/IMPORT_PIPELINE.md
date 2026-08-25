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

The original private export may remain available for reproducible reprocessing, but it is not the application database.

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

Fixtures must not contain real IP addresses or unnecessary private source metadata.
