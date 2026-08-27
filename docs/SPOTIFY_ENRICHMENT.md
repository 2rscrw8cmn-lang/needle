# Spotify Enrichment

## Purpose

Issue 1.05 enriches the accepted canonical albums produced by 1.04 with the Spotify metadata Needle needs for Library, Explore, History, and Album detail.

1.05 does **not** decide album identity. It consumes the preferred Spotify AlbumEdition already selected by 1.04. A failed enrichment request never invalidates or deletes a resolved canonical Album.

## Command

After 1.04 has completed successfully:

```bash
npm run history:enrich-albums
```

Live mode uses the same local credentials as catalog resolution:

```text
SPOTIFY_CLIENT_ID
SPOTIFY_CLIENT_SECRET
SPOTIFY_MARKET=US
```

Credentials remain local and must never be committed.

## Inputs

From `data/history/.needle/`:

```text
canonical-albums.json
spotify-album-editions.json
```

Only canonical albums whose `review_status` is `accepted` are enrichment targets. Needle follows each accepted canonical album's `preferred_edition_id` to the Spotify AlbumEdition selected by 1.04.

Review/ambiguous canonical records are intentionally not enriched until identity is accepted.

## Outputs

Generated private artifacts remain under the ignored `.needle/` directory:

```text
spotify-album-enrichment.json
spotify-artist-enrichment.json
spotify-track-enrichment.json
spotify-enrichment-review.json
spotify-enrichment-report.json
spotify-enrichment-report.md
spotify-enrichment-cache.json
```

The cache contains public Spotify catalog metadata only. It never contains the Spotify client secret or private listening-history fields.

## Album metadata

For each accepted preferred edition, Needle stores the normalized subset needed by the product:

- canonical Album ID and AlbumEdition ID;
- Spotify album ID;
- album name/type;
- release date and release-date precision;
- track count;
- outbound Spotify album URL;
- Spotify artwork source URLs and dimensions;
- primary artwork URL reference;
- artist IDs;
- track IDs;
- whether the full track listing was retrieved;
- market, provider, and enrichment timestamp.

Artwork remains a provider URL/reference. Needle does not copy Spotify artwork into R2.

## Artist metadata

The album response supplies the artist identity required by Needle:

- Spotify artist ID;
- artist name;
- outbound Spotify artist URL.

Spotify currently marks artist `genres` as deprecated. 1.05 therefore does not spend additional Development Mode quota calling artist endpoints solely to populate a deprecated genre field. Genre absence is explicit (`genre_status = unavailable_from_album_response`) and remains unclassified for 1.06 rather than being guessed.

This preserves the D-006/D-015 rule that Genre and Music Type require real provenance.

## Track metadata

The full Spotify album response supplies the first page of track metadata. Needle retains:

- Spotify track ID;
- title;
- disc number;
- track number;
- duration;
- explicit flag;
- outbound Spotify track URL;
- artist IDs.

If an album has more tracks than the album response includes, Needle fetches the remaining album-track pages. Most normal albums therefore require a single catalog request for all 1.05 metadata.

## Quota-aware design

Spotify Development Mode has a quota system separate from the rolling rate limit. 1.05 is deliberately request-light:

1. enrich only accepted preferred editions, not every candidate edition;
2. use the full single-album response for artwork, release, artist identity, and the first track page;
3. fetch extra album-track pages only when the album contains more tracks than the first page;
4. do not call deprecated multi-album/multi-artist endpoints;
5. do not make artist calls solely for deprecated genre metadata;
6. persist each successful album response immediately to `spotify-enrichment-cache.json`.

If Spotify returns `429` with `reason = QUOTA_EXCEEDED`, Needle stops immediately, preserves the cache, reports the approximate retry time, and does not write misleading partial enrichment outputs. A later run resumes from the cache.

Normal short-term `429` responses still respect `Retry-After` and retry with bounded waits.

## Idempotence and failure behavior

The enrichment cache is keyed by Spotify album ID. Re-running the same accepted 1.04 dataset reuses cached public metadata rather than refetching it.

Missing/failed albums are recorded in `spotify-enrichment-review.json` with an explicit reason. They remain valid canonical records from 1.04 and can be retried later.

Structural reconciliation requires:

- every accepted canonical album to be either enriched or represented by an explicit failure;
- unique Spotify album enrichment IDs;
- unique artist IDs;
- unique track IDs.

Coverage gaps such as missing artwork or an incomplete track listing are measured rather than silently treated as complete.

## Spotify display policy

Spotify metadata and visual content must retain applicable attribution and linkback. Needle therefore stores outbound Spotify URLs alongside provider metadata/artwork references.

Spotify visual content must remain in its original form. 1.05 does not introduce an R2 artwork mirror or create derivative Spotify artwork.

## D1 boundary

1.05 creates deterministic normalized enrichment artifacts and a resumable provider cache. The consolidated write of rebuilt personal-history/catalog data into D1 belongs with the final Phase 1 reconciliation/import work, so a partially completed 1.05 run never mutates application state.

This keeps provider fetching independently restartable and preserves the rule that external enrichment failure cannot destroy accepted album identity.

## Fixture mode

Tests can run without live credentials:

```bash
npm run history:enrich-albums -- --catalog-fixture <fixture.json>
```

Fixtures must be invented/sanitized and contain no private listening history.
