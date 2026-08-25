# Local Spotify History

Place the raw Spotify extended streaming-history export files in this folder.

Expected filenames include:

- `Streaming_History_Audio_2011.json`
- `Streaming_History_Audio_2025.json`
- `Streaming_History_Audio_2026.json`
- split files such as `Streaming_History_Audio_2014_1.json`

## Privacy

Everything in `data/history/` is ignored by Git except this README and `.gitkeep`.

Raw Spotify exports may contain personal metadata such as IP addresses, device/platform information, timestamps, and listening history. Do not commit the export files.

Needle's import pipeline should read from this directory in local development and persist only the normalized fields the application actually needs.
