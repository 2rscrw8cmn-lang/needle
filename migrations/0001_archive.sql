PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS import_batches (
  import_batch_id TEXT PRIMARY KEY,
  archive_version INTEGER NOT NULL,
  imported_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS artists (
  spotify_artist_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  spotify_url TEXT,
  is_current INTEGER NOT NULL DEFAULT 1 CHECK (is_current IN (0, 1)),
  import_batch_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS albums (
  canonical_album_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  primary_artist_id TEXT NOT NULL,
  primary_artist_name TEXT NOT NULL,
  original_release_date TEXT,
  preferred_edition_id TEXT,
  catalog_confidence TEXT NOT NULL CHECK (catalog_confidence IN ('high', 'medium', 'none')),
  catalog_review_status TEXT NOT NULL CHECK (catalog_review_status IN ('accepted', 'review')),
  artwork_url TEXT,
  spotify_url TEXT,
  music_type TEXT CHECK (
    music_type IS NULL OR music_type IN (
      'Rock',
      'Pop',
      'Hip-Hop',
      'R&B / Soul',
      'Electronic',
      'Jazz',
      'Country / Folk',
      'Heavy',
      'Global',
      'Classical / Soundtrack'
    )
  ),
  music_type_status TEXT,
  taxonomy_version INTEGER,
  mapping_version INTEGER,
  archive_member INTEGER NOT NULL CHECK (archive_member IN (0, 1)),
  is_current INTEGER NOT NULL DEFAULT 1 CHECK (is_current IN (0, 1)),
  import_batch_id TEXT NOT NULL,
  FOREIGN KEY (primary_artist_id) REFERENCES artists(spotify_artist_id)
);

CREATE TABLE IF NOT EXISTS album_editions (
  edition_id TEXT PRIMARY KEY,
  canonical_album_id TEXT NOT NULL,
  spotify_album_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  release_date TEXT,
  edition_type TEXT NOT NULL,
  total_tracks INTEGER NOT NULL CHECK (total_tracks >= 0),
  is_preferred INTEGER NOT NULL CHECK (is_preferred IN (0, 1)),
  match_confidence TEXT NOT NULL CHECK (match_confidence IN ('high', 'medium', 'none')),
  edition_ambiguity INTEGER NOT NULL CHECK (edition_ambiguity IN (0, 1)),
  import_batch_id TEXT NOT NULL,
  FOREIGN KEY (canonical_album_id) REFERENCES albums(canonical_album_id)
);

CREATE TABLE IF NOT EXISTS tracks (
  spotify_track_id TEXT PRIMARY KEY,
  canonical_album_id TEXT NOT NULL,
  edition_id TEXT NOT NULL,
  spotify_album_id TEXT NOT NULL,
  name TEXT NOT NULL,
  disc_number INTEGER NOT NULL,
  track_number INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL CHECK (duration_ms >= 0),
  explicit INTEGER NOT NULL CHECK (explicit IN (0, 1)),
  spotify_url TEXT,
  artist_ids_json TEXT NOT NULL,
  import_batch_id TEXT NOT NULL,
  FOREIGN KEY (canonical_album_id) REFERENCES albums(canonical_album_id),
  FOREIGN KEY (edition_id) REFERENCES album_editions(edition_id)
);

CREATE TABLE IF NOT EXISTS album_sessions (
  session_id TEXT PRIMARY KEY,
  canonical_album_id TEXT NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT NOT NULL,
  session_minutes REAL NOT NULL CHECK (session_minutes >= 0),
  evidence_status TEXT NOT NULL CHECK (evidence_status IN ('full', 'near_complete', 'sparse', 'review')),
  meaningful_unique_tracks INTEGER NOT NULL CHECK (meaningful_unique_tracks >= 0),
  credible_unique_tracks INTEGER NOT NULL CHECK (credible_unique_tracks >= 0),
  local_coverage REAL NOT NULL CHECK (local_coverage >= 0),
  missing_local_track_count INTEGER NOT NULL CHECK (missing_local_track_count >= 0),
  import_batch_id TEXT NOT NULL,
  FOREIGN KEY (canonical_album_id) REFERENCES albums(canonical_album_id)
);

CREATE TABLE IF NOT EXISTS listener_album_summaries (
  canonical_album_id TEXT PRIMARY KEY,
  archive_member INTEGER NOT NULL CHECK (archive_member IN (0, 1)),
  archive_rule TEXT NOT NULL,
  first_meaningful_listen_at TEXT,
  last_meaningful_listen_at TEXT,
  qualifying_session_count INTEGER NOT NULL CHECK (qualifying_session_count >= 0),
  full_session_count INTEGER NOT NULL CHECK (full_session_count >= 0),
  near_complete_session_count INTEGER NOT NULL CHECK (near_complete_session_count >= 0),
  sparse_session_count INTEGER NOT NULL CHECK (sparse_session_count >= 0),
  review_session_count INTEGER NOT NULL CHECK (review_session_count >= 0),
  total_session_count INTEGER NOT NULL CHECK (total_session_count >= 0),
  distinct_listening_months INTEGER NOT NULL CHECK (distinct_listening_months >= 0),
  distinct_listening_years INTEGER NOT NULL CHECK (distinct_listening_years >= 0),
  listening_months_json TEXT NOT NULL,
  listening_years_json TEXT NOT NULL,
  evidence_span_days INTEGER,
  source_album_count INTEGER NOT NULL CHECK (source_album_count >= 0),
  repeat_qualifying_sessions INTEGER NOT NULL CHECK (repeat_qualifying_sessions IN (0, 1)),
  spans_multiple_months INTEGER NOT NULL CHECK (spans_multiple_months IN (0, 1)),
  spans_multiple_years INTEGER NOT NULL CHECK (spans_multiple_years IN (0, 1)),
  spans_at_least_one_year INTEGER NOT NULL CHECK (spans_at_least_one_year IN (0, 1)),
  import_batch_id TEXT NOT NULL,
  FOREIGN KEY (canonical_album_id) REFERENCES albums(canonical_album_id)
);

CREATE TABLE IF NOT EXISTS genres (
  genre_key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  music_type TEXT,
  mapping_status TEXT NOT NULL CHECK (mapping_status IN ('mapped', 'ambiguous', 'unmapped')),
  import_batch_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS album_genres (
  canonical_album_id TEXT NOT NULL,
  genre_key TEXT NOT NULL,
  import_batch_id TEXT NOT NULL,
  PRIMARY KEY (canonical_album_id, genre_key),
  FOREIGN KEY (canonical_album_id) REFERENCES albums(canonical_album_id),
  FOREIGN KEY (genre_key) REFERENCES genres(genre_key)
);

CREATE TABLE IF NOT EXISTS personal_album_state (
  canonical_album_id TEXT PRIMARY KEY,
  favorite INTEGER NOT NULL DEFAULT 0 CHECK (favorite IN (0, 1)),
  revisit INTEGER NOT NULL DEFAULT 0 CHECK (revisit IN (0, 1)),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (canonical_album_id) REFERENCES albums(canonical_album_id)
);

CREATE INDEX IF NOT EXISTS idx_artists_current_name ON artists(is_current, name);
CREATE INDEX IF NOT EXISTS idx_albums_current_archive ON albums(is_current, archive_member);
CREATE INDEX IF NOT EXISTS idx_albums_current_music_type ON albums(is_current, music_type);
CREATE INDEX IF NOT EXISTS idx_albums_title ON albums(title COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_album_editions_album ON album_editions(canonical_album_id);
CREATE INDEX IF NOT EXISTS idx_tracks_album ON tracks(canonical_album_id, disc_number, track_number);
CREATE INDEX IF NOT EXISTS idx_album_sessions_album_date ON album_sessions(canonical_album_id, started_at);
CREATE INDEX IF NOT EXISTS idx_listener_summaries_archive ON listener_album_summaries(archive_member, last_meaningful_listen_at);
CREATE INDEX IF NOT EXISTS idx_album_genres_genre ON album_genres(genre_key, canonical_album_id);

INSERT INTO needle_meta (key, value)
VALUES ('schema_version', '1')
ON CONFLICT(key) DO UPDATE SET value = excluded.value;
