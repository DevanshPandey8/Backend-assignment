CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS offerings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_name TEXT NOT NULL,
  title TEXT NOT NULL,
  teacher_id TEXT NOT NULL,
  teacher_timezone TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offering_id UUID NOT NULL REFERENCES offerings(id) ON DELETE CASCADE,
  teacher_id TEXT NOT NULL,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT sessions_end_after_start CHECK (end_at > start_at)
);

CREATE INDEX IF NOT EXISTS sessions_offering_start_idx ON sessions(offering_id, start_at);
CREATE INDEX IF NOT EXISTS sessions_time_idx ON sessions(start_at, end_at);

CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offering_id UUID NOT NULL REFERENCES offerings(id) ON DELETE CASCADE,
  parent_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT bookings_parent_offering_unique UNIQUE (parent_id, offering_id)
);

CREATE INDEX IF NOT EXISTS bookings_parent_idx ON bookings(parent_id);