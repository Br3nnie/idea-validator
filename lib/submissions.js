import { neon } from "@neondatabase/serverless";

let sqlClient;
let schemaReady;

function databaseUrl() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL;
}

export function hasDatabase() {
  return Boolean(databaseUrl());
}

function getSql() {
  if (!sqlClient) sqlClient = neon(databaseUrl());
  return sqlClient;
}

export async function ensureSubmissionsTable() {
  if (!schemaReady) {
    const sql = getSql();
    schemaReady = sql`
      CREATE TABLE IF NOT EXISTS submissions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        status TEXT NOT NULL DEFAULT 'processing',
        email TEXT NOT NULL,
        answers JSONB NOT NULL,
        result JSONB,
        idea_name TEXT,
        verdict TEXT,
        average_score INTEGER,
        confidence INTEGER,
        loops_captured BOOLEAN NOT NULL DEFAULT false,
        page_url TEXT,
        referrer TEXT,
        user_agent TEXT,
        error_message TEXT,
        model TEXT,
        input_tokens INTEGER NOT NULL DEFAULT 0,
        output_tokens INTEGER NOT NULL DEFAULT 0,
        cost_usd NUMERIC(12, 6) NOT NULL DEFAULT 0,
        usd_to_gbp_rate NUMERIC(10, 6) NOT NULL DEFAULT 0.75,
        cost_gbp NUMERIC(12, 6) NOT NULL DEFAULT 0
        ,report_email_sent BOOLEAN NOT NULL DEFAULT false
        ,owner_notification_sent BOOLEAN NOT NULL DEFAULT false
        ,email_error TEXT
      )
    `.then(async () => {
      await sql`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS model TEXT`;
      await sql`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS input_tokens INTEGER NOT NULL DEFAULT 0`;
      await sql`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS output_tokens INTEGER NOT NULL DEFAULT 0`;
      await sql`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS cost_usd NUMERIC(12, 6) NOT NULL DEFAULT 0`;
      await sql`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS usd_to_gbp_rate NUMERIC(10, 6) NOT NULL DEFAULT 0.75`;
      await sql`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS cost_gbp NUMERIC(12, 6) NOT NULL DEFAULT 0`;
      await sql`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS report_email_sent BOOLEAN NOT NULL DEFAULT false`;
      await sql`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS owner_notification_sent BOOLEAN NOT NULL DEFAULT false`;
      await sql`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS email_error TEXT`;
    }).catch(error => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

export async function createSubmission({ email, answers, loopsCaptured, pageUrl, referrer, userAgent }) {
  await ensureSubmissionsTable();
  const sql = getSql();
  const rows = await sql`
    INSERT INTO submissions (email, answers, loops_captured, page_url, referrer, user_agent)
    VALUES (
      ${email},
      ${JSON.stringify(answers)}::jsonb,
      ${loopsCaptured},
      ${pageUrl || null},
      ${referrer || null},
      ${userAgent || null}
    )
    RETURNING id
  `;
  return rows[0].id;
}

export async function completeSubmission(id, result, usage = {}) {
  await ensureSubmissionsTable();
  const sql = getSql();
  const scores = Array.isArray(result?.scoring) ? result.scoring : [];
  const averageScore = scores.length
    ? Math.round(scores.reduce((total, item) => total + Number(item.score || 0), 0) / scores.length)
    : null;
  const inputTokens = Math.max(0, Math.round(Number(usage.inputTokens || 0)));
  const outputTokens = Math.max(0, Math.round(Number(usage.outputTokens || 0)));
  const costUsd = (inputTokens * 3 + outputTokens * 15) / 1_000_000;
  const configuredRate = Number(process.env.USD_TO_GBP_RATE || 0.75);
  const usdToGbpRate = Number.isFinite(configuredRate) && configuredRate > 0 ? configuredRate : 0.75;
  const costGbp = costUsd * usdToGbpRate;

  const rows = await sql`
    UPDATE submissions
    SET status = 'completed',
        result = ${JSON.stringify(result)}::jsonb,
        idea_name = ${result?.ideaName || null},
        verdict = ${result?.verdict || null},
        average_score = ${averageScore},
        confidence = ${Number.isFinite(Number(result?.confidence)) ? Number(result.confidence) : null},
        model = ${String(usage.model || "claude-sonnet-4-6").slice(0, 100)},
        input_tokens = ${inputTokens},
        output_tokens = ${outputTokens},
        cost_usd = ${costUsd},
        usd_to_gbp_rate = ${usdToGbpRate},
        cost_gbp = ${costGbp},
        error_message = NULL,
        updated_at = now()
    WHERE id = ${id}::uuid
    RETURNING id, email, created_at, average_score, cost_gbp, report_email_sent, owner_notification_sent
  `;
  return rows[0];
}

export async function saveEmailDelivery(id, { reportSent, ownerSent, error }) {
  await ensureSubmissionsTable();
  const sql = getSql();
  await sql`
    UPDATE submissions
    SET report_email_sent = report_email_sent OR ${Boolean(reportSent)},
        owner_notification_sent = owner_notification_sent OR ${Boolean(ownerSent)},
        email_error = ${error || null},
        updated_at = now()
    WHERE id = ${id}::uuid
  `;
}

export async function failSubmission(id, errorMessage) {
  await ensureSubmissionsTable();
  const sql = getSql();
  await sql`
    UPDATE submissions
    SET status = 'failed', error_message = ${String(errorMessage || "Unknown error").slice(0, 2000)}, updated_at = now()
    WHERE id = ${id}::uuid
  `;
}

export async function listSubmissions({ search = "", status = "", verdict = "" } = {}) {
  await ensureSubmissionsTable();
  const sql = getSql();
  const params = [];
  const clauses = [];

  if (search) {
    params.push(`%${String(search).slice(0, 200)}%`);
    clauses.push(`(email ILIKE $${params.length} OR idea_name ILIKE $${params.length})`);
  }
  if (["processing", "completed", "failed"].includes(status)) {
    params.push(status);
    clauses.push(`status = $${params.length}`);
  }
  if (["GO", "TEST", "KILL"].includes(verdict)) {
    params.push(verdict);
    clauses.push(`verdict = $${params.length}`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const [rows, counts] = await Promise.all([
    sql.query(
      `SELECT id, created_at, updated_at, status, email, answers, result, idea_name, verdict,
              average_score, confidence, loops_captured, page_url, referrer, error_message,
              model, input_tokens, output_tokens, cost_usd, usd_to_gbp_rate, cost_gbp,
              report_email_sent, owner_notification_sent, email_error
       FROM submissions ${where}
       ORDER BY created_at DESC LIMIT 250`,
      params
    ),
    sql.query(`SELECT status, COUNT(*)::int AS count,
                      COALESCE(SUM(input_tokens), 0)::bigint AS input_tokens,
                      COALESCE(SUM(output_tokens), 0)::bigint AS output_tokens,
                      COALESCE(SUM(cost_usd), 0)::numeric AS cost_usd,
                      COALESCE(SUM(cost_gbp), 0)::numeric AS cost_gbp
               FROM submissions GROUP BY status`),
  ]);

  const summary = { total: 0, processing: 0, completed: 0, failed: 0, inputTokens:0, outputTokens:0, costUsd:0, costGbp:0, averageCostGbp:0 };
  counts.forEach(item => {
    summary[item.status] = item.count;
    summary.total += item.count;
    summary.inputTokens += Number(item.input_tokens || 0);
    summary.outputTokens += Number(item.output_tokens || 0);
    summary.costUsd += Number(item.cost_usd || 0);
    summary.costGbp += Number(item.cost_gbp || 0);
  });
  summary.averageCostGbp = summary.completed ? summary.costGbp / summary.completed : 0;
  return { submissions: rows, summary };
}
