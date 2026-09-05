import { neon } from "@neondatabase/serverless";
import crypto from "crypto";

let sqlClient;
let schemaReady;

export function retryDelaySeconds(attempts) {
  return Math.min(900, 30 * (2 ** Math.max(0, Number(attempts) - 1)));
}

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
    schemaReady = sql`SELECT to_regclass('public.submissions') AS submissions, to_regclass('public.rate_limits') AS rate_limits, to_regclass('public.operational_alerts') AS operational_alerts, to_regclass('public.analytics_events') AS analytics_events, to_regclass('public.validation_experiments') AS validation_experiments, to_regclass('public.report_shares') AS report_shares, to_regclass('public.report_access_tokens') AS report_access_tokens, to_regclass('public.report_revisions') AS report_revisions`.then(rows => {
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

export async function createSubmission({ requestKey, email, answers, loopsCaptured, marketingConsent, pageUrl, referrer, userAgent }) {
  await ensureSubmissionsTable();
  const sql = getSql();
  const rows = await sql`
    INSERT INTO submissions (request_key, email, answers, loops_captured, marketing_consent, page_url, referrer, user_agent)
    VALUES (
      ${requestKey}::uuid,
      ${email},
      ${JSON.stringify(answers)}::jsonb,
      ${loopsCaptured},
      ${Boolean(marketingConsent)},
      ${pageUrl || null},
      ${referrer || null},
      ${userAgent || null}
    )
    ON CONFLICT (request_key) WHERE request_key IS NOT NULL DO NOTHING
    RETURNING id
  `;
  return rows[0]?.id || null;
}

export async function claimSubmission(id) {
  await ensureSubmissionsTable();
  const sql = getSql();
  const rows = await sql`
    UPDATE submissions
    SET processing_attempts = processing_attempts + 1,
        processing_lease_until = now() + interval '3 minutes',
        next_attempt_at = NULL,
        updated_at = now()
    WHERE id = ${id}::uuid
      AND status = 'processing'
      AND (next_attempt_at IS NULL OR next_attempt_at <= now())
      AND (processing_lease_until IS NULL OR processing_lease_until <= now())
    RETURNING id, email, answers, marketing_consent, processing_attempts
  `;
  return rows[0] || null;
}

export async function listRecoverableSubmissions(limit = 10) {
  await ensureSubmissionsTable();
  const sql = getSql();
  const safeLimit = Math.max(1, Math.min(25, Number.parseInt(limit, 10) || 10));
  return sql`
    SELECT id FROM submissions
    WHERE status = 'processing'
      AND (next_attempt_at IS NULL OR next_attempt_at <= now())
      AND (processing_lease_until IS NULL OR processing_lease_until <= now())
    ORDER BY created_at ASC LIMIT ${safeLimit}
  `;
}

export async function releaseSubmissionForRetry(id, errorMessage, attempts, maxAttempts = 3) {
  await ensureSubmissionsTable();
  const sql = getSql();
  const exhausted = Number(attempts) >= maxAttempts;
  const delaySeconds = retryDelaySeconds(attempts);
  await sql`
    UPDATE submissions
    SET status = ${exhausted ? "failed" : "processing"},
        error_message = ${String(errorMessage || "Unknown error").slice(0, 2000)},
        processing_lease_until = NULL,
        next_attempt_at = ${exhausted ? null : new Date(Date.now() + delaySeconds * 1000).toISOString()},
        updated_at = now()
    WHERE id = ${id}::uuid AND status = 'processing'
  `;
  return { exhausted, delaySeconds };
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
        prompt_version = ${String(usage.promptVersion || "unknown").slice(0, 100)},
        input_tokens = ${inputTokens},
        output_tokens = ${outputTokens},
        cost_usd = ${costUsd},
        usd_to_gbp_rate = ${usdToGbpRate},
        cost_gbp = ${costGbp},
        error_message = NULL,
        processing_lease_until = NULL,
        next_attempt_at = NULL,
        updated_at = now()
    WHERE id = ${id}::uuid
    RETURNING id, email, created_at, average_score, cost_gbp, report_email_sent, owner_notification_sent
  `;
  return rows[0];
}

export async function saveEmailDelivery(id, { reportSent, ownerSent, error }) {
  await ensureSubmissionsTable();
  const sql = getSql();
  const rows = await sql`
    UPDATE submissions
    SET report_email_sent = report_email_sent OR ${Boolean(reportSent)},
        owner_notification_sent = owner_notification_sent OR ${Boolean(ownerSent)},
        email_error = ${error || null},
        email_lease_until = NULL,
        next_email_attempt_at = CASE
          WHEN (report_email_sent OR ${Boolean(reportSent)}) AND (owner_notification_sent OR ${Boolean(ownerSent)}) THEN NULL
          WHEN email_attempts >= 5 THEN NULL
          ELSE now() + (LEAST(900, 30 * power(2, GREATEST(0, email_attempts - 1))) * interval '1 second')
        END,
        updated_at = now()
    WHERE id = ${id}::uuid
    RETURNING report_email_sent, owner_notification_sent, email_attempts, next_email_attempt_at
  `;
  return rows[0] || null;
}

export async function claimEmailDelivery(id, force = false) {
  await ensureSubmissionsTable();
  const sql = getSql();
  const rows = await sql`
    UPDATE submissions
    SET email_attempts = email_attempts + 1, email_lease_until = now() + interval '2 minutes', updated_at = now()
    WHERE id = ${id}::uuid AND status = 'completed'
      AND (NOT report_email_sent OR NOT owner_notification_sent)
      AND (${Boolean(force)} OR email_attempts < 5)
      AND (${Boolean(force)} OR next_email_attempt_at IS NULL OR next_email_attempt_at <= now())
      AND (email_lease_until IS NULL OR email_lease_until <= now())
    RETURNING id, email, result, average_score, cost_gbp, created_at,
              report_email_sent, owner_notification_sent, email_attempts
  `;
  return rows[0] || null;
}

export async function listRecoverableEmailDeliveries(limit = 10) {
  await ensureSubmissionsTable();
  const sql = getSql();
  const safeLimit = Math.max(1, Math.min(25, Number.parseInt(limit, 10) || 10));
  return sql`SELECT id FROM submissions WHERE status='completed'
    AND (NOT report_email_sent OR NOT owner_notification_sent) AND email_attempts < 5
    AND (next_email_attempt_at IS NULL OR next_email_attempt_at <= now())
    AND (email_lease_until IS NULL OR email_lease_until <= now())
    ORDER BY updated_at ASC LIMIT ${safeLimit}`;
}

export async function failSubmission(id, errorMessage) {
  await ensureSubmissionsTable();
  const sql = getSql();
  await sql`
    UPDATE submissions
    SET status = 'failed', error_message = ${String(errorMessage || "Unknown error").slice(0, 2000)},
        processing_lease_until = NULL, next_attempt_at = NULL, updated_at = now()
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
              model, prompt_version, input_tokens, output_tokens, cost_usd, usd_to_gbp_rate, cost_gbp,
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

export async function deleteExpiredSubmissions(retentionDays = 365, analyticsRetentionDays = 90) {
  await ensureSubmissionsTable();
  const sql = getSql();
  const safeDays = Math.max(30, Math.min(3650, Number.parseInt(retentionDays, 10) || 365));
  const rows = await sql`DELETE FROM submissions WHERE created_at < now() - (${safeDays} * interval '1 day') RETURNING id`;
  await sql`DELETE FROM rate_limits WHERE window_started_at < now() - interval '2 days'`;
  const safeAnalyticsDays = Math.max(30, Math.min(365, Number.parseInt(analyticsRetentionDays, 10) || 90));
  await sql`DELETE FROM analytics_events WHERE created_at < now() - (${safeAnalyticsDays} * interval '1 day')`;
  await sql`DELETE FROM operational_alerts WHERE created_at < now() - interval '400 days'`;
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

export async function recordAnalyticsEvent(sessionId, eventName, properties = {}) {
  await ensureSubmissionsTable();
  const sql = getSql();
  const sessionHash = crypto.createHash("sha256").update(String(sessionId)).digest("hex");
  const safeProperties = sanitizeAnalyticsProperties(properties);
  await sql`INSERT INTO analytics_events (session_hash, event_name, properties) VALUES (${sessionHash}, ${eventName}, ${JSON.stringify(safeProperties)}::jsonb) ON CONFLICT DO NOTHING`;
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

export async function getAnalyticsInsights(days = 30) {
  await ensureSubmissionsTable();
  const sql = getSql();
  const safeDays = Math.max(1, Math.min(365, Number.parseInt(days, 10) || 30));
  const rows = await sql`SELECT COUNT(DISTINCT session_hash) FILTER (WHERE event_name='started')::int AS started,
    COUNT(DISTINCT session_hash) FILTER (WHERE event_name='submitted')::int AS submitted,
    COUNT(DISTINCT session_hash) FILTER (WHERE event_name='completed')::int AS completed,
    COUNT(DISTINCT session_hash) FILTER (WHERE event_name='share_created')::int AS shared,
    COUNT(DISTINCT session_hash) FILTER (WHERE event_name='experiment_opened')::int AS experiment_opened
    FROM analytics_events WHERE created_at >= now() - (${safeDays} * interval '1 day')`;
  const data=rows[0] || {}, started=Number(data.started || 0), completed=Number(data.completed || 0);
  return { submissionConversion:started ? Number(data.submitted || 0)/started : 0, completionConversion:started ? completed/started : 0, shareConversion:completed ? Number(data.shared || 0)/completed : 0, experimentConversion:completed ? Number(data.experiment_opened || 0)/completed : 0 };
}

export async function getOperationalHealth() {
  await ensureSubmissionsTable();
  const sql = getSql();
  const rows = await sql`SELECT
    COUNT(*) FILTER (WHERE status='processing' AND updated_at < now() - interval '5 minutes')::int AS stale_processing,
    COUNT(*) FILTER (WHERE processing_attempts > 1)::int AS retried_processing,
    COUNT(*) FILTER (WHERE status='completed' AND (NOT report_email_sent OR NOT owner_notification_sent))::int AS incomplete_email_delivery,
    COUNT(*) FILTER (WHERE email_attempts > 1)::int AS retried_email_delivery,
    COALESCE(percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (updated_at-created_at))) FILTER (WHERE status='completed'),0)::numeric AS median_completion_seconds,
    COALESCE(percentile_cont(0.95) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (updated_at-created_at))) FILTER (WHERE status='completed'),0)::numeric AS p95_completion_seconds,
    COALESCE(SUM(cost_gbp) FILTER (WHERE created_at >= date_trunc('day',now())),0)::numeric AS cost_today_gbp
    FROM submissions`;
  return Object.fromEntries(Object.entries(rows[0] || {}).map(([key,value]) => [key, Number(value || 0)]));
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
    metric_name=${input.metricName}, baseline_value=${input.baselineValue}, observed_value=${input.observedValue}, learning=${input.learning},
    deadline=${input.deadline || null}, result=${input.result}, decision=${input.decision}, status=${input.status}, updated_at=now()
    FROM submissions s WHERE e.id=${experimentId}::uuid AND e.submission_id=s.id AND s.request_key=${requestKey}::uuid RETURNING e.*`;
  return rows[0] || null;
}

export async function listDueExperimentReminders(limit = 20) {
  await ensureSubmissionsTable();
  const sql = getSql();
  const safeLimit = Math.max(1, Math.min(50, Number.parseInt(limit, 10) || 20));
  return sql`SELECT e.id, e.hypothesis, e.deadline, e.success_threshold, s.email, s.idea_name
    FROM validation_experiments e JOIN submissions s ON s.id=e.submission_id
    WHERE e.status IN ('planned','running') AND e.reminder_sent_at IS NULL
      AND e.deadline IS NOT NULL AND e.deadline <= current_date + 1 AND e.deadline >= current_date
    ORDER BY e.deadline, e.position LIMIT ${safeLimit}`;
}

export async function markExperimentReminderSent(id) {
  await ensureSubmissionsTable();
  const sql = getSql();
  await sql`UPDATE validation_experiments SET reminder_sent_at=now(), updated_at=now() WHERE id=${id}::uuid AND reminder_sent_at IS NULL`;
}

export function tokenHash(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

export function sanitizeAnalyticsProperties(properties = {}) {
  return { path:String(properties.path || "").slice(0, 120), referrerHost:String(properties.referrerHost || "").slice(0, 120), viewport:["mobile","tablet","desktop"].includes(properties.viewport) ? properties.viewport : "unknown" };
}

export async function createReportAccessForSubmission(submissionId, expiryDays = 90) {
  await ensureSubmissionsTable();
  const sql = getSql();
  const token = crypto.randomBytes(32).toString("base64url");
  const days = Math.max(1, Math.min(365, Number.parseInt(expiryDays, 10) || 90));
  const rows = await sql`INSERT INTO report_access_tokens (submission_id, token_hash, expires_at)
    SELECT id, ${tokenHash(token)}, now() + (${days} * interval '1 day') FROM submissions
    WHERE id=${submissionId}::uuid AND status='completed' RETURNING expires_at`;
  return rows[0] ? { token, expiresAt:rows[0].expires_at } : null;
}

export async function createReportAccessForRequest(requestKey, expiryDays = 90) {
  await ensureSubmissionsTable();
  const sql = getSql();
  const rows = await sql`SELECT id FROM submissions WHERE request_key=${requestKey}::uuid AND status='completed' LIMIT 1`;
  return rows[0] ? createReportAccessForSubmission(rows[0].id, expiryDays) : null;
}

export async function getReportAccess(token) {
  await ensureSubmissionsTable();
  const sql = getSql();
  const rows = await sql`SELECT s.id, s.request_key, s.answers, s.result, s.idea_name, s.verdict, s.average_score,
      s.confidence, a.expires_at FROM report_access_tokens a JOIN submissions s ON s.id=a.submission_id
    WHERE a.token_hash=${tokenHash(token)} AND a.revoked_at IS NULL AND a.expires_at>now() AND s.status='completed' LIMIT 1`;
  return rows[0] || null;
}

export async function validReportAccess(requestKey, token) {
  if (!token) return false;
  await ensureSubmissionsTable();
  const sql = getSql();
  const rows = await sql`SELECT 1 FROM report_access_tokens a JOIN submissions s ON s.id=a.submission_id
    WHERE s.request_key=${requestKey}::uuid AND a.token_hash=${tokenHash(token)}
      AND a.revoked_at IS NULL AND a.expires_at>now() LIMIT 1`;
  return rows.length === 1;
}

export async function getReassessmentContext(requestKey) {
  await ensureSubmissionsTable();
  const sql = getSql();
  const submissions = await sql`SELECT id, answers, result FROM submissions WHERE request_key=${requestKey}::uuid AND status='completed' LIMIT 1`;
  if (!submissions[0]) return null;
  const experiments = await sql`SELECT position, hypothesis, method, success_threshold, result, decision, status, updated_at
    FROM validation_experiments WHERE submission_id=${submissions[0].id}::uuid ORDER BY position`;
  return { ...submissions[0], experiments };
}

export async function saveReportRevision(submissionId, result, usage, evidenceSnapshot) {
  await ensureSubmissionsTable();
  const sql = getSql();
  const inputTokens = Math.max(0, Number(usage.inputTokens || 0));
  const outputTokens = Math.max(0, Number(usage.outputTokens || 0));
  const costUsd = (inputTokens * Number(process.env.ANTHROPIC_INPUT_USD_PER_MILLION || 3) + outputTokens * Number(process.env.ANTHROPIC_OUTPUT_USD_PER_MILLION || 15)) / 1_000_000;
  const costGbp = costUsd * Number(process.env.USD_TO_GBP_RATE || 0.75);
  const rows = await sql`INSERT INTO report_revisions (submission_id, result, model, prompt_version, input_tokens, output_tokens, cost_usd, cost_gbp, evidence_snapshot)
    VALUES (${submissionId}::uuid, ${JSON.stringify(result)}::jsonb, ${usage.model || null}, ${usage.promptVersion || "unknown"}, ${inputTokens}, ${outputTokens}, ${costUsd}, ${costGbp}, ${JSON.stringify(evidenceSnapshot)}::jsonb)
    RETURNING id, created_at, result, model, prompt_version, input_tokens, output_tokens, cost_usd, cost_gbp`;
  return rows[0];
}

export async function listReportRevisions(requestKey) {
  await ensureSubmissionsTable();
  const sql = getSql();
  return sql`SELECT r.id, r.created_at, r.result, r.model, r.prompt_version, r.input_tokens, r.output_tokens, r.cost_usd, r.cost_gbp
    FROM report_revisions r JOIN submissions s ON s.id=r.submission_id
    WHERE s.request_key=${requestKey}::uuid ORDER BY r.created_at DESC`;
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
