-- Initial tables. Never edit this file after it has run on a real server: add a new numbered file instead.

CREATE TABLE users (
  id                   SERIAL PRIMARY KEY,
  username             TEXT NOT NULL UNIQUE,
  display_name         TEXT NOT NULL,
  password_hash        TEXT NOT NULL,
  role                 TEXT NOT NULL CHECK (role IN ('admin', 'user')),
  can_update_status    BOOLEAN NOT NULL DEFAULT FALSE,
  must_change_password BOOLEAN NOT NULL DEFAULT TRUE,
  active               BOOLEAN NOT NULL DEFAULT TRUE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at        TIMESTAMPTZ
);

-- Only a hash of each session token is stored, so a copy of the database cannot be used to sign in.
CREATE TABLE sessions (
  id           SERIAL PRIMARY KEY,
  token_hash   TEXT NOT NULL UNIQUE,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE factories (
  id             SERIAL PRIMARY KEY,
  name           TEXT NOT NULL,
  city           TEXT NOT NULL,
  state          TEXT NOT NULL,
  country        TEXT NOT NULL,
  latitude       DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude      DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  shifts_per_day INTEGER NOT NULL DEFAULT 2 CHECK (shifts_per_day BETWEEN 1 AND 6),
  photo_file     TEXT,
  is_sample      BOOLEAN NOT NULL DEFAULT FALSE,
  archived       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE user_factories (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  factory_id INTEGER NOT NULL REFERENCES factories(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, factory_id)
);

CREATE TABLE machines (
  id           SERIAL PRIMARY KEY,
  factory_id   INTEGER NOT NULL REFERENCES factories(id) ON DELETE CASCADE,
  code         TEXT NOT NULL,
  name         TEXT NOT NULL,
  machine_type TEXT NOT NULL DEFAULT 'generic',
  description  TEXT NOT NULL DEFAULT '',
  model_file   TEXT,
  archived     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (factory_id, code)
);

-- Uploaded Excel files are kept forever. A corrected file for the same day sets superseded_by on the old one.
CREATE TABLE uploads (
  id            SERIAL PRIMARY KEY,
  factory_id    INTEGER NOT NULL REFERENCES factories(id) ON DELETE CASCADE,
  work_date     DATE NOT NULL,
  file_name     TEXT NOT NULL,
  file_data     BYTEA NOT NULL,
  file_size     INTEGER NOT NULL,
  row_count     INTEGER NOT NULL,
  uploaded_by   INTEGER NOT NULL REFERENCES users(id),
  uploaded_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  superseded_by INTEGER REFERENCES uploads(id)
);
CREATE INDEX uploads_factory_date ON uploads (factory_id, work_date);

-- One row per machine, day and shift, from an upload or a manual edit. Rows are never updated or deleted.
CREATE TABLE status_records (
  id          BIGSERIAL PRIMARY KEY,
  machine_id  INTEGER NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
  work_date   DATE NOT NULL,
  shift       INTEGER NOT NULL CHECK (shift BETWEEN 1 AND 6),
  status      TEXT NOT NULL CHECK (status IN ('running', 'stopped', 'aborted', 'shift_ended')),
  abort_count INTEGER NOT NULL DEFAULT 0 CHECK (abort_count >= 0),
  remarks     TEXT NOT NULL DEFAULT '',
  source      TEXT NOT NULL CHECK (source IN ('upload', 'manual')),
  upload_id   INTEGER REFERENCES uploads(id),
  created_by  INTEGER NOT NULL REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX status_records_lookup ON status_records (machine_id, work_date, shift, created_at DESC);

-- The record that counts for each machine, day and shift: the newest one, ignoring replaced uploads.
CREATE VIEW effective_status AS
SELECT DISTINCT ON (sr.machine_id, sr.work_date, sr.shift) sr.*
FROM status_records sr
LEFT JOIN uploads u ON u.id = sr.upload_id
WHERE sr.upload_id IS NULL OR u.superseded_by IS NULL
ORDER BY sr.machine_id, sr.work_date, sr.shift, sr.created_at DESC, sr.id DESC;

CREATE TABLE audit_log (
  id         BIGSERIAL PRIMARY KEY,
  user_id    INTEGER REFERENCES users(id),
  action     TEXT NOT NULL,
  details    JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
