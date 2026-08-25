CREATE TABLE IF NOT EXISTS needle_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT INTO needle_meta (key, value)
VALUES ('schema_version', '0')
ON CONFLICT(key) DO UPDATE SET value = excluded.value;
