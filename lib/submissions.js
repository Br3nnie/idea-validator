import { neon } from "@neondatabase/serverless";
import crypto from "crypto";

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
    schemaReady = sql`SELECT to_regclass('public.submissions') AS submissions, to_regclass('public.rate_limits') AS rate_limits, to_regclass('public.operational_alerts') AS operational_alerts, to_regclass('public.analytics_events') AS analytics_events, to_regclass('public.validation_experiments') AS validation_experiments, to_regclass('public.report_shares') AS report_shares`.then(rows => {
      if (Object.values(rows[0] || {}).some(value => !value)) throw new Error("Database migrations have not been applied");
    }).catch(error => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

export async function consumeRateLimit({ scope, identifier, limit, windowSeconds }) {
  await ensureSubmissionsTable();
  const sql = getSql();
  const identifierHash = crypto.createHash("sha256").update(String(identifier || "unknown")).digest("hex");
  const rows = await sql`
    INSERT INTO rate_limits (scope, identifier_hash, window_started_at, attempts)
    VALUES (${scope}, ${identifierHash}, now(), 1)
    ON CONFLICT (scope, identifier_hash) DO UPDATE
    SET attempts = CASE
          WHEN rate_limits.window_started_at < now() - (${windowSeconds} * interval '1 second') THEN 1
          ELSE rate_limits.attempts + 1
        END,
        window_started_at = CASE
          WHEN rate_limits.window_started_at < now() - (${windowSeconds} * interval '1 second') THEN now()
          ELSE rate_limits.window_started_at
        END
    RETURNING attempts, window_started_at
  `;
  return { allowed: rows[0].attempts <= limit, attempts: rows[0].attempts };
}

export async function createSubmission({ requestKey, email, answers, loopsCaptured, pageUrl, referrer, userAgent }) {
  await ensureSubmissionsTable();
  const sql = getSql();
  const rows = await sql`
    INSERT INTO submissions (request_key, email, answers, loops_captured, page_url, referrer, user_agent)
    VALUES (
      ${requestKey}::uuid,
      ${email},
      ${JSON.stringify(answers)}::jsonb,
      ${loopsCaptured},
      ${pageUrl || null},
      ${referrer || null},
      ${userAgent || null}
    )
    ON CONFLICT (request_key) WHERE request_key IS NOT NULL DO NOTHING
    RETURNING id
  `;
  return rows[0]?.id || null;
}

export async function saveLoopsCapture(id, captured) {
  await ensureSubmissionsTable();
  const sql = getSql();
  await sql`UPDATE submissions SET loops_captured=${Boolean(captured)}, updated_at=now() WHERE id=${id}::uuid`;
}

export async function findSubmissionByRequestKey(requestKey) {
  await ensureSubmissionsTable();
  const sql = getSql();
  const rows = await sql`
    SELECT id, status, result, error_message, report_email_sent, owner_notification_sent, created_at, updated_at
    FROM submissions WHERE request_key = ${requestKey}::uuid LIMIT 1
  `;
  return rows[0] || null;
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
  const inputPrice = Number(process.env.ANTHROPIC_INPUT_USD_PER_MILLION || 3);
  const outputPrice = Number(process.env.ANTHROPIC_OUTPUT_USD_PER_MILLION || 15);
  const safeInputPrice = Number.isFinite(inputPrice) && inputPrice >= 0 ? inputPrice : 3;
  const safeOutputPrice = Number.isFinite(outputPrice) && outputPrice >= 0 ? outputPrice : 15;
  const costUsd = (inputTokens * safeInputPrice + outputTokens * safeOutputPrice) / 1_000_000;
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

export async function listSubmissions({ search = "", status = "", verdict = "", page = 1, pageSize = 50 } = {}) {
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
  const safePage = Math.max(1, Math.min(10000, Number.parseInt(page, 10) || 1));
  const safePageSize = Math.max(10, Math.min(100, Number.parseInt(pageSize, 10) || 50));
  const offset = (safePage - 1) * safePageSize;
  const [rows, counts, filteredCount] = await Promise.all([
    sql.query(
      `SELECT id, created_at, updated_at, status, email, answers, result, idea_name, verdict,
              average_score, confidence, loops_captured, page_url, referrer, error_message,
              model, input_tokens, output_tokens, cost_usd, usd_to_gbp_rate, cost_gbp,
              report_email_sent, owner_notification_sent, email_error
       FROM submissions ${where}
       ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, safePageSize, offset]
    ),
    sql.query(`SELECT status, COUNT(*)::int AS count,
                      COALESCE(SUM(input_tokens), 0)::bigint AS input_tokens,
                      COALESCE(SUM(output_tokens), 0)::bigint AS output_tokens,
                      COALESCE(SUM(cost_usd), 0)::numeric AS cost_usd,
                      COALESCE(SUM(cost_gbp), 0)::numeric AS cost_gbp
               FROM submissions GROUP BY status`),
    sql.query(`SELECT COUNT(*)::int AS count FROM submissions ${where}`, params),
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
  return { submissions: rows, summary, pagination:{ page:safePage, pageSize:safePageSize, total:filteredCount[0]?.count || 0 } };
}

export async function deleteExpiredSubmissions(retentionDays = 365) {
  await ensureSubmissionsTable();
  const sql = getSql();
  const safeDays = Math.max(30, Math.min(3650, Number.parseInt(retentionDays, 10) || 365));
  const rows = await sql`DELETE FROM submissions WHERE created_at < now() - (${safeDays} * interval '1 day') RETURNING id`;
  await sql`DELETE FROM rate_limits WHERE window_started_at < now() - interval '2 days'`;
  return rows.length;
}

export async function reserveDailySpendAlert(thresholdGbp) {
  await ensureSubmissionsTable();
  const sql = getSql();
  const totals = await sql`SELECT COALESCE(SUM(cost_gbp),0)::numeric AS cost_gbp FROM submissions WHERE created_at >= date_trunc('day', now())`;
  const costGbp = Number(totals[0]?.cost_gbp || 0);
  if (costGbp < thresholdGbp) return { alert:false, costGbp };
  const alertKey = `daily-spend:${new Date().toISOString().slice(0, 10)}`;
  const rows = await sql`
    INSERT INTO operational_alerts (alert_key, payload) VALUES (${alertKey}, ${JSON.stringify({ costGbp, thresholdGbp })}::jsonb)
    ON CONFLICT (alert_key) DO NOTHING RETURNING alert_key
  `;
  return { alert:rows.length === 1, costGbp };
}

export async function recordAnalyticsEvent(sessionId, eventName) {
  await ensureSubmissionsTable();
  const sql = getSql();
  const sessionHash = crypto.createHash("sha256").update(String(sessionId)).digest("hex");
  await sql`INSERT INTO analytics_events (session_hash, event_name) VALUES (${sessionHash}, ${eventName}) ON CONFLICT DO NOTHING`;
}

export async function getAnalyticsSummary(days = 30) {
  await ensureSubmissionsTable();
  const sql = getSql();
  const safeDays = Math.max(1, Math.min(365, Number.parseInt(days, 10) || 30));
  const rows = await sql`
    SELECT event_name, COUNT(*)::int AS count FROM analytics_events
    WHERE created_at >= now() - (${safeDays} * interval '1 day') GROUP BY event_name
  `;
  return Object.fromEntries(rows.map(row => [row.event_name, row.count]));
}

export async function createExperimentsFromResult(submissionId, result) {
  await ensureSubmissionsTable();
  const sql = getSql();
  for (const [position, step] of (result.validationSteps || []).entries()) {
    await sql`INSERT INTO validation_experiments (submission_id, position, hypothesis, method)
      VALUES (${submissionId}::uuid, ${position}, ${step.label || "Validation hypothesis"}, ${step.description || ""}) ON CONFLICT DO NOTHING`;
  }
}

export async function listExperiments(requestKey) {
  await ensureSubmissionsTable();
  const sql = getSql();
  return sql`SELECT e.* FROM validation_experiments e JOIN submissions s ON s.id=e.submission_id
    WHERE s.request_key=${requestKey}::uuid ORDER BY e.position`;
}

export async function updateExperiment(requestKey, experimentId, input) {
  await ensureSubmissionsTable();
  const sql = getSql();
  const rows = await sql`UPDATE validation_experiments e SET
    hypothesis=${input.hypothesis}, method=${input.method}, target_audience=${input.targetAudience}, success_threshold=${input.successThreshold},
    deadline=${input.deadline || null}, result=${input.result}, decision=${input.decision}, status=${input.status}, updated_at=now()
    FROM submissions s WHERE e.id=${experimentId}::uuid AND e.submission_id=s.id AND s.request_key=${requestKey}::uuid RETURNING e.*`;
  return rows[0] || null;
}

function tokenHash(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

export async function createReportShare(requestKey, expiryDays = 30) {
  await ensureSubmissionsTable();
  const sql = getSql();
  const token = crypto.randomBytes(32).toString("base64url");
  const days = Math.max(1, Math.min(90, Number.parseInt(expiryDays, 10) || 30));
  await sql`UPDATE report_shares r SET revoked_at=now() FROM submissions s
    WHERE r.submission_id=s.id AND s.request_key=${requestKey}::uuid AND r.revoked_at IS NULL`;
  const rows = await sql`INSERT INTO report_shares (submission_id, token_hash, expires_at)
    SELECT id, ${tokenHash(token)}, now() + (${days} * interval '1 day') FROM submissions
    WHERE request_key=${requestKey}::uuid AND status='completed' RETURNING id, expires_at`;
  return rows[0] ? { token, expiresAt:rows[0].expires_at } : null;
}

export async function revokeReportShares(requestKey) {
  await ensureSubmissionsTable();
  const sql = getSql();
  const rows = await sql`UPDATE report_shares r SET revoked_at=now() FROM submissions s
    WHERE r.submission_id=s.id AND s.request_key=${requestKey}::uuid AND r.revoked_at IS NULL RETURNING r.id`;
  return rows.length;
}

export async function getSharedReport(token) {
  await ensureSubmissionsTable();
  const sql = getSql();
  const rows = await sql`SELECT s.idea_name, s.verdict, s.average_score, s.confidence, s.result, r.expires_at
    FROM report_shares r JOIN submissions s ON s.id=r.submission_id
    WHERE r.token_hash=${tokenHash(token)} AND r.revoked_at IS NULL AND r.expires_at>now() LIMIT 1`;
  return rows[0] || null;
}
