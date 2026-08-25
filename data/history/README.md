# Local Listening History

`data/history/` is Needle's **local-only** source-data folder.

Place the real listening-history inputs here in a local clone:

- Spotify extended-history files: `Streaming_History_Audio_*.json`
- prior analysis workbook: `spotify_album_history_analysis.xlsx`

Split yearly files such as `Streaming_History_Audio_2014_1.json` belong here too.

## Privacy

Everything in this folder is ignored by Git except this README.

The raw Spotify export can contain IP addresses, device/platform information, timestamps, country, listening behavior, and Spotify identifiers. Do not commit those files or the personal analysis workbook.

Needle's import pipeline should read from `data/history/` during local ingestion, minimize the source fields it retains, and persist only the normalized data the application needs.

## Important historical note

The files were previously committed while the repository was public. They have been removed from the Phase 0 branch tip, but older Git commits can still contain those copies until repository history is rewritten or otherwise remediated.
