# Decisions

Use this log for product/architecture decisions that agents should not silently revisit.

Statuses:

- **Accepted** — work should conform to it until explicitly changed.
- **Proposed** — recommended direction awaiting explicit acceptance or validation.
- **Deferred** — intentionally not being decided yet.

---

## D-001 — Product name

**Status:** Accepted

The working product name is **Needle**.

---

## D-002 — Product role

**Status:** Accepted

Needle is a personal music-history archive, not a music player. Spotify is the outbound playback destination.

---

## D-003 — Visual hierarchy

**Status:** Accepted

Album artwork is the primary visual material. The design direction is modern editorial with a restrained vintage influence.

The approved inspiration image is a mood/composition reference, not a literal wireframe.

Explicitly rejected: burgundy-led palette, conventional SaaS dashboard styling, fake vinyl/player graphics, and permanent admin sidebar treatment.

---

## D-004 — Album identity model

**Status:** Accepted

Canonical Album, Spotify AlbumEdition, PlaybackEvent, and AlbumSession are separate concepts.

Edition ambiguity must be preserved rather than flattened by album-title string matching.

---

## D-005 — Repeat listening

**Status:** Accepted

Listening history is event/session based. One album may have many meaningful sessions across years. Needle must preserve that history.

---

## D-006 — Music Type vs Genre

**Status:** Accepted

Needle maintains both:

- **Music Type** — broad stable browsing category;
- **Genre** — detailed, multi-valued metadata.

Music Type is not a synonym for Genre.

---

## D-007 — V1 Spotify integration

**Status:** Accepted

V1 links out to Spotify. It does not require Spotify authentication for playback, continuous history sync, playlist creation, or in-app playback.

Spotify API access may be used server-side during import/enrichment for catalog metadata.

---

## D-008 — Private history source location

**Status:** Accepted

The real Spotify extended history and the prior personal analysis workbook are **local/private ingestion inputs**, not repository assets.

Canonical local path:

```text
data/history/
├── Streaming_History_Audio_*.json
└── spotify_album_history_analysis.xlsx
```

The directory contents are Git-ignored except its README.

Active repository history was rewritten to remove the previously committed source files. GitHub-hosted caches or pull-request refs outside rewritten branch history may require separate platform-side cleanup.

---

## D-009 — Default Library membership threshold

**Status:** Accepted

An album belongs in the default Needle Library when the history contains **at least one Full or Near-Complete qualifying album session**.

Import still preserves weaker evidence so sparse/review records can be inspected or used in history without being promoted into the main Library.

Based on the current workbook classification, this policy corresponds to approximately **337 of the 402 analyzed album candidates**:

- 243 confirmed complete at least twice;
- 23 confirmed complete once;
- 71 near-complete.

Sparse/single-track and unresolved review candidates remain in the derived dataset but are not default Library members.

---

## D-010 — Personal ratings

**Status:** Deferred

The current history analysis does not contain personal ratings. Do not fabricate or infer ratings from listening behavior.

If ratings are later added, store them in PersonalAlbumState and keep them independent of imported listening evidence.

---

## D-011 — Technical stack

**Status:** Accepted

Needle uses a Cloudflare-first architecture:

- **application:** Next.js + TypeScript;
- **runtime/hosting:** Cloudflare Workers;
- **database:** Cloudflare D1;
- **deployment:** GitHub-connected Cloudflare Workers Builds / preview deployments;
- **private import runtime:** local Node.js/TypeScript tooling reading `data/history/`;
- **object storage:** Cloudflare R2 only when a concrete non-Spotify artifact/storage need exists;
- **search/filtering:** D1/SQL first; add another search service only if real usage requires it.

The exact Cloudflare adapter/build integration should follow current Cloudflare guidance at scaffold time rather than being permanently pinned in this decision log.

See `TECHNICAL_ARCHITECTURE.md`.

---

## D-012 — Home implementation order

**Status:** Accepted

Build Home after Library, Explore, and History primitives exist. Home should compose real history capabilities rather than begin as a hard-coded visual demo.

---

## D-013 — Workbook date-range audit

**Status:** Accepted / resolved

Direct inspection of `Session Details` confirms the current workbook ranges from **2012-07-03 18:36:55 UTC** through **2026-08-23 17:09:54 UTC**.

The earlier reported October 2026 session was an audit-side Excel serial conversion error, not a future source event. Future-date validation remains part of the importer as a general data-quality guardrail.

---

## D-014 — Music Type taxonomy

**Status:** Accepted

Needle V1 uses ten broad Music Types:

1. Rock
2. Pop
3. Hip-Hop
4. R&B / Soul
5. Electronic
6. Jazz
7. Country / Folk
8. Heavy
9. Global
10. Classical / Soundtrack

Detailed Genre remains multi-valued beneath Music Type. Genre-to-Type mapping is a data/taxonomy concern, not component logic. Manual overrides must be possible when metadata is ambiguous.

---

## D-015 — Catalog and enrichment source

**Status:** Accepted

Spotify is the primary external catalog/enrichment source for V1.

Use Spotify for resolved album identity, artwork URL, release metadata, artist/track metadata, and outbound Spotify destination where available.

Spotify genre metadata may be used when available, but because genre fields can be incomplete or deprecated, Needle must tolerate missing genre data and preserve manual taxonomy overrides rather than inventing genres.

Do not add a second metadata provider until a demonstrated coverage problem requires one.

Spotify-provided visual content must remain linked/attributed according to the current Spotify developer policy. Do not persist/copy Spotify artwork into R2 by default.

---

## D-016 — Git history privacy remediation

**Status:** Accepted / completed for active branch history

On 2026-08-25, Needle's active repository history was rewritten to a new sanitized parentless root commit after the raw Spotify history and analysis workbook were removed from the tracked tree.

`main` and the active docs branches were repointed to the clean history.

Rules after the rewrite:

- raw history/workbook files remain ignored and local-only;
- any collaborator with an old clone should re-clone or hard-reset rather than pushing old history back;
- GitHub-hosted orphaned objects, caches, or pull-request refs are outside active branch history and may require GitHub platform/support cleanup if they remain directly accessible.
