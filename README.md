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
- [`docs/TECHNICAL_ARCHITECTURE.md`](docs/TECHNICAL_ARCHITECTURE.md) — Next.js + Cloudflare Workers + D1 architecture
- [`docs/INFORMATION_ARCHITECTURE.md`](docs/INFORMATION_ARCHITECTURE.md) — app structure and navigation
- [`docs/DESIGN.md`](docs/DESIGN.md) — approved visual direction
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — phased implementation plan + issue sequence
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — accepted product and architecture decisions

## Current status

**Phase 0 — Foundation is complete.**

Needle is ready to begin **Phase 1 — Data Foundation**. The first implementation package is GitHub issue **#7 — 1.00 Scaffold Needle on Next.js + Cloudflare Workers + D1**.

## Accepted architecture

- Next.js + TypeScript
- Cloudflare Workers
- Cloudflare D1
- Spotify as the primary catalog/enrichment source
- local Node.js/TypeScript history importer
- GitHub → Cloudflare preview/production workflow

## Private history data

The real Spotify export and the prior analysis workbook belong locally in:

```text
data/history/
```

They are ignored by Git and are not part of the active repository history.

On 2026-08-25 the active branch history was rewritten to a new sanitized root commit after the raw source files had briefly been committed while the repository was public. GitHub may retain orphaned/cached objects or pull-request refs outside active branch history; those require platform-side removal if they remain accessible.
