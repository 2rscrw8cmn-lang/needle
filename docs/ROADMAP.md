# Roadmap

## Operating principle

Needle should be built in vertical, reviewable work packages:

**one meaningful issue → one branch → one PR → verify → merge**

The roadmap defines phase outcomes. GitHub issues define bounded implementation work.

---

# Phase 0 — Foundation

**Status: COMPLETE**

## Goal

Agree on what Needle is, what the source data means, how identity/evidence work, and what visual/technical constraints agents must honor before app code begins.

### 0.01 Dataset audit — complete

- private source-data home: `data/history/`;
- raw JSON/workbook ignored and absent from active Git history;
- date audit resolved; actual current workbook range ends 2026-08-23;
- privacy/minimization requirements documented.

### 0.02 Canonical data model — accepted

- Album separate from AlbumEdition;
- PlaybackEvent separate from AlbumSession;
- PersonalAlbumState protected from reimport;
- archive membership separate from ingestion/evidence.

### 0.03 History analysis → product — complete

See `HISTORY_ANALYSIS.md`.

### 0.04 Product + information architecture — complete

See `PRODUCT.md` and `INFORMATION_ARCHITECTURE.md`.

### 0.05 Visual system — complete

See `DESIGN.md` and `reference/needle-design-inspiration.jpg`.

### 0.06 Import architecture — accepted

See `IMPORT_PIPELINE.md`.

### 0.07 Technical architecture — accepted

See `TECHNICAL_ARCHITECTURE.md` and D-011 in `DECISIONS.md`.

Accepted stack:

- Next.js + TypeScript;
- Cloudflare Workers;
- Cloudflare D1;
- GitHub-connected Cloudflare previews/deployments;
- local Node.js/TypeScript private-history importer;
- Spotify as the primary catalog provider;
- D1/SQL search first;
- R2 only when a concrete non-Spotify need exists.

### 0.08 Roadmap + agent contract — complete

See `START_HERE.md`, `AGENTS.md`, `DECISIONS.md`, and this roadmap.

## Phase 0 exit gate

- [x] private/local source-data path defined;
- [x] date-range audit resolved;
- [x] active Git branch history rewritten to a clean sanitized root;
- [x] archive membership threshold accepted: at least one Full or Near-Complete qualifying session;
- [x] canonical Album/Edition model accepted;
- [x] 10-category Music Type taxonomy accepted;
- [x] Spotify selected as primary metadata/enrichment provider;
- [x] technical architecture recorded;
- [x] approved design reference committed;
- [x] Phase 1 issues created and bounded.

**Phase 1 may begin.**

---

# Phase 1 — Data Foundation

## Goal

Produce a deterministic Needle dataset from the private Spotify export on the accepted Cloudflare architecture.

## Issue sequence

### 1.00 — Scaffold Needle on Next.js + Cloudflare Workers + D1
GitHub: #7

Create the minimal production-shaped runtime, D1 binding/migrations, preview/deploy path, and test/typecheck baseline. Do not build product UI in this issue.

### 1.01 — Import manifest + raw history validation
GitHub: #2

Discover/validate `data/history/Streaming_History_Audio_*.json`, minimize fields, separate music/non-music, validate timestamps, and emit an import report.

### 1.02 — Normalize playback events
GitHub: #3

Normalize accepted music rows, timestamps, Spotify identities, deduplication, and provenance without retaining unnecessary private metadata.

### 1.03 — Reconstruct album listening sessions
GitHub: #4

Encode and validate Full / Near-Complete / Sparse / Review session behavior against the prior workbook.

### 1.04 — Resolve canonical albums and Spotify editions
GitHub: #5

Implement Album vs AlbumEdition identity, edition ambiguity, confidence/review state, and workbook reconciliation.

### 1.05 — Enrich resolved albums from Spotify
GitHub: #6

Fetch accepted Spotify catalog metadata/artwork URLs/destinations with resilient provider handling and required attribution/linkback.

### 1.06 — Implement Music Type taxonomy and genre mapping
GitHub: #8

Implement the accepted 10-category taxonomy, detailed Genre separation, mapping provenance, unclassified states, and manual overrides.

### 1.07 — Build listener summaries and reconcile the imported archive
GitHub: #9

Derive first/last listens, session counts, default Library membership, revisit inputs, PersonalAlbumState protection, and final workbook reconciliation.

## Phase 1 exit gate

- [ ] Next.js app runs locally and in a Cloudflare Workers preview;
- [ ] D1 schema/migrations are established;
- [ ] importer is idempotent;
- [ ] raw history can rebuild the derived dataset;
- [ ] workbook-confirmed counts are reconciled or differences documented;
- [ ] no raw IP/device metadata is in app tables;
- [ ] Spotify links/artwork metadata cover accepted archive records at the agreed rate;
- [ ] Music Type/Genre coverage is measured and gaps are explicit;
- [ ] PersonalAlbumState is isolated from reimport;
- [ ] default Library membership implements D-009 exactly.

---

# Phase 2 — Library

## Goal

Ship the first useful product slice: find a record quickly and understand its history.

Suggested issues:

- 2.01 Application shell + design tokens
- 2.02 Album artwork system
- 2.03 Library cover wall/grid
- 2.04 Search
- 2.05 Filters + sorting
- 2.06 Album detail
- 2.07 Listening-history evidence/timeline
- 2.08 Open in Spotify
- 2.09 Responsive/mobile Library QA

## Phase 2 exit gate

- [ ] real archive data, not placeholder albums;
- [ ] search/filter combinations are fast and correct;
- [ ] artwork remains visually dominant;
- [ ] Album detail explains history without database jargon;
- [ ] resolved records open the intended Spotify edition;
- [ ] mobile and desktop pass design review.

---

# Phase 3 — Explore

## Goal

Make the archive enjoyable to browse without knowing what to search for.

Work includes Music Type, Genre, release decade/year, Artist index, historically derived collection slices, and responsive editorial polish.

Avoid turning Explore into a second filter form.

---

# Phase 4 — History

## Goal

Turn chronological listening evidence into an album-art-forward history.

Work includes year/period exploration, new vs revisited records, first/last heard, long-span records, Music Type/Genre movement, listening eras, and restrained supporting charts.

Editorial language must remain data-grounded.

---

# Phase 5 — Home

## Goal

Build the most expressive Needle surface after the underlying features are trustworthy.

Possible modules:

- featured record from history;
- worth another listen;
- from this time in your history;
- long-term revisit;
- period/era story;
- Music Type/Genre shelf;
- recently revisited.

Home comes after Library/Explore/History so it composes real product primitives rather than hard-coded demo stories.

---

# Phase 6 — V1 Polish + Release

## Goal

Make Needle dependable and intentional rather than merely feature-complete.

Work:

- performance/artwork loading;
- accessibility;
- empty/error/loading states;
- mobile QA;
- metadata/canonical correction workflow;
- import/reimport operational docs;
- production deployment;
- backup/recovery of personal state;
- design-system consistency review.

## V1 stop point

After Phase 6, use Needle before adding major scope. Add ratings, Spotify sync/auth, playlists, or recommendation systems only if they solve an observed problem.

---

# Deferred / post-V1 opportunities

These are intentionally **not active GitHub issues** yet. They are ideas worth preserving without pulling attention away from the current critical path.

## Multi-user import scalability

If Needle is opened to other listeners, keep the current import/resolution model but turn it into a production background workflow rather than a long-running local CLI task.

Desired direction:

- maintain a shared Needle catalog/cache of canonical albums, Spotify editions, track lists, artwork, and release metadata;
- resolve catalog identities once and reuse them across users instead of repeating Spotify lookups for albums Needle already knows;
- use Spotify track IDs from a new import to attach listening evidence to existing catalog records whenever confidence is strong;
- query Spotify only for genuinely new or unresolved catalog identities;
- make imports resumable/idempotent and safe to continue after rate limits or provider failures;
- process work asynchronously with bounded concurrency and provider-aware backoff;
- show visible progress while processing and allow the Library to populate incrementally before the entire import is finished;
- surface unresolved/ambiguous albums as a review queue rather than blocking the whole import;
- preserve strict per-user separation for listening history and PersonalAlbumState while sharing non-personal public catalog metadata;
- target a typical history import in **minutes, not an hour-long blocking experience**, with later users benefiting from the catalog accumulated by earlier imports.

The first personal Needle build may remain intentionally conservative/request-heavy while identity rules are being proven. Do not prematurely optimize Phase 1 at the expense of catalog correctness.