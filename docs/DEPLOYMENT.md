# Deployment

Needle is a Next.js-compatible App Router application running on Cloudflare Workers through **vinext**. Cloudflare D1 is bound as `DB`.

## Local setup

Requirements:

- Node 24
- npm
- Wrangler authentication only when using remote Cloudflare resources

Install dependencies:

```bash
npm install
```

Apply the local D1 migration and verify it:

```bash
npm run db:migrate:local
npm run db:verify:local
```

Start development:

```bash
npm run dev
```

Run the production-shaped Workers preview:

```bash
npm run preview
```

Run all local quality gates:

```bash
npm run check
```

## Create the production D1 database

The committed `wrangler.jsonc` contains a deliberate placeholder for the remote D1 database ID. Create the database once:

```bash
npx wrangler d1 create needle
```

Copy the returned UUID into `wrangler.jsonc` as `database_id`, replacing:

```text
REPLACE_WITH_CLOUDFLARE_D1_DATABASE_ID
```

Then apply the production migration:

```bash
npm run db:migrate:remote
```

The D1 database ID is configuration, not a secret, and may be committed after the resource exists.

## Cloudflare authentication

For local deployment, use Wrangler login:

```bash
npx wrangler login
```

For CI / Workers Builds, configure these as Cloudflare build variables/secrets:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

Spotify credentials are server-only and are not needed for Issue 1.00. When Phase 1.05 begins, configure:

- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`

Never prefix those secrets with `NEXT_PUBLIC_`.

## Deploy

Build:

```bash
npm run build
```

Deploy the current build to Workers:

```bash
npm run deploy -- --skip-build
```

For a preview deployment:

```bash
npm run deploy -- --preview --skip-build
```

## GitHub-connected Workers Builds

Production branch: `main`.

Recommended configuration:

- Build command: `npm install --no-audit --no-fund && npm run build`
- Deploy command: `npm run deploy -- --skip-build`
- Preview deploy command: `npm run deploy -- --preview --skip-build`

Keep deployment credentials in Cloudflare's Build Variables and secrets. Do not commit them to GitHub.

## Verification endpoint

After migrations are applied, `/api/health` should return HTTP 200 with:

```json
{
  "service": "needle",
  "status": "ok",
  "database": "ok",
  "schemaVersion": "0"
}
```

A missing/unavailable D1 binding returns HTTP 503 rather than hiding the configuration failure.

## Scope boundary

This deployment configuration establishes the runtime only. It intentionally does not add authentication, R2 artwork storage, playback, realtime services, or product-facing Library/Home UI.
