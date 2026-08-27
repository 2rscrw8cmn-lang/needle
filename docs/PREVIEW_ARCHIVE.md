# Cached Archive Preview

## Purpose

Needle can build a **local-only, non-final preview archive** from Spotify catalog responses that are already present in `spotify-resolution-cache.json`.

This exists so Phase 2 product work can use real album identity and listening-history data while Spotify Development Mode quota prevents the complete 1.04/1.05 run.

The preview is not a substitute for the Phase 1 exit gate.

## Safety boundary

A cached preview:

- makes **zero Spotify API requests**;
- does not require Spotify client credentials;
- never overwrites the final `.needle` resolution/enrichment/reconciliation artifacts;
- writes only under `data/history/.needle/preview/`;
- is intended for **local D1 only**;
- must never be loaded into remote/production D1;
- contains only albums that can be resolved conservatively from already cached 1.04 catalog evidence;
- has no 1.05 artwork enrichment unless that data already exists elsewhere, so missing covers use Needle's normal artwork fallback;
- reports Spotify enrichment and Music Type coverage as incomplete rather than inventing those fields.

## Commands

Generate the preview from the current local cache:

```bash
npm run history:preview-cached
```

Load it into local D1:

```bash
npm run db:migrate:local
npm run db:load-preview:local
```

Then run the application locally and open `/library`.

## Preview output

The preview directory contains:

```text
data/history/.needle/preview/
├── listener-album-summaries.json
├── runtime-archive.json
├── archive-reconciliation-report.json
├── archive-reconciliation-report.md
├── archive-import.sql
└── preview-manifest.json
```

`preview-manifest.json` is the explicit marker that this dataset is incomplete and local-only.

## What is useful in the preview

Cached 1.04 evidence is enough to exercise real:

- canonical album and artist identity;
- release dates when already resolved;
- Full / Near-Complete / Sparse / Review session history;
- first and last meaningful listens;
- repeat/revisit inputs;
- default Library membership for the resolved subset;
- Library layout and density;
- album/artist search;
- future release-date and listening-history sorting/filtering;
- Album detail and history UI.

## What remains incomplete

Until the full 1.04–1.06 pipeline completes, preview coverage may be missing:

- canonical albums whose required catalog calls are not cached yet;
- Spotify artwork URLs from 1.05;
- detailed track enrichment from 1.05;
- Genre / Music Type coverage from 1.06.

Tomorrow's completed final import replaces the preview; it does not need to preserve preview-generated derived rows.