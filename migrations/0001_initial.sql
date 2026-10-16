CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK(length(name) BETWEEN 2 AND 60),
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT '',
  bike_type TEXT NOT NULL DEFAULT 'Road bike',
  bio TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE INDEX sessions_user ON sessions(user_id);
CREATE INDEX sessions_expiry ON sessions(expires_at);
CREATE TABLE rides (
  id TEXT PRIMARY KEY,
  organizer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK(length(title) BETWEEN 3 AND 100),
  description TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL,
  meeting_point TEXT NOT NULL,
  route_url TEXT NOT NULL DEFAULT '',
  starts_at TEXT NOT NULL,
  distance_km REAL NOT NULL CHECK(distance_km > 0 AND distance_km <= 1000),
  elevation_m INTEGER NOT NULL DEFAULT 0 CHECK(elevation_m BETWEEN 0 AND 20000),
  pace TEXT NOT NULL CHECK(pace IN ('Santai', 'Moderate', 'Ngebut')),
  terrain TEXT NOT NULL CHECK(terrain IN ('Road', 'Gravel', 'MTB', 'Campuran')),
  capacity INTEGER NOT NULL CHECK(capacity BETWEEN 2 AND 200),
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK(status IN ('upcoming','completed','cancelled')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX rides_start ON rides(starts_at);
CREATE INDEX rides_organizer ON rides(organizer_id);
CREATE TABLE participants (
  ride_id TEXT NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (ride_id,user_id)
);
CREATE INDEX participants_user ON participants(user_id);
-- Database-level guards keep the last seat safe even with concurrent requests.
CREATE TRIGGER guard_participant_insert BEFORE INSERT ON participants BEGIN
  SELECT CASE WHEN (SELECT status FROM rides WHERE id=NEW.ride_id) <> 'upcoming'
    THEN RAISE(ABORT,'RIDE_CLOSED') END;
  SELECT CASE WHEN (SELECT starts_at FROM rides WHERE id=NEW.ride_id) <= strftime('%Y-%m-%dT%H:%M:%fZ','now')
    THEN RAISE(ABORT,'RIDE_STARTED') END;
  SELECT CASE WHEN (SELECT COUNT(*) FROM participants WHERE ride_id=NEW.ride_id) >=
    (SELECT capacity FROM rides WHERE id=NEW.ride_id)
    THEN RAISE(ABORT,'RIDE_FULL') END;
END;
CREATE TRIGGER guard_capacity_update BEFORE UPDATE OF capacity ON rides
WHEN NEW.capacity < (SELECT COUNT(*) FROM participants WHERE ride_id=NEW.id)
BEGIN SELECT RAISE(ABORT,'CAPACITY_TOO_SMALL'); END;
CREATE TABLE checklist (
  ride_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  item_id TEXT NOT NULL CHECK(item_id IN ('helmet','bike','water','repair','money')),
  PRIMARY KEY(ride_id,user_id,item_id),
  FOREIGN KEY(ride_id,user_id) REFERENCES participants(ride_id,user_id) ON DELETE CASCADE
);
CREATE TABLE notes (
  id TEXT PRIMARY KEY,
  ride_id TEXT NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 1000),
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX notes_ride ON notes(ride_id,created_at);
CREATE TABLE rate_limits (
  key TEXT PRIMARY KEY,
  hits INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX rate_limit_expiry ON rate_limits(expires_at);
