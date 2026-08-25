# Local Listening History

`data/history/` is Needle's **local-only** source-data folder.

Place the real listening-history inputs here in a local clone:

- Spotify extended-history files: `Streaming_History_Audio_*.json`
- prior analysis workbook: `spotify_album_history_analysis.xlsx`

Split yearly files such as `Streaming_History_Audio_2014_1.json` belong here too.

## 1. Validate the Spotify export

From the repository root:

```bash
npm run history:validate
```

The validator discovers the Spotify JSON files, fingerprints them in deterministic order, checks the raw schema and timestamps, separates music from podcast/audiobook rows, quarantines invalid rows, and creates a minimized music-only stream.

For a reproducible audit with a fixed future-date cutoff:

```bash
npm run history:validate -- --as-of 2026-08-25T23:59:59Z
```

## 2. Normalize playback events

After validation passes:

```bash
npm run history:normalize
```

This reads the 1.01 artifacts from `data/history/.needle/`, converts timestamps to canonical UTC, extracts Spotify track IDs when possible, assigns stable playback-event IDs, and conservatively collapses only exact duplicate event rows while preserving every source file/row reference.

Review `normalization-report.md` for count reconciliation, duplicate totals, and Spotify-identity coverage.

## 3. Reconstruct album listening sessions

After normalization passes:

```bash
npm run history:sessionize
```

This reads the minimized 1.02 playback events, groups them into deterministic provisional album runs, calculates locally observed track coverage, classifies Full / Near-Complete / Sparse / Review evidence, and identifies repeated provisional album candidates without resolving canonical Spotify editions yet.

Review `sessionization-report.md` for the exact rules, event reconciliation, evidence counts, and comparison with the private workbook reference.

Generated private outputs now include:

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
└── sessionization-report.md
```

See `docs/IMPORT_PIPELINE.md` for the end-to-end ingestion contract and `docs/SESSIONIZATION.md` for the exact 1.03 rules and real-history calibration.

## Privacy

Everything in this folder is ignored by Git except this README.

The raw Spotify export can contain IP addresses, device/platform information, timestamps, country, listening behavior, and Spotify identifiers. Do not commit those files, the personal analysis workbook, or generated `.needle/` outputs.

The 1.01 validator only carries the approved music-history whitelist into `validated-music.json`. The 1.02 normalizer converts that minimized stream into playback-event records, and the 1.03 sessionizer consumes only those minimized events. Neither later stage re-reads or reintroduces discarded raw private fields.

## Historical note

The raw history/workbook were briefly committed while the repository was public. Active Git history was rewritten on 2026-08-25 to a sanitized root. Do not push an old clone containing the removed history back into this repository.
