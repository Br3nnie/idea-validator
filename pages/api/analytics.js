import { hasDatabase, recordAnalyticsEvent } from "../../lib/submissions";

const EVENTS = new Set(["started", "question_1", "question_2", "question_3", "question_4", "question_5", "question_6", "question_7", "reviewed", "email_gate", "submitted", "completed", "failed", "share_created", "experiment_opened", "reassessed", "cta_nav", "cta_hero", "cta_questions", "cta_closer", "faq_opened"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error:"Method not allowed" });
  const { sessionId, event, properties } = req.body || {};
  if (!UUID_PATTERN.test(String(sessionId || "")) || !EVENTS.has(event)) return res.status(400).json({ error:"Invalid event" });
  if (!hasDatabase()) return res.status(204).end();
  try {
    await recordAnalyticsEvent(sessionId, event, properties);
    return res.status(204).end();
  } catch (error) {
    console.error("Analytics event error:", error);
    return res.status(204).end();
  }
}

export const config = { api:{ bodyParser:{ sizeLimit:"2kb" } } };
