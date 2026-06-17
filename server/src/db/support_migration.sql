-- ============================================================
-- Harth Platform — Support System Migration
-- Run once: psql -d harth -f support_migration.sql
-- ============================================================

-- Support tickets
CREATE TABLE IF NOT EXISTS support_tickets (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number   TEXT        UNIQUE NOT NULL,
  user_id         UUID        REFERENCES users(id) ON DELETE SET NULL,
  guest_name      TEXT,
  guest_email     TEXT,
  category        TEXT        NOT NULL CHECK (category IN ('technical','financial','account','orders','suggestion','complaint')),
  priority        TEXT        NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  subject         TEXT        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','closed')),
  assigned_to     UUID        REFERENCES users(id) ON DELETE SET NULL,
  sla_hours       INT         NOT NULL DEFAULT 24,
  sla_due_at      TIMESTAMPTZ,
  resolved_at     TIMESTAMPTZ,
  closed_at       TIMESTAMPTZ,
  csat_score      INT         CHECK (csat_score BETWEEN 1 AND 5),
  csat_comment    TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Support messages (conversation thread per ticket)
CREATE TABLE IF NOT EXISTS support_messages (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id    UUID        NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_id    UUID        REFERENCES users(id) ON DELETE SET NULL,
  sender_type  TEXT        NOT NULL CHECK (sender_type IN ('user','agent','bot','system')),
  body         TEXT        NOT NULL,
  attachments  JSONB       NOT NULL DEFAULT '[]',
  is_internal  BOOLEAN     NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_support_tickets_user    ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status  ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created ON support_tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_messages_ticket ON support_messages(ticket_id, created_at);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_support_ticket_ts()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_support_ticket_ts ON support_tickets;
CREATE TRIGGER trg_support_ticket_ts
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW EXECUTE FUNCTION update_support_ticket_ts();
