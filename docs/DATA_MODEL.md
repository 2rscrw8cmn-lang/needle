# Data Model

## Modeling rule

Needle must not collapse these concepts into one record:

**canonical album ≠ Spotify edition ≠ playback event ≠ album listening session ≠ personal state**

The source analysis already demonstrates why this matters: deluxe editions, remasters, re-recordings, compilations, incomplete sessions, and isolated track plays all appear in the history.

## Core entities

### Artist

Represents a canonical artist identity used for browsing and album relationships.

Suggested fields:

- `id`
- `name`
- external IDs as available
- normalized sort name (optional)

### Album

Represents the canonical record Needle wants the listener to recognize as one album in the archive.

Suggested fields:

- `id`
- `title`
- primary artist relationship
- canonical/original release date
- release year
- artwork reference
- preferred Spotify edition relationship
- catalog confidence
- review status

An Album should not directly store all edition-specific track counts/Spotify IDs.

### AlbumEdition

Represents a specific release/edition that can be linked to Spotify and matched to source history.

Examples: standard, deluxe, remaster, reissue, re-recording, compilation appearance.

Suggested fields:

- `id`
- `album_id`
- `spotify_album_id`
- `title`
- `release_date`
- `edition_type`
- `track_count`
- `is_preferred`
- `match_confidence`
- `edition_ambiguity`

### Track

Represents a Spotify-resolvable track identity used to connect raw playback events to an edition/session.

Suggested fields:

- `id`
- `spotify_track_id`
- `title`
- artist relationship
- album-edition relationship when resolved
- track/disc number when enriched

### PlaybackEvent

Represents one required subset of a Spotify source row.

Persist only fields needed for Needle. Do **not** carry IP address or unnecessary raw device metadata into the app database.

Suggested fields:

- `id`
- `played_at`
- `spotify_track_id`
- `ms_played`
- `skipped` if useful to session logic
- `reason_start` / `reason_end` only if session derivation needs them
- source/import batch ID

Raw event identity/deduplication rules must be defined in the importer.

### AlbumSession

Represents a derived period in which playback evidence points to engagement with an album.

Suggested fields:

- `id`
- `album_id`
- matched edition ID if available
- `started_at`
- `ended_at`
- duration
- plays
- unique tracks
- expected tracks
- coverage percent
- `session_status`
- evidence/match confidence
- missing-track summary if needed for audit

Expected statuses initially mirror the analysis vocabulary:

- `full`
- `near_complete`
- `single_track_or_sparse`
- `review`

### ListenerAlbumSummary

A derived materialized summary for fast Library/History queries. It is not the historical source of truth; it can be rebuilt from sessions/events.

Suggested fields:

- `album_id`
- first evidence date
- last evidence date
- total qualifying sessions
- full-session count
- near-complete-session count
- sparse-session count
- total plays/time
- listener classification
- archive inclusion state
- last calculated at

### PersonalAlbumState

Mutable app-specific state that did not come from Spotify history.

Suggested fields:

- `album_id`
- `favorite`
- `revisit`
- optional rating if the product later adopts ratings
- personal notes
- created/updated timestamps

Keep this separate from derived listening evidence so reimports never erase personal data.

### Genre

Detailed, potentially multi-valued classification.

Suggested fields:

- `id`
- `name`
- source/provenance

Albums may have multiple genres. Imported source genres remain intact even when they map into a broader Music Type.

### MusicType

Broad, stable browsing taxonomy maintained by Needle. Version 1 is the accepted ten-category system:

- Rock
- Pop
- Hip-Hop
- R&B / Soul
- Electronic
- Jazz
- Country / Folk
- Heavy
- Global
- Classical / Soundtrack

Music Type is not a replacement for Genre. An album should usually have one primary Music Type and may carry multiple detailed Genres. Missing or ambiguous genre evidence may leave an album unclassified; manual overrides remain separate from imported source evidence and must survive reimport.

See `MUSIC_TYPE_TAXONOMY.md` for the versioned 1.06 mapping contract.

## Relationships

```text
Artist
  └── Album
        ├── AlbumEdition
        │     └── Track
        ├── AlbumSession
        ├── ListenerAlbumSummary
        ├── PersonalAlbumState
        ├── Genre[]
        └── MusicType

PlaybackEvent ──> Track ──> AlbumEdition ──> Album
```

## Archive membership

Ingestion and Library inclusion are intentionally separate.

Needle should ingest/preserve all usable candidate evidence. The default Library includes an album when there is at least one **Full or Near-Complete** qualifying album session, per accepted decision D-009. Sparse/single-track and unresolved review evidence remains stored without being promoted into the main Library.

## Canonical album vs edition behavior

The data model must permit:

- several Spotify edition IDs pointing to one canonical album;
- edition-specific track counts;
- a preferred outbound Spotify edition;
- unresolved edition ambiguity;
- re-recordings that may ultimately be treated as distinct canonical albums where artist intent/product identity warrants it.

Edition collapse is therefore a data decision, not a string-normalization trick.

## Derived editorial features this model supports

Without adding special-purpose tables, this structure can support:

- “first heard / last heard”;
- “it has been X years”;
- most revisited records;
- records spanning multiple listening eras;
- History by year;
- Music Type/genre movement over time;
- records with strong evidence but no recent session;
- similar records within the listener's own archive.

## Data invariants

1. Reimporting raw history must not erase PersonalAlbumState or persistent manual Music Type overrides.
2. Raw IP address must never be persisted into the app model.
3. A session classification must retain enough provenance to explain/rebuild it.
4. `spotify_album_id` belongs to an edition, not automatically to the canonical album.
5. Genre/Music Type values must have provenance or a deterministic versioned taxonomy rule.
6. Future-dated source/derived events must be quarantined until validated.
