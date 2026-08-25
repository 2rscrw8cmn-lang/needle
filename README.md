# Needle

Needle is a personal, artwork-first archive for exploring a long-form Spotify listening history.

It is not a music player. Needle turns listening history into a browsable album library, an editorial history of changing taste, and a way to rediscover records worth hearing again. Spotify remains the playback destination.

## Start here

Read [`docs/START_HERE.md`](docs/START_HERE.md) before product or implementation work.

Core foundation docs:

- [`docs/PRODUCT.md`](docs/PRODUCT.md) — product purpose, V1 scope, exclusions
- [`docs/DATA_AUDIT.md`](docs/DATA_AUDIT.md) — source history and prior analysis audit
- [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) — canonical entities and evidence model
- [`docs/IMPORT_PIPELINE.md`](docs/IMPORT_PIPELINE.md) — raw Spotify history to Needle dataset
- [`docs/INFORMATION_ARCHITECTURE.md`](docs/INFORMATION_ARCHITECTURE.md) — app structure and navigation
- [`docs/DESIGN.md`](docs/DESIGN.md) — approved visual direction
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — phased implementation plan
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — accepted and pending product decisions

## Current status

Needle is in **Phase 0 — Foundation**. No application code should be scaffolded until the Phase 0 exit gate in the roadmap is satisfied.

## Private history data

The real Spotify export and the prior analysis workbook belong locally in:

```text
data/history/
```

They are ignored by Git and are no longer tracked on the Phase 0 branch. See [`data/history/README.md`](data/history/README.md).

The source files were previously committed while the repository was public. Removing them from the branch tip prevents future tracking, but older Git commits may still contain them until repository history is rewritten or otherwise remediated.
