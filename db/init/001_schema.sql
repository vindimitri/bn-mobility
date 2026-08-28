-- Bonn Mobility — initial schema (Step 1)
-- Applied automatically on first Postgres container start via /docker-entrypoint-initdb.d

CREATE TABLE IF NOT EXISTS stations (
  station_id   TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  short_name   TEXT,
  lat          DOUBLE PRECISION NOT NULL,
  lon          DOUBLE PRECISION NOT NULL,
  region_id    TEXT,
  is_virtual   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ingest_runs (
  id              BIGSERIAL PRIMARY KEY,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at     TIMESTAMPTZ,
  status          TEXT NOT NULL CHECK (status IN ('running', 'ok', 'error')),
  stations_count  INTEGER,
  bikes_count     INTEGER,
  error_message   TEXT
);

CREATE TABLE IF NOT EXISTS station_snapshots (
  id                   BIGSERIAL PRIMARY KEY,
  ingest_run_id        BIGINT REFERENCES ingest_runs (id) ON DELETE SET NULL,
  station_id           TEXT NOT NULL REFERENCES stations (station_id) ON DELETE CASCADE,
  recorded_at          TIMESTAMPTZ NOT NULL,
  num_bikes_available  INTEGER NOT NULL CHECK (num_bikes_available >= 0),
  num_docks_available  INTEGER,
  is_installed         BOOLEAN NOT NULL DEFAULT TRUE,
  is_renting           BOOLEAN NOT NULL DEFAULT TRUE,
  is_returning         BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (station_id, recorded_at)
);

CREATE INDEX IF NOT EXISTS idx_station_snapshots_station_time
  ON station_snapshots (station_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_station_snapshots_recorded_at
  ON station_snapshots (recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_ingest_runs_started_at
  ON ingest_runs (started_at DESC);
