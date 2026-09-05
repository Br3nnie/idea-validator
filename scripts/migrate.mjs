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
await sql`CREATE INDEX IF NOT EXISTS submissions_created_at_idx ON submissions (created_at DESC)`;
await sql`CREATE INDEX IF NOT EXISTS submissions_status_idx ON submissions (status)`;
await sql`CREATE INDEX IF NOT EXISTS submissions_verdict_idx ON submissions (verdict)`;
await sql`CREATE TABLE IF NOT EXISTS rate_limits (
  scope TEXT NOT NULL, identifier_hash TEXT NOT NULL, window_started_at TIMESTAMPTZ NOT NULL, attempts INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (scope, identifier_hash)
)`;

console.log("Database migration complete");
