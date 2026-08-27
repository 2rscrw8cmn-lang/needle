# Explore

Explore is Needle's browse-without-a-target surface. The first implementation uses only real archive evidence already available before Spotify enrichment finishes.

## Current sections

### By decade

Release-decade counts come from current archive-member canonical albums with a known four-digit original release year. Each decade links into the existing Library `decade` filter.

### Records that stayed with you

This artwork-first shelf contains current archive albums whose listener summary spans at least two distinct listening years. It is ordered by listening-year span, qualifying-listen count, recency, then stable identity tie breakers.

The shelf is evidence-based. It does not infer favorites, ratings, or taste.

### Artists

The artist index counts current archive-member albums by canonical primary artist. Artist names link into the existing Library search rather than creating a second search system.

## Runtime boundary

Explore reads `albums` and `listener_album_summaries` from D1. It does not read raw playback exports or private `.needle` artifacts at request time.

## Enrichment boundary

Music Type and Genre sections are intentionally absent until the real 1.05/1.06 enrichment/classification pass provides reviewed coverage. Missing artwork continues to use the shared fallback primitive and will populate automatically when `artwork_url` is loaded into D1.

## Deferred

- Music Type shelves;
- Genre browsing;
- richer historical collection slices;
- semantic recommendations;
- final visual-polish pass.
