# Start Here

## What Needle is

Needle is a personal music-history archive built around albums rather than a stream of track plays.

The core loop is:

**discover → explore → remember → revisit → listen on Spotify**

Needle should make a long listening history enjoyable to browse and useful to return to. The application should feel like a contemporary editorial music archive, not an analytics dashboard or a Spotify clone.

## V1 product surfaces

- **Home** — editorial rediscovery from real listening history
- **Library** — fast, searchable, filterable album collection
- **Explore** — browse by Music Type, genre, artist, release decade, and other collection facets
- **History** — see how listening changed over time
- **Album** — artwork, metadata, listening evidence/history, and a Spotify destination

## Locked product principles

1. **Album artwork is the primary visual material.** UI chrome stays quiet.
2. **Needle is an archive, not a player.** Spotify handles playback.
3. **Albums and listens are different things.** Repeat listening must remain first-class history.
4. **Canonical album and Spotify edition are different things.** Deluxe, remaster, reissue, and re-recording ambiguity must be preserved rather than flattened blindly.
5. **Music Type and Genre are separate.** Music Type is the broad browsing layer; Genre may be detailed/multi-valued.
6. **Home and History may be editorial. Library must remain highly functional.**
7. **Product stories must come from real data.** Do not hard-code fake history such as “your 2019 was loud.”
8. **Visual quality is a product requirement, not cleanup work.**
9. **Raw Spotify source data is ingestion material, not application data.** Personally identifying fields should not flow into the Needle database.

## V1 exclusions

Do not add these unless an accepted decision changes the scope:

- Spotify authentication or continuous sync
- in-app music playback
- social/friends/following
- playlist creation
- recommendation engine based on the open internet/Spotify taste graph
- AI chat
- multi-user accounts
- complex manual metadata editing
- dashboard-style stat overload

## Before working on any issue

1. Read this file.
2. Read [`PRODUCT.md`](PRODUCT.md).
3. Read the relevant domain doc.
4. Check [`DECISIONS.md`](DECISIONS.md).
5. Read the GitHub issue completely.
6. Do not broaden scope beyond the issue.

## Current phase

**Phase 0 — Foundation.**

Do not scaffold the application until the Phase 0 exit gate in [`ROADMAP.md`](ROADMAP.md) is satisfied.
