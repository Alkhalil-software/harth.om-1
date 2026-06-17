-- ============================================================
-- Harth Platform — Profile & Session Management Migration
-- Run: psql -d harth -f profile_migration.sql
-- ============================================================

-- Extended user profiles (1:1 with users)
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id          UUID        PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  username         TEXT        UNIQUE,
  bio              TEXT,
  birth_date       DATE,
  gender           TEXT        CHECK (gender IN ('male','female','prefer_not')),
  country          TEXT,
  city             TEXT,
  avatar_url       TEXT,
  phone            TEXT,
  phone_verified   BOOLEAN     NOT NULL DEFAULT false,
  two_fa_enabled   BOOLEAN     NOT NULL DEFAULT false,
  two_fa_secret    TEXT,
  backup_codes     JSONB       DEFAULT '[]',
  language         TEXT        NOT NULL DEFAULT 'ar',
  theme            TEXT        NOT NULL DEFAULT 'dark',
  notif_orders     BOOLEAN     NOT NULL DEFAULT true,
  notif_messages   BOOLEAN     NOT NULL DEFAULT true,
  notif_promos     BOOLEAN     NOT NULL DEFAULT false,
  notif_security   BOOLEAN     NOT NULL DEFAULT true,
  notif_email      BOOLEAN     NOT NULL DEFAULT true,
  notif_whatsapp   BOOLEAN     NOT NULL DEFAULT false,
  login_alerts     BOOLEAN     NOT NULL DEFAULT true,
  data_export_at   TIMESTAMPTZ,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Active user sessions
CREATE TABLE IF NOT EXISTS user_sessions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   TEXT        NOT NULL,
  device_name  TEXT,
  device_type  TEXT        CHECK (device_type IN ('desktop','mobile','tablet','unknown')),
  browser      TEXT,
  os           TEXT,
  ip_address   TEXT,
  location     TEXT,
  is_current   BOOLEAN     NOT NULL DEFAULT false,
  last_active  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ
);

-- Security activity log
CREATE TABLE IF NOT EXISTS user_activity_log (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action       TEXT        NOT NULL,
  description  TEXT,
  ip_address   TEXT,
  device_info  TEXT,
  risk_level   TEXT        NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low','medium','high')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_username ON user_profiles(username);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user     ON user_sessions(user_id, last_active DESC);
CREATE INDEX IF NOT EXISTS idx_user_sessions_hash     ON user_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_activity_log_user      ON user_activity_log(user_id, created_at DESC);

-- Auto-update user_profiles.updated_at
CREATE OR REPLACE FUNCTION update_profile_ts()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS trg_profile_ts ON user_profiles;
CREATE TRIGGER trg_profile_ts BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_profile_ts();
