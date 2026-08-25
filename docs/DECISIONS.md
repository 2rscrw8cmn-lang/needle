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

Needle will maintain both:

- **Music Type** — broad stable browsing category;
- **Genre** — detailed, multi-valued metadata.

Music Type is not a synonym for Genre.

---

## D-007 — V1 Spotify integration

**Status:** Accepted

V1 links out to Spotify. It does not require Spotify authentication, continuous history sync, playlist creation, or in-app playback.

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

The directory contents are Git-ignored except its README. The Phase 0 branch no longer tracks either source type.

Previously public commits may still contain copies. Historical Git remediation remains a separate decision; `.gitignore` is not retroactive privacy protection.

---

## D-009 — Default Library membership threshold

**Status:** Proposed / unresolved

Import should preserve all usable candidate evidence. The default Library may apply a stronger threshold.

Candidate policy to evaluate:

- show Full and Confirmed-once records by default;
- include Near-complete through an explicit evidence policy;
- keep sparse/review candidates searchable/reviewable without promoting them as strong album listens.

Do not hard-code this until accepted.

---

## D-010 — Personal ratings

**Status:** Deferred

The current history analysis does not contain personal ratings. Do not fabricate or infer ratings from listening behavior.

If ratings are later added, store them in PersonalAlbumState and keep them independent of imported listening evidence.

---

## D-011 — Technical stack

**Status:** Deferred

Framework, database, hosting, metadata provider, genre source, and import runtime will be selected after Phase 0 data/product contracts are accepted.

---

## D-012 — Home implementation order

**Status:** Accepted

Build Home after Library, Explore, and History primitives exist. Home should compose real history capabilities rather than begin as a hard-coded visual demo.

---

## D-013 — Workbook date-range audit

**Status:** Accepted / resolved

Direct inspection of `Session Details` confirms the current workbook ranges from **2012-07-03 18:36:55 UTC** through **2026-08-23 17:09:54 UTC**.

The earlier reported October 2026 session was an audit-side Excel serial conversion error, not a future source event. Future-date validation remains part of the importer as a general data-quality guardrail.
