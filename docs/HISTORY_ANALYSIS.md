# History Analysis → Product Inputs

## Purpose

The existing workbook is not only a data-cleaning artifact. It contains the foundation for Needle's historical product experiences.

This document translates what the analysis can support into product behavior without inventing qualitative stories that the data has not established yet.

## What the current analysis establishes

### Strong album-level evidence exists

The analysis reviewed 402 album candidates and found:

- 243 albums confirmed complete in at least two sessions;
- 23 confirmed complete once;
- 71 near-complete;
- 49 single-track/sparse;
- 16 review-other.

This means Needle can present historical **evidence strength** rather than treating any one track play as equivalent to listening to an album.

### Repeat-listening can be reconstructed

The workbook includes session-level first/last dates, full-session counts, near-complete counts, total plays, total listening time, and track coverage.

Product uses:

- most revisited records;
- records returned to across multiple years;
- time since last meaningful listen;
- first appearance in history;
- rediscovery after long gaps;
- records with one strong historical period versus repeated long-term presence.

### Catalog/edition identity is partially resolved

349 of the 402 album candidates have a catalog match and Spotify album ID. 53 remain in a dedicated review set.

Product uses:

- reliable Spotify outbound links for resolved records;
- artwork enrichment keyed to a resolved edition;
- clear quarantine/fallback for unresolved records;
- edition-aware history rather than naïve title matching.

### Release dates are available for resolved catalog records

Product uses:

- release decade browsing;
- “old music discovered later” collection slices;
- release-year context on album detail;
- comparisons between release era and listening era.

### The analysis does not currently provide genre or Music Type

This is important because Needle's proposed Explore experience depends on those fields.

Genre/Music Type stories cannot ship from the workbook alone. They require catalog enrichment + a documented Needle taxonomy first.

## Product story patterns supported by current/derived data

The phrases below are **story templates**, not hard-coded claims.

### “It has been a while”

Inputs:

- last qualifying session;
- current date;
- evidence threshold.

Presentation:

- one visually prominent record;
- exact last-listened period;
- related records from the same historical period.

### “One you kept coming back to”

Inputs:

- qualifying session count;
- number of distinct months/years;
- first/last evidence span.

Avoid ranking purely by raw track plays because long albums and repeated individual songs distort that measure.

### “From this time in your history”

Inputs:

- month/day window or historical year;
- qualifying sessions;
- evidence strength.

This can be simple and useful without pretending to infer mood.

### “A record that stayed with you”

Inputs:

- qualifying sessions across a long calendar span;
- repeated appearances separated by meaningful gaps.

### “You found this years after it came out”

Inputs:

- canonical release date;
- first meaningful listening session;
- minimum release-to-discovery gap.

### “A year in records”

Inputs:

- listening year;
- qualifying album set;
- new-to-history vs revisit status;
- listening depth.

Once genre enrichment exists, this can also summarize Music Type movement.

## Stories that require enrichment first

Do not generate these until genre/Music Type coverage is trustworthy:

- “Your year was mostly soul”;
- “You moved from indie rock into hip-hop”;
- genre dominance/change narratives;
- similar-record recommendations based on musical style.

## Stories Needle should avoid

The data does not justify psychological or emotional inference such as:

- “you were sad that winter”;
- “this album got you through…”;
- “you were partying a lot”;
- personality claims based on genre.

Keep editorial language interesting but grounded in observable listening history.

## History confidence model

Needle should distinguish at least:

1. **strong album evidence** — full qualifying session(s);
2. **moderate album evidence** — near-complete session(s);
3. **weak presence evidence** — isolated/sparse tracks;
4. **catalog uncertainty** — album/edition unresolved.

Editorial Home/History stories should default to stronger evidence. Weak evidence may remain searchable/reviewable without being promoted as a meaningful album listen.

## 1.03 encoded reference behavior

Issue 1.03 replaces the workbook as the runtime sessionization dependency while keeping the workbook as a calibration reference.

The encoded local evidence rules are documented in `SESSIONIZATION.md`: 30 seconds for meaningful track evidence, explicit skipped-state handling for credible coverage, Full/Near-Complete/Sparse/Review status, a 15-minute same-source-album gap boundary, and repeated qualifying evidence for provisional candidate selection.

The current private-history calibration intentionally does not force an exact workbook match:

- 401 provisional candidate albums versus 402 workbook candidates;
- 2,035 Full/Near-Complete sessions versus 2,012 workbook session rows;
- 1,302 Full sessions versus 1,324 locally complete workbook sessions;
- 733 Near-Complete sessions versus 688 locally near-complete workbook sessions.

The difference is recorded rather than hidden because 1.03 preserves provisional source album/title grouping. Some workbook grouping depends on title/edition decisions that belong to the later canonical Album / AlbumEdition stage.

## Analysis maintenance

The workbook should be treated as a reference implementation, not the permanent runtime dependency.

Phase 1 should encode the accepted logic in reproducible import/sessionization code with tests and sanitized fixtures. Once that implementation is validated against the workbook, the database can become the normal application source of truth.
