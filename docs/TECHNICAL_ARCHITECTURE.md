# Technical Architecture

## Goal

Keep Needle small, portable, and operationally simple while supporting a rich album-history experience and deterministic private-history imports.

## Accepted stack

```text
GitHub
  │
  ▼
Cloudflare Workers Builds
  │
  ▼
Next.js-compatible App Router + TypeScript
(vinext scaffold)
on Cloudflare Workers
  │
  ├──────────────► Spotify Web API
  │                 catalog metadata
  │
  ▼
Cloudflare D1
Needle application data
```

Optional services should be added only for demonstrated needs.

## Application

- Next.js-compatible App Router/API surface + TypeScript.
- Full-stack deployment on Cloudflare Workers.
- Prefer Server Components / server-side data access where they simplify the product, but do not over-engineer caching or rendering strategies before real performance needs exist.
- **Issue 1.00 uses vinext** because Cloudflare recommends it for new Next.js-style Workers applications as of 2026-08-25.
- Vinext is an implementation/tooling choice, not a permanent product contract. If Cloudflare changes its recommended Next.js compatibility path later, evaluate migration rather than preserving obsolete adapter infrastructure.

### Current Workers scaffold contract

- Vite config composes `vinext()` with `@cloudflare/vite-plugin`.
- Worker entry is `vinext/server/app-router-entry`.
- Cloudflare D1 is bound as `DB`.
- D1 migrations live in `/migrations`.
- `/api/health` is the runtime/D1 verification endpoint during the scaffold phase.
- The verification page is temporary infrastructure UI, not a product design baseline.

## Database — Cloudflare D1

D1 is the system of record for normalized Needle application data.

Expected domains include:

- artists;
- canonical albums;
- Spotify album editions;
- tracks;
- minimized playback events where retained;
- derived album sessions;
- album/session evidence classifications;
- genres;
- Music Types;
- personal album state;
- import batches and provenance.

The scale of the personal archive does not justify a separate Postgres platform in V1.

Issue 1.00 intentionally creates only a tiny `needle_meta` table for schema/runtime verification. Product tables belong to later bounded data-foundation issues.

## Search and filtering

Start with D1/SQLite queries and appropriate indexes for:

- album/artist search;
- Music Type;
- Genre;
- release year/decade;
- listening year;
- archive membership;
- favorite/revisit state when those features exist.

Do not add an external search engine until query quality or latency demonstrates a real need.

## Spotify metadata

Spotify is the primary catalog provider for V1.

Use resolved Spotify identifiers to enrich:

- album artwork URL;
- release date;
- album/artist identity;
- track listing where required;
- Spotify destination URL;
- available genre metadata.

Important constraints:

- genre data may be incomplete/deprecated and must not be treated as infallible;
- missing genre data may remain unclassified until manually resolved;
- preserve manual taxonomy overrides;
- Spotify artwork/metadata should retain required Spotify attribution/linkback;
- do not copy Spotify artwork into R2 by default.

## Private import pipeline

Raw personal history stays local at:

```text
data/history/
```

A Node.js/TypeScript import tool will:

1. read the ignored Spotify JSON export;
2. validate and minimize raw fields;
3. normalize playback events;
4. resolve album/edition identity;
5. sessionize album listening;
6. classify Full / Near / Sparse / Review evidence;
7. enrich resolved catalog records through Spotify;
8. map detailed genre metadata into Needle Music Types;
9. write deterministic normalized records to D1;
10. emit an import/reconciliation report.

Imports must be idempotent and preserve PersonalAlbumState.

## Music Type taxonomy

V1 broad categories are:

- Rock
- Pop
- Hip-Hop
- R&B / Soul
- Electronic
- Jazz
- Country / Folk
- Heavy
- Global
- Classical / Soundtrack

Genre remains detailed and multi-valued beneath Music Type. Genre-to-Type mapping belongs in versioned data/taxonomy logic, not UI components.

## Library membership

The main Library includes an album when there is at least one **Full or Near-Complete** qualifying album session.

All usable evidence remains stored even when a record does not meet the default Library threshold.

## R2

R2 is **not required for V1**.

Add it only for a concrete non-Spotify need such as generated export artifacts, backups, or future user-owned media. Do not introduce R2 merely because it is available.

## Deployment

Preferred delivery flow:

```text
issue
  ↓
branch
  ↓
PR
  ↓
Cloudflare preview
  ↓
verify
  ↓
merge to main
  ↓
production Worker
```

Use GitHub-connected Cloudflare Workers Builds for branch/PR previews and production deployment where practical. See `DEPLOYMENT.md` for current build, migration, preview, and deploy commands.

## Secrets

Keep all credentials outside Git:

- Spotify credentials;
- Cloudflare API credentials/secrets;
- future third-party credentials.

D1 database IDs and binding configuration are infrastructure identifiers rather than application secrets; the real remote D1 ID may be committed after the database is created.

Raw Spotify history is never a deployment secret or repository asset; it is private local ingestion material.

## Explicit V1 non-goals

Do not introduce these into the architecture without an accepted product decision:

- Supabase/Postgres;
- Vercel;
- multi-user authentication;
- realtime infrastructure;
- external search service;
- queue/workflow infrastructure;
- R2 album-art mirroring;
- Spotify playback SDK;
- continuous Spotify account sync.
