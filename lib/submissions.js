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
        error_message TEXT
      )
    `.catch(error => {
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

export async function completeSubmission(id, result) {
  await ensureSubmissionsTable();
  const sql = getSql();
  const scores = Array.isArray(result?.scoring) ? result.scoring : [];
  const averageScore = scores.length
    ? Math.round(scores.reduce((total, item) => total + Number(item.score || 0), 0) / scores.length)
    : null;

  await sql`
    UPDATE submissions
    SET status = 'completed',
        result = ${JSON.stringify(result)}::jsonb,
        idea_name = ${result?.ideaName || null},
        verdict = ${result?.verdict || null},
        average_score = ${averageScore},
        confidence = ${Number.isFinite(Number(result?.confidence)) ? Number(result.confidence) : null},
        error_message = NULL,
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
              average_score, confidence, loops_captured, page_url, referrer, error_message
       FROM submissions ${where}
       ORDER BY created_at DESC LIMIT 250`,
      params
    ),
    sql.query(`SELECT status, COUNT(*)::int AS count FROM submissions GROUP BY status`),
  ]);

  const summary = { total: 0, processing: 0, completed: 0, failed: 0 };
  counts.forEach(item => {
    summary[item.status] = item.count;
    summary.total += item.count;
  });
  return { submissions: rows, summary };
}
