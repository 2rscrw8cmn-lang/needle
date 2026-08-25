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
└── spotify-resolution-cache.json
```

See `docs/SESSIONIZATION.md` for 1.03 and `docs/CATALOG_RESOLUTION.md` for the exact 1.04 identity contract.

## Privacy

Everything in this folder is ignored by Git except this README.

The raw Spotify export can contain IP addresses, device/platform information, timestamps, country, listening behavior, and Spotify identifiers. Do not commit those files, the personal analysis workbook, generated `.needle/` outputs, or Spotify credentials.

1.01 whitelists the private source fields needed for album-history reconstruction. 1.02–1.04 consume only minimized/derived artifacts and public Spotify catalog metadata; they do not reintroduce discarded IP/device/country/offline/incognito fields.

## Historical note

The raw history/workbook were briefly committed while the repository was public. Active Git history was rewritten on 2026-08-25 to a sanitized root. Do not push an old clone containing the removed history back into this repository.
