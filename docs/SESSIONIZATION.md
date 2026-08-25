# Album Session Reconstruction

## Purpose

Issue 1.03 turns Needle's normalized Spotify playback events into reproducible album-listening evidence.

The private analysis workbook remains a **reference implementation**, not a runtime dependency. The sessionizer encodes the evidence rules we can validate from that workbook while intentionally leaving canonical album/edition resolution to later catalog work.

## Run locally

After 1.01 validation and 1.02 normalization:

```bash
npm run history:sessionize
```

By default the command reads `data/history/.needle/normalized-playback-events.json` plus its normalization report and writes:

```text
data/history/.needle/
├── album-sessions.json
├── provisional-albums.json
├── sessionization-report.json
└── sessionization-report.md
```

All of these are private generated artifacts and remain Git-ignored.

## Fixed 1.03 rules

The current sessionization constants are explicit and versioned in code:

| Rule | Value |
| --- | ---: |
| Same-source-album event gap | 15 minutes |
| Meaningful play threshold | 30 seconds |
| Minimum locally known tracks | 5 |
| Near-Complete minimum credible coverage | 80% |
| Near-Complete maximum missing local tracks | 2 |
| Provisional candidate minimum qualifying sessions | 2 |

### Meaningful vs credible evidence

A track contributes **meaningful** evidence when at least 30,000 ms were played.

A meaningful track contributes **credible** album coverage only when the playback event is not marked `skipped=true`.

`reason_end=trackdone` is retained as a separate signal and does not override an explicit skipped flag. This distinction reproduces cases visible in the workbook where a track may reach `trackdone` but still not count as credible coverage.

## Source album grouping

1.03 needs a stable provisional grouping before canonical catalog resolution exists.

It therefore groups events using a normalized source key built from the Spotify-exported album artist and album display strings. The normalization removes superficial case, punctuation, whitespace, and diacritic differences.

It deliberately **does not** collapse edition labels such as Deluxe, reissue, live, or materially different release names. That work belongs to canonical Album / AlbumEdition resolution.

Examples:

- `Not to Disappear` and `Not To Disappear` can share a source key.
- `PHOX` and `PHOX (Deluxe Version)` remain distinct at 1.03.

## Provisional track keys

Track coverage also needs a pre-catalog key. 1.03 normalizes source track titles for local evidence only:

- case/punctuation/diacritic differences collapse;
- a terminal remaster/remastered suffix is ignored;
- Spotify track ID remains preserved independently in the playback event model.

These keys are **not canonical Track identities**. Later catalog resolution may refine or replace them.

## Session continuity

Playback events are ordered deterministically by `played_at`, then stable `event_id`.

A source album run continues while:

- positive-duration events remain on the same provisional source album; and
- the event timestamp gap does not exceed 15 minutes.

A positive-duration event from another source album breaks the current run, even when that interruption is short.

Zero-ms rows are treated conservatively:

- a zero-ms event for the current source album can remain attached as continuity evidence when it is within the gap;
- a zero-ms event for another album is ignored as control/noise and does not split the run.

Every positive-duration normalized event must reconcile into exactly one source run before any album-candidate filtering occurs.

## Evidence classification

For each source run, 1.03 compares credible unique tracks with the album's locally observed meaningful track set.

### Full

- at least 5 locally known tracks; and
- credible coverage includes every locally known track.

### Near-Complete

- at least 5 locally known tracks;
- credible coverage is at least 80%; and
- no more than 2 locally known tracks are missing.

### Sparse

Zero or one credible locally known track.

### Review

Other non-qualifying runs that contain more than sparse evidence but do not reach Near-Complete.

The session record retains the inputs needed to explain the classification: local track count, meaningful/credible/trackdone keys, missing-track keys, coverage, event IDs, and review reasons.

## Provisional album candidates

The workbook's 402 analyzed album candidates are not every album-shaped source label in the raw history. Calibration shows that they correspond closely to albums with repeated meaningful local evidence.

1.03 therefore promotes a provisional source album into `provisional-albums.json` when it has at least **two Full or Near-Complete sessions**.

Once an album qualifies, `album-sessions.json` retains all of that candidate's source runs, including Sparse and Review runs. This keeps weaker historical evidence available without making it equivalent to a qualifying listen.

This provisional-candidate rule is an importer/sessionization rule. It is **not the final Library membership rule**. D-009 still controls default Library membership after the later album-resolution and summary stages.

## Stable IDs and reimport behavior

A session ID is derived from:

- the stable provisional source-album key; and
- the ordered stable playback `event_id` values in the run.

The current import batch ID is kept separately as provenance. The same historical run therefore receives the same session ID when the same normalized events appear in a later export.

## Real-history calibration

The current private history was run through 1.01 → 1.02 → the 1.03 implementation without committing private artifacts.

| Metric | Workbook reference | 1.03 | Delta |
| --- | ---: | ---: | ---: |
| Provisional/candidate albums | 402 | 401 | -1 |
| Qualifying Full + Near sessions | 2,012 | 2,035 | +23 |
| Full / locally complete | 1,324 | 1,302 | -22 |
| Near-Complete / locally near-complete | 688 | 733 | +45 |

The 1.03 run also produced:

- 278,896 normalized events checked against the 1.02 report;
- 272,965 positive-duration events assigned exactly once to source runs;
- 5,931 zero-ms events reconciled as continuity rows or ignored noise;
- 188,221 total source runs before candidate filtering;
- 40,832 retained runs across the 401 provisional candidate albums.

### Why the result is not forced to 2,012

The difference is intentional and visible.

The old workbook contains some album-title/edition grouping decisions that are broader than the 1.03 source-label contract. Comparing normalized candidate labels shows overlapping but non-identical sets rather than one literal missing album. Examples include standard vs deluxe labels and other title variants.

Forcing exact workbook totals here would require silently introducing catalog/edition assumptions before Issue 1.04. Instead, 1.03 keeps deterministic source evidence intact and reports the deviation. Canonical Album / Spotify AlbumEdition resolution can then explain or merge those variants explicitly.

## Privacy boundary

1.03 reads only the 1.02 normalized playback representation. It does not re-read raw Spotify export rows and cannot recover discarded IP address, device/platform, country, offline, incognito, podcast, or audiobook fields.

Generated session data is still private listening history and must not be committed.

## Product boundary

`evidence_status` describes historical listening evidence only.

It does not directly set:

- default Library membership;
- favorites or revisit state;
- personal ratings;
- canonical album identity;
- Spotify edition identity;
- UI placement.

Those remain separate derived or personal-state concerns by design.
