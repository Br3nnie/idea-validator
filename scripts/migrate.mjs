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
await sql`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS marketing_consent BOOLEAN NOT NULL DEFAULT false`;
await sql`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS processing_attempts INTEGER NOT NULL DEFAULT 0`;
await sql`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS processing_lease_until TIMESTAMPTZ`;
await sql`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ`;
await sql`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS email_attempts INTEGER NOT NULL DEFAULT 0`;
await sql`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS email_lease_until TIMESTAMPTZ`;
await sql`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS next_email_attempt_at TIMESTAMPTZ`;
await sql`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS prompt_version TEXT`;
await sql`CREATE UNIQUE INDEX IF NOT EXISTS submissions_request_key_idx ON submissions (request_key) WHERE request_key IS NOT NULL`;
await sql`CREATE INDEX IF NOT EXISTS submissions_created_at_idx ON submissions (created_at DESC)`;
await sql`CREATE INDEX IF NOT EXISTS submissions_status_idx ON submissions (status)`;
await sql`CREATE INDEX IF NOT EXISTS submissions_verdict_idx ON submissions (verdict)`;
await sql`CREATE INDEX IF NOT EXISTS submissions_recovery_idx ON submissions (status, next_attempt_at, processing_lease_until)`;
await sql`CREATE INDEX IF NOT EXISTS submissions_email_recovery_idx ON submissions (status, next_email_attempt_at, email_lease_until)`;
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
await sql`ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS properties JSONB NOT NULL DEFAULT '{}'::jsonb`;
await sql`CREATE INDEX IF NOT EXISTS analytics_events_created_at_idx ON analytics_events (created_at DESC)`;
await sql`CREATE TABLE IF NOT EXISTS validation_experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  position INTEGER NOT NULL, hypothesis TEXT NOT NULL, method TEXT NOT NULL, target_audience TEXT NOT NULL DEFAULT '',
  success_threshold TEXT NOT NULL DEFAULT '', deadline DATE, result TEXT NOT NULL DEFAULT '', decision TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'planned', updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(submission_id, position)
)`;
await sql`ALTER TABLE validation_experiments ADD COLUMN IF NOT EXISTS metric_name TEXT NOT NULL DEFAULT ''`;
await sql`ALTER TABLE validation_experiments ADD COLUMN IF NOT EXISTS baseline_value TEXT NOT NULL DEFAULT ''`;
await sql`ALTER TABLE validation_experiments ADD COLUMN IF NOT EXISTS observed_value TEXT NOT NULL DEFAULT ''`;
await sql`ALTER TABLE validation_experiments ADD COLUMN IF NOT EXISTS learning TEXT NOT NULL DEFAULT ''`;
await sql`ALTER TABLE validation_experiments ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ`;
await sql`CREATE INDEX IF NOT EXISTS validation_experiments_reminder_idx ON validation_experiments (deadline, reminder_sent_at, status)`;
await sql`CREATE TABLE IF NOT EXISTS report_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), expires_at TIMESTAMPTZ NOT NULL, revoked_at TIMESTAMPTZ
)`;
await sql`CREATE INDEX IF NOT EXISTS report_shares_submission_idx ON report_shares (submission_id)`;
await sql`CREATE TABLE IF NOT EXISTS report_access_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ
)`;
await sql`CREATE INDEX IF NOT EXISTS report_access_submission_idx ON report_access_tokens (submission_id)`;
await sql`CREATE TABLE IF NOT EXISTS report_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), result JSONB NOT NULL, model TEXT,
  input_tokens INTEGER NOT NULL DEFAULT 0, output_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd NUMERIC(12,6) NOT NULL DEFAULT 0, cost_gbp NUMERIC(12,6) NOT NULL DEFAULT 0,
  evidence_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb
)`;
await sql`ALTER TABLE report_revisions ADD COLUMN IF NOT EXISTS prompt_version TEXT`;
await sql`CREATE INDEX IF NOT EXISTS report_revisions_submission_idx ON report_revisions (submission_id, created_at DESC)`;

console.log("Database migration complete");
