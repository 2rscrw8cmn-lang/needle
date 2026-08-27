# Home

Home is Needle's rediscovery surface. It is deliberately selective rather than a dashboard.

## Current modules

### From your history

The featured record is the strongest deterministic cross-time record in the current archive, ordered by distinct listening years, combined Full/Near-Complete session evidence, recency, then stable identity tie breakers.

The story copy only surfaces **Full Play / Full Plays** as the product count. Full Plays map to `full_session_count` only; Near-Complete sessions are not relabeled as Full Plays.

### Recently revisited

Records must span at least two distinct listening years and are ordered by latest meaningful listen, then listening-year span and combined Full/Near-Complete evidence.

### Worth another listen

Records are ordered by the oldest stored last meaningful listen. Home removes duplicates already used by the featured/recent modules before rendering this shelf.

## Runtime boundary

Home reads only current archive-member rows from `albums` and `listener_album_summaries` in D1. It does not read raw playback exports or private import artifacts at request time.

## Product boundary

These modules are explainable archive slices, not recommendations or preference inference. Needle does not claim that an album is a favorite, important, mood-defining, or personally meaningful from playback history alone.

Explicit listener-owned state now exists on Album detail as **Favorite**, **Revisit**, and **Review**. Review is the product term even though the preserved storage column is `personal_album_state.notes`.

Artwork is optional and uses the shared fallback until enrichment populates provider URLs.

## Deferred

- Music Type/Genre shelves after real classification coverage;
- using Favorite/Revisit/Review state to shape Home modules;
- seasonal/history-date modules;
- final visual-polish pass.
