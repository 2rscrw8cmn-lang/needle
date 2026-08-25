# Roadmap

## Operating principle

Needle should be built in vertical, reviewable work packages:

**one meaningful issue → one branch → one PR → verify → merge**

The roadmap defines phase outcomes. GitHub issues define bounded implementation work.

---

# Phase 0 — Foundation

## Goal

Agree on what Needle is, what the source data means, how identity/evidence work, and what visual/technical constraints agents must honor before app code begins.

### 0.01 Dataset audit

Status: **documented; core audit complete**

Deliverable: `DATA_AUDIT.md`

Resolved:

- raw source data has a local-only home at `data/history/`;
- raw JSON files and the analysis workbook are no longer tracked on the Phase 0 branch;
- the apparent October 2026 session was an audit conversion error; the actual latest session is 2026-08-23;
- source-field privacy/minimization requirements are documented.

Remaining:

- decide whether to rewrite old Git history / otherwise remediate the previously public source commits;
- verify final import inventory/counts when the production importer is implemented.

### 0.02 Canonical data model

Status: **proposed foundation**

Deliverable: `DATA_MODEL.md`

Exit checks:

- canonical Album separate from AlbumEdition;
- PlaybackEvent separate from AlbumSession;
- PersonalAlbumState protected from reimport;
- archive membership not conflated with ingestion.

### 0.03 History analysis → product

Status: **documented**

Deliverable: `HISTORY_ANALYSIS.md`

### 0.04 Product + information architecture

Status: **documented**

Deliverables:

- `PRODUCT.md`
- `INFORMATION_ARCHITECTURE.md`

### 0.05 Visual system

Status: **documented**

Deliverables:

- `DESIGN.md`
- `reference/needle-design-inspiration.jpg`

### 0.06 Import architecture

Status: **proposed foundation**

Deliverable: `IMPORT_PIPELINE.md`

### 0.07 Technical architecture

Status: **not selected**

Decide after the data/product contracts are accepted. Record:

- web framework/runtime;
- database;
- hosting;
- import execution environment;
- artwork/Spotify metadata enrichment;
- genre enrichment source;
- search/filter approach;
- image caching strategy;
- deployment environments;
- secrets/private-source-data handling.

Do not choose technology solely because another project uses it.

### 0.08 Roadmap + agent contract

Status: **documented**

Deliverables:

- `START_HERE.md`
- `AGENTS.md`
- `DECISIONS.md`
- this roadmap.

## Phase 0 exit gate

Application scaffolding may begin when all are true:

- [x] private/local source-data path is defined and source files are untracked on the Phase 0 branch;
- [x] date-range audit is resolved;
- [ ] historical Git/privacy remediation is explicitly accepted, deferred, or completed;
- [ ] archive membership threshold is accepted;
- [ ] canonical Album/Edition model is accepted;
- [ ] Music Type taxonomy approach is accepted;
- [ ] enrichment provider(s) are selected;
- [ ] technical architecture is recorded in `DECISIONS.md`;
- [x] approved design reference is committed;
- [ ] Phase 1 issues are created and bounded.

---

# Phase 1 — Data Foundation

## Goal

Produce a deterministic Needle dataset from the private Spotify export.

Suggested issues:

### 1.01 Import manifest + raw validation
- read `data/history/Streaming_History_Audio_*.json`;
- validate schema/timestamps;
- separate music from podcast/audiobook rows;
- quarantine invalid/impossible future events;
- emit an import report.

### 1.02 Playback normalization
- normalized UTC timestamps;
- Spotify track identity;
- deduplication rules;
- minimized stored fields.

### 1.03 Album sessionization
- reproduce/validate workbook session behavior;
- Full/Near/Sparse/Review classification;
- deterministic tests.

### 1.04 Canonical album + edition resolution
- Album vs AlbumEdition;
- preferred Spotify edition;
- ambiguity/review state;
- validate against workbook Catalog Matches.

### 1.05 Catalog enrichment
- artwork;
- canonical/preferred release metadata;
- genre source;
- caching/persistence.

### 1.06 Music Type taxonomy
- controlled taxonomy;
- genre → Music Type mapping;
- provenance;
- manual overrides.

### 1.07 Listener summaries + import validation
- first/last heard;
- session counts;
- archive classification;
- aggregate comparisons against workbook;
- sanitized fixtures.

## Phase 1 exit gate

- [ ] importer is idempotent;
- [ ] raw history can rebuild the derived dataset;
- [ ] workbook-confirmed counts are reconciled or differences documented;
- [ ] no raw IP/device metadata is in app tables;
- [ ] Spotify links/artwork cover accepted archive records at target rate;
- [ ] Music Type/Genre coverage meets accepted threshold;
- [ ] PersonalAlbumState is isolated from reimport.

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
