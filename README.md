# Needle

Needle is a personal, artwork-first archive for exploring a long-form Spotify listening history.

It is not a music player. Needle turns listening history into a browsable album library, an editorial history of changing taste, and a way to rediscover records worth hearing again. Spotify remains the playback destination.

## Start here

Read [`docs/START_HERE.md`](docs/START_HERE.md) before product or implementation work.

Core foundation docs:

- [`docs/PRODUCT.md`](docs/PRODUCT.md) — product purpose, V1 scope, exclusions
- [`docs/DATA_AUDIT.md`](docs/DATA_AUDIT.md) — what the source history and prior analysis actually contain
- [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) — canonical entities and evidence model
- [`docs/IMPORT_PIPELINE.md`](docs/IMPORT_PIPELINE.md) — raw Spotify history to Needle dataset
- [`docs/INFORMATION_ARCHITECTURE.md`](docs/INFORMATION_ARCHITECTURE.md) — app structure and navigation
- [`docs/DESIGN.md`](docs/DESIGN.md) — approved visual direction
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — phased implementation plan
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — accepted and pending product decisions

## Current status

Needle is in **Phase 0 — Foundation**. No application code should be scaffolded until the Phase 0 exit gate in the roadmap is satisfied.

## Data privacy warning

The repository currently contains the raw Spotify extended streaming-history export. Those files include timestamps, device/platform data, country, IP address, listening behavior, and Spotify identifiers. The repository is currently public.

Before Needle is shared or development broadens, choose one of these paths:

1. make the repository private and keep the source dataset with the project; or
2. remove the raw export from the repository **and purge it from Git history**, then ingest it locally/private.

Adding raw files to `.gitignore` does not remove data already committed to Git history.
