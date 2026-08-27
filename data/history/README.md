# Local Listening History

`data/history/` is Needle's **local-only** source-data folder.

Place the real listening-history inputs here in a local clone:

- Spotify extended-history files: `Streaming_History_Audio_*.json`
- optional prior analysis workbook for project calibration: `spotify_album_history_analysis.xlsx`

The workbook is **not required** to import another listener's Spotify history.

## 1. Validate the Spotify export

```bash
npm run history:validate
```

The validator discovers the Spotify JSON files, fingerprints them in deterministic order, checks schema/timestamps, separates music from podcast/audiobook rows, quarantines invalid rows, and creates a minimized music-only stream.

For a reproducible audit with a fixed future-date cutoff:

```bash
npm run history:validate -- --as-of 2026-08-25T23:59:59Z
```

## 2. Normalize playback events

```bash
npm run history:normalize
```

This converts accepted music rows into canonical UTC playback events, extracts Spotify track IDs, assigns stable event IDs, and conservatively collapses only exact duplicate events while preserving provenance.

## 3. Reconstruct album listening sessions

```bash
npm run history:sessionize
```

This groups the minimized playback events into deterministic provisional album runs, calculates local track coverage, classifies Full / Near-Complete / Sparse / Review evidence, and identifies repeated provisional album candidates.

## 4. Resolve canonical albums + Spotify editions

Issue 1.04 uses Spotify's public catalog to separate the listener-facing canonical Album from specific Spotify AlbumEdition records.

Live local resolution requires Spotify developer client credentials in the environment:

```text
SPOTIFY_CLIENT_ID
SPOTIFY_CLIENT_SECRET
```

Optional market override:

```text
SPOTIFY_MARKET=US
```

Then run:

```bash
npm run history:resolve-albums
```

Do not commit credentials. Client Credentials are used only for public catalog lookup; user Spotify playback authorization is not required for this import stage.

The resolver uses observed Spotify track IDs, Spotify album search, artist/title evidence, and track-list overlap. Weak, compilation-risk, or ambiguous identities remain Review records instead of being forced by title equality.

## 5. Enrich accepted albums from Spotify

After 1.04 completes successfully:

```bash
npm run history:enrich-albums
```

1.05 enriches only accepted canonical albums and their preferred Spotify editions. It stores provider artwork references, Spotify destination URLs, release metadata, simplified artist identity, detailed track metadata, provenance, and enrichment timestamps.

The enrichment stage is resumable through `spotify-enrichment-cache.json`. If Spotify Development Mode returns `QUOTA_EXCEEDED`, the command stops immediately, preserves the cache, and can be rerun after the reported retry time.

Spotify artist genre metadata is currently deprecated. Needle does not spend additional quota fetching artists solely for that field; missing genre data stays explicit for 1.06 rather than being guessed.

## 6. Classify Genre → Music Type

After 1.05 produces enrichment artifacts:

```bash
npm run history:classify-music-types
```

1.06 keeps detailed Genre separate from Needle's accepted ten broad Music Types and applies versioned deterministic mapping rules. Missing, unmapped, or tied genre evidence remains explicitly unclassified.

Optional manual Music Type decisions live outside generated `.needle/` artifacts at:

```text
data/history/music-type-overrides.json
```

The classifier reads that file when present but never creates or overwrites it, so manual decisions survive reimports. Override targets use stable canonical album IDs.

Generated outputs include:

```text
data/history/.needle/
├── import-manifest.json
├── import-report.json
├── import-report.md
├── validated-music.json
├── quarantine.json
├── normalized-playback-events.json
├── normalization-report.json
├── normalization-report.md
├── album-sessions.json
├── provisional-albums.json
├── sessionization-report.json
├── sessionization-report.md
├── canonical-albums.json
├── spotify-album-editions.json
├── album-resolution-links.json
├── album-resolution-review.json
├── album-resolution-report.json
├── album-resolution-report.md
├── spotify-resolution-cache.json
├── spotify-album-enrichment.json
├── spotify-artist-enrichment.json
├── spotify-track-enrichment.json
├── spotify-enrichment-review.json
├── spotify-enrichment-report.json
├── spotify-enrichment-report.md
├── spotify-enrichment-cache.json
├── album-music-type-classifications.json
├── genre-catalog.json
├── music-type-taxonomy-report.json
└── music-type-taxonomy-report.md
```

See `docs/SESSIONIZATION.md` for 1.03, `docs/CATALOG_RESOLUTION.md` for 1.04 identity, `docs/SPOTIFY_ENRICHMENT.md` for 1.05 enrichment, and `docs/MUSIC_TYPE_TAXONOMY.md` for the 1.06 taxonomy contract.

## Privacy

Everything in this folder is ignored by Git except this README.

The raw Spotify export can contain IP addresses, device/platform information, timestamps, country, listening behavior, and Spotify identifiers. Do not commit those files, the personal analysis workbook, generated `.needle/` outputs, Spotify credentials, or personal Music Type override files.

1.01 whitelists the private source fields needed for album-history reconstruction. Later stages consume only minimized/derived artifacts and public Spotify catalog metadata; they do not reintroduce discarded IP/device/country/offline/incognito fields.

## Historical note

The raw history/workbook were briefly committed while the repository was public. Active Git history was rewritten on 2026-08-25 to a sanitized root. Do not push an old clone containing the removed history back into this repository.
