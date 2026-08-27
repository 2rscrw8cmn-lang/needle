# Music Type Taxonomy

## Purpose

Issue 1.06 turns detailed genre evidence into Needle's broad, stable **Music Type** taxonomy without collapsing Genre and Music Type into the same field.

Music Type is a browsing/editorial category. Genre remains detailed, multi-valued source metadata.

## Accepted Music Types

Taxonomy version 1 contains exactly ten values:

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

These values are exported from `lib/taxonomy/music-types.ts`. Product/UI code should consume the canonical constants rather than redefining labels locally.

## Inputs

1.06 reads the 1.05 enrichment artifacts:

```text
data/history/.needle/
├── spotify-album-enrichment.json
└── spotify-artist-enrichment.json
```

It may also read an optional persistent local override file:

```text
data/history/music-type-overrides.json
```

The override file lives **outside** `.needle/` so generated import outputs never overwrite it.

## Command

```bash
npm run history:classify-music-types
```

Options:

```text
--input <dir>
--output <dir>
--overrides <file>
```

## Outputs

Generated outputs remain in the ignored `.needle/` directory:

```text
album-music-type-classifications.json
genre-catalog.json
music-type-taxonomy-report.json
music-type-taxonomy-report.md
```

## Classification rules

Genre mapping is deterministic and versioned independently from the taxonomy:

- taxonomy version: `1`
- genre mapping version: `1`

Each detailed genre is normalized and matched against explicit phrase rules. More-specific phrases outrank generic phrases. This allows cases such as `pop rock` to resolve to Rock without a generic `pop` rule winning merely because the word appears in the label.

Representative mappings include:

| Detailed genre | Music Type |
| --- | --- |
| alternative rock, indie rock, shoegaze | Rock |
| indie pop, electropop, synthpop | Pop |
| hip hop, rap, trap, drill | Hip-Hop |
| R&B, neo soul, funk, soul | R&B / Soul |
| house, techno, ambient, electronica | Electronic |
| jazz, bebop, swing | Jazz |
| country, americana, bluegrass, folk | Country / Folk |
| metal, metalcore, hardcore, screamo | Heavy |
| reggae, afrobeat, reggaeton, salsa | Global |
| classical, film score, soundtrack, opera | Classical / Soundtrack |

A detailed genre remains visible even after it contributes to a broad Music Type classification.

## Album-level decision

An album collects genre evidence from its enriched Spotify artists. Each mapped detailed genre contributes one vote to a Music Type.

Needle classifies automatically only when one Music Type has a unique highest vote.

Possible statuses are:

- `classified` — one automatic Music Type wins;
- `manual_override` — a persistent explicit override supplies the final Music Type;
- `unclassified_no_genres` — no detailed genre evidence exists;
- `unclassified_unmapped` — genres exist but no versioned mapping rule covers them;
- `unclassified_ambiguous` — mapped evidence does not produce a unique winner.

Needle does **not** break ties using album title, artist name, listening frequency, artwork, or inferred taste.

## Genre provenance

Detailed genre evidence retains source provenance back to the Spotify artist record that supplied it, including:

- provider;
- Spotify artist ID;
- enrichment timestamp.

`genre-catalog.json` deduplicates normalized detailed genres while retaining the artists and canonical albums in which each genre appeared.

## Current Spotify limitation

The current 1.05 implementation intentionally does not make additional artist requests solely to populate Spotify's deprecated genre field. Therefore a real first pass may contain many or even all albums as `unclassified_no_genres`.

That outcome is valid. It quantifies a coverage limitation rather than hiding it.

Do not add a second metadata provider or infer genres simply to make the report look complete. 1.07 should measure the real coverage and surface whether the demonstrated gap warrants a later product/data decision.

## Manual overrides

Manual overrides are broad Music Type decisions, not replacement genre metadata.

Example:

```json
{
  "version": 1,
  "overrides": [
    {
      "canonical_album_id": "alb_example",
      "music_type": "Rock",
      "note": "Reviewed manually",
      "updated_at": "2026-08-27T13:00:00.000Z"
    }
  ]
}
```

Rules:

- override targets use stable canonical album IDs from 1.04;
- the importer reads this file but never generates or overwrites it;
- automatic genre evidence and vote counts remain in the output even when an override wins;
- duplicate override targets are invalid reconciliation;
- an override targeting a missing canonical album is surfaced as an orphan and fails reconciliation so it can be reviewed.

This makes reimports reproducible without erasing manual decisions.

## 1.06 / 1.07 boundary

1.06 owns taxonomy constants, genre mapping, evidence/provenance, ambiguity, and manual override behavior.

1.07 owns final Phase 1 reconciliation, cross-stage coverage, Library readiness, and the persistence/import contract into D1.
