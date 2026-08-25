# Product

## Product statement

Needle is a personal, visual archive of albums a listener has spent meaningful time with over years of Spotify history.

Spotify is optimized for finding and playing music now. Needle is optimized for remembering what was heard, seeing how taste changed, rediscovering records, and exploring a personal catalog as a collection.

## Jobs to be done

Needle should make it easy to:

- find an album from the listener's history;
- browse the archive without already knowing what to search for;
- understand when and how often an album appeared in listening history;
- explore the archive by broad Music Type, detailed genre, artist, release era, and listening period;
- surface records that were important, repeatedly revisited, or have not been heard in a long time;
- jump directly to the correct Spotify album when the listener wants to hear it again.

## Product surfaces

### Home — rediscover

Home is the most editorial surface. It should assemble real data into a small number of useful stories and visual entry points.

Examples of valid story patterns once supported by data:

- a record repeatedly revisited across years;
- albums from the same point in listening history;
- a release era that became unusually prominent;
- records with strong historical evidence that have not appeared recently;
- a cluster of records from one Music Type or genre during a period.

Home is not a KPI dashboard.

### Library — find

Library is the complete working collection and should prioritize speed and clarity.

Required capabilities:

- artwork-first grid/shelf presentation;
- search by album and artist;
- filters that can be combined;
- sorting;
- a clear path into Album detail.

Expected V1 filters, subject to enrichment coverage:

- Music Type;
- genre;
- artist;
- release decade/year;
- listening year/period;
- listening evidence/classification.

Personal flags such as Favorite and Revisit may be included once persistence is established. Ratings are not assumed to exist in the historical dataset.

### Explore — browse

Explore should feel closer to browsing a record collection than operating a filter form.

Primary entry points:

- Music Type;
- genre;
- artist;
- release decade;
- historically meaningful collection slices.

Artwork mosaics and shelves should carry the page visually.

### History — understand

History should combine chronological browsing with restrained analysis.

Useful views include:

- archive by listening year;
- first/last appearance of records;
- repeat-listening patterns;
- Music Type/genre movement over time once enriched;
- listening eras derived from the data;
- notable changes or returns to older records.

Charts are supporting material, not the product's main visual language.

### Album — remember and leave

Album detail should answer:

- What record is this?
- When did it appear in my history?
- How strong is the evidence that I listened to the album as an album?
- How often did I return to it?
- Which Spotify edition is Needle linking to?
- What nearby records in my own archive might I want to browse next?

The primary outbound action is **Open in Spotify**.

## V1 success criteria

V1 is successful when the listener can:

1. load the historical archive from the source export;
2. browse a visually compelling album library;
3. reliably search/filter it;
4. inspect a record's historical evidence;
5. explore the collection by music category and time;
6. rediscover meaningful records through History/Home;
7. open the intended record in Spotify.

## Explicit V1 exclusions

- playback engine;
- Spotify OAuth/sync daemon;
- friends/social graph;
- public profiles;
- playlists;
- external recommendation engine;
- AI chat;
- multi-user account system;
- gamification;
- large manual tagging/editorial CMS.

## Product quality bar

Needle should feel authored. A technically correct database browser with album covers is not enough. The experience must preserve the approved editorial/artwork-first direction while keeping Library fast and practical.
