# Home

Home is Needle's rediscovery surface. It is deliberately selective rather than a dashboard.

## Current modules

### From your history

The featured record is the strongest deterministic cross-time record in the current archive, ordered by distinct listening years, qualifying-listen count, recency, then stable identity tie breakers.

The story copy only uses stored first/last meaningful-listen years, distinct listening years, and qualifying-session count.

### Recently revisited

Records must span at least two distinct listening years and are ordered by latest meaningful listen, then listening-year span and qualifying-listen evidence.

### Worth another listen

Records are ordered by the oldest stored last meaningful listen. Home removes duplicates already used by the featured/recent modules before rendering this shelf.

## Runtime boundary

Home reads only current archive-member rows from `albums` and `listener_album_summaries` in D1. It does not read raw playback exports or private import artifacts at request time.

## Product boundary

These modules are explainable archive slices, not recommendations or preference inference. Needle does not claim that an album is a favorite, important, mood-defining, or personally meaningful unless the user explicitly supplies such state later.

Artwork is optional and uses the shared fallback until enrichment populates provider URLs.

## Deferred

- Music Type/Genre shelves after real classification coverage;
- user Favorite/Revisit/notes state;
- seasonal/history-date modules;
- final visual-polish pass.
