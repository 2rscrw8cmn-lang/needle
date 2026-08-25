# Local Listening History

`data/history/` is Needle's **local-only** source-data folder.

Place the real listening-history inputs here in a local clone:

- Spotify extended-history files: `Streaming_History_Audio_*.json`
- prior analysis workbook: `spotify_album_history_analysis.xlsx`

Split yearly files such as `Streaming_History_Audio_2014_1.json` belong here too.

## Validate the Spotify export

From the repository root:

```bash
npm run history:validate
```

The validator discovers the Spotify JSON files, fingerprints them in deterministic order, checks the raw schema and timestamps, separates music from podcast/audiobook rows, quarantines invalid rows, and creates a minimized music-only stream.

Generated private outputs are written to:

```text
data/history/.needle/
├── import-manifest.json
├── import-report.json
├── import-report.md
├── validated-music.json
└── quarantine.json
```

For a reproducible audit with a fixed future-date cutoff:

```bash
npm run history:validate -- --as-of 2026-08-25T23:59:59Z
```

See `docs/IMPORT_PIPELINE.md` for the exact validation/minimization contract.

## Privacy

Everything in this folder is ignored by Git except this README.

The raw Spotify export can contain IP addresses, device/platform information, timestamps, country, listening behavior, and Spotify identifiers. Do not commit those files, the personal analysis workbook, or generated `.needle/` outputs.

The 1.01 validator only carries the approved music-history whitelist into `validated-music.json`. Reports contain aggregate diagnostics, field names, and source row references rather than raw private values.

## Historical note

The raw history/workbook were briefly committed while the repository was public. Active Git history was rewritten on 2026-08-25 to a sanitized root. Do not push an old clone containing the removed history back into this repository.
