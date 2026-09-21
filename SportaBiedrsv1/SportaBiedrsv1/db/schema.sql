-- PostgreSQL schema expected by the booking routes.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  city TEXT,
  address TEXT,
  provider TEXT NOT NULL DEFAULT 'manual' CHECK (provider IN ('manual','bookla','playtomic')),
  external_id TEXT,
  timezone TEXT NOT NULL DEFAULT 'Europe/Riga',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS courts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  external_id TEXT,
  hourly_price_cents INTEGER NOT NULL CHECK (hourly_price_cents > 0),
  slot_minutes INTEGER NOT NULL DEFAULT 60 CHECK (slot_minutes BETWEEN 15 AND 240),
  open_time TIME NOT NULL DEFAULT '08:00:00',
  close_time TIME NOT NULL DEFAULT '22:00:00',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  court_id UUID NOT NULL REFERENCES courts(id) ON DELETE RESTRICT,
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE RESTRICT,
  user_id TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_first_name TEXT NOT NULL,
  customer_last_name TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'eur',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','cancelled','failed')),
  stripe_payment_intent_id TEXT UNIQUE,
  external_hold_id TEXT,
  external_hold_expires_at TIMESTAMPTZ,
  external_confirmation_status TEXT NOT NULL DEFAULT 'pending',
  hold_expires_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  confirmation_email_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  client_request_key TEXT,
  CHECK (end_time > start_time),
  CHECK (status <> 'confirmed' OR confirmed_at IS NOT NULL),
  CHECK (external_confirmation_status IN ('pending','confirmed','failed'))
);

-- Safe upgrades for databases that already existed before booking v5/v9.
ALTER TABLE venues ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE courts ADD COLUMN IF NOT EXISTS external_id TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS client_request_key TEXT;

CREATE INDEX IF NOT EXISTS courts_external_id_idx ON courts(external_id);
CREATE INDEX IF NOT EXISTS bookings_court_time_idx ON bookings(court_id, start_time, end_time);
CREATE INDEX IF NOT EXISTS bookings_status_idx ON bookings(status, hold_expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS bookings_user_request_key_uidx
  ON bookings(user_id, client_request_key) WHERE client_request_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  id BIGSERIAL PRIMARY KEY,
  event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
