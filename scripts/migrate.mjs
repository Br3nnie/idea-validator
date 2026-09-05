import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!url) throw new Error("DATABASE_URL or POSTGRES_URL is required");
const sql = neon(url);

await sql`CREATE TABLE IF NOT EXISTS submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'processing', email TEXT NOT NULL, answers JSONB NOT NULL, result JSONB, idea_name TEXT, verdict TEXT,
  average_score INTEGER, confidence INTEGER, loops_captured BOOLEAN NOT NULL DEFAULT false, page_url TEXT, referrer TEXT, user_agent TEXT,
  error_message TEXT, model TEXT, input_tokens INTEGER NOT NULL DEFAULT 0, output_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd NUMERIC(12,6) NOT NULL DEFAULT 0, usd_to_gbp_rate NUMERIC(10,6) NOT NULL DEFAULT 0.75, cost_gbp NUMERIC(12,6) NOT NULL DEFAULT 0,
  report_email_sent BOOLEAN NOT NULL DEFAULT false, owner_notification_sent BOOLEAN NOT NULL DEFAULT false, email_error TEXT
)`;
await sql`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS model TEXT`;
await sql`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS input_tokens INTEGER NOT NULL DEFAULT 0`;
await sql`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS output_tokens INTEGER NOT NULL DEFAULT 0`;
await sql`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS cost_usd NUMERIC(12,6) NOT NULL DEFAULT 0`;
await sql`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS usd_to_gbp_rate NUMERIC(10,6) NOT NULL DEFAULT 0.75`;
await sql`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS cost_gbp NUMERIC(12,6) NOT NULL DEFAULT 0`;
await sql`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS report_email_sent BOOLEAN NOT NULL DEFAULT false`;
await sql`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS owner_notification_sent BOOLEAN NOT NULL DEFAULT false`;
await sql`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS email_error TEXT`;
await sql`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS request_key UUID`;
await sql`CREATE UNIQUE INDEX IF NOT EXISTS submissions_request_key_idx ON submissions (request_key) WHERE request_key IS NOT NULL`;
await sql`CREATE INDEX IF NOT EXISTS submissions_created_at_idx ON submissions (created_at DESC)`;
await sql`CREATE INDEX IF NOT EXISTS submissions_status_idx ON submissions (status)`;
await sql`CREATE INDEX IF NOT EXISTS submissions_verdict_idx ON submissions (verdict)`;
await sql`CREATE TABLE IF NOT EXISTS rate_limits (
  scope TEXT NOT NULL, identifier_hash TEXT NOT NULL, window_started_at TIMESTAMPTZ NOT NULL, attempts INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (scope, identifier_hash)
)`;
await sql`CREATE TABLE IF NOT EXISTS operational_alerts (
  alert_key TEXT PRIMARY KEY, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), payload JSONB NOT NULL
)`;
await sql`CREATE TABLE IF NOT EXISTS analytics_events (
  id BIGSERIAL PRIMARY KEY, session_hash TEXT NOT NULL, event_name TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_hash, event_name)
)`;
await sql`CREATE INDEX IF NOT EXISTS analytics_events_created_at_idx ON analytics_events (created_at DESC)`;
await sql`CREATE TABLE IF NOT EXISTS validation_experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  position INTEGER NOT NULL, hypothesis TEXT NOT NULL, method TEXT NOT NULL, target_audience TEXT NOT NULL DEFAULT '',
  success_threshold TEXT NOT NULL DEFAULT '', deadline DATE, result TEXT NOT NULL DEFAULT '', decision TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'planned', updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(submission_id, position)
)`;
await sql`CREATE TABLE IF NOT EXISTS report_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), expires_at TIMESTAMPTZ NOT NULL, revoked_at TIMESTAMPTZ
)`;
await sql`CREATE INDEX IF NOT EXISTS report_shares_submission_idx ON report_shares (submission_id)`;

console.log("Database migration complete");
