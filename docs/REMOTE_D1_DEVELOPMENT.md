# Shared remote D1 development

Needle's private Spotify importer and its runtime database have different privacy and portability requirements.

The raw Spotify export, resolution/enrichment caches, review artifacts, and manual override files remain local under `data/history/` and are ignored by Git. They are importer inputs and rebuild material, not runtime application data.

The reconciled runtime archive is intentionally privacy-minimized and is suitable for the Cloudflare D1 binding used by Needle. It excludes raw playback events, source rows, device/IP/country data, offline/incognito fields, and session event IDs.

## Why use remote D1

A shared remote D1 database lets multiple development computers use the same Needle archive without copying `data/history/` or `.wrangler/state` between machines.

The repository now supports two explicit development modes:

- `npm run dev` — local code + isolated local D1 simulation. Safe default for destructive/schema experiments.
- `npm run dev:remote-data` — local code + the Cloudflare-hosted `needle` D1 database through a remote D1 binding.

Remote-data mode reads and writes the real shared D1 database. Favorites, Revisit, Reviews, and any other runtime writes made in that mode persist remotely.

## One-time publish from the importer computer

Do this only on the computer that contains the completed private import artifacts.

### 1. Finish final Phase 1 outputs

```bash
npm run history:classify-music-types
npm run history:reconcile
```

Review `data/history/.needle/archive-reconciliation-report.md` before uploading. Do not publish a partial resolver/enrichment run.

### 2. Authenticate Wrangler

If needed:

```bash
npx wrangler login
```

### 3. Apply remote migrations

```bash
npm run db:migrate:remote
npm run db:verify:remote
```

### 4. Load the finalized runtime archive

```bash
npm run db:load-archive:remote
```

`archive-import.sql` is generated from the privacy-minimized runtime archive. It intentionally preserves `personal_album_state` across reimports.

### 5. Verify remote counts

```bash
npm run db:status:remote
```

The status command reports current albums, archive members, albums with artwork, and stored album sessions. Compare these to the final reconciliation report before treating the remote archive as authoritative.

## Developing on the importer computer

To keep using a disposable local database:

```bash
npm run dev
```

To use the shared Cloudflare D1 archive:

```bash
npm run dev:remote-data
```

The `remote` Wrangler environment sets only the D1 binding to `remote: true`. Application code still executes locally; D1 calls are proxied to the Cloudflare-hosted database.

## Developing on another computer

The new computer does not need the Spotify export, `.needle` artifacts, enrichment cache, or a copy of `.wrangler/state` for normal product development.

```bash
git clone <needle repository>
cd needle
npm install
npx wrangler login
npm run dev:remote-data
```

Private importer data is still required only when rebuilding or updating the listening archive itself.

## Reimporting later

When a new Spotify history export is processed on the importer computer:

1. run the importer/resolution/enrichment/taxonomy/reconciliation pipeline locally;
2. inspect the reconciliation report;
3. run `npm run db:load-archive:remote` only after approving the new runtime archive;
4. verify with `npm run db:status:remote`.

Generated archive imports do not delete or overwrite `personal_album_state`.

## Development vs production

The current remote database is a practical shared runtime database for continued development. Before Needle becomes a deployed multi-user or externally used product, split development and production resources so experimental development writes cannot touch production data.
