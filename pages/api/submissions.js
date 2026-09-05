import { waitUntil } from "@vercel/functions";
import { consumeRateLimit, createSubmission, findSubmissionByRequestKey, hasDatabase } from "../../lib/submissions";
import { processSubmission } from "../../lib/processSubmission";
import { verifyTurnstile } from "../../lib/turnstile";

const REQUIRED_ANSWERS = ["idea", "user", "evidence", "competition", "monetisation", "blockers"];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validEmail(value) {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "POST") {
    const { requestKey, email, answers, pageUrl, referrer, marketingConsent = false, turnstileToken } = req.body || {};
    if (!UUID_PATTERN.test(String(requestKey || ""))) return res.status(400).json({ error:"A valid request key is required" });
    if (!validEmail(email) || email.length > 320) return res.status(400).json({ error: "A valid email is required" });
    if (!answers || REQUIRED_ANSWERS.some(key => typeof answers[key] !== "string" || !answers[key].trim())) {
      return res.status(400).json({ error: "All six answers are required" });
    }
    const cleanAnswers = Object.fromEntries(
      REQUIRED_ANSWERS.map(key => [key, answers[key].trim().slice(0, 5000)])
    );
    if (typeof answers.followup === "string" && answers.followup.trim()) cleanAnswers.followup = answers.followup.trim().slice(0, 5000);
    if (!hasDatabase()) {
      console.error("Submission processing disabled: DATABASE_URL is not configured");
      return res.status(503).json({ error: "Submission processing is temporarily unavailable" });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const clientIp = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").split(",")[0].trim();
    try {
      const existing = await findSubmissionByRequestKey(requestKey);
      if (existing) {
        if (existing.status === "completed") return res.status(200).json({ id:existing.id, result:existing.result, duplicate:true });
        if (existing.status === "failed") return res.status(409).json({ id:existing.id, error:"This report attempt failed. Start a new request to retry.", duplicate:true });
        return res.status(202).json({ id:existing.id, status:"processing", duplicate:true });
      }
      if (!await verifyTurnstile(turnstileToken, clientIp)) return res.status(403).json({ error:"Security check failed. Please refresh and try again." });
      const [ipLimit, emailLimit] = await Promise.all([
        consumeRateLimit({ scope:"submission-ip", identifier:clientIp, limit:10, windowSeconds:86400 }),
        consumeRateLimit({ scope:"submission-email", identifier:normalizedEmail, limit:5, windowSeconds:86400 }),
      ]);
      if (!ipLimit.allowed || !emailLimit.allowed) {
        res.setHeader("Retry-After", "86400");
        return res.status(429).json({ error: "Daily submission limit reached. Please try again tomorrow." });
      }

      const id = await createSubmission({
        requestKey,
        email: normalizedEmail,
        answers: cleanAnswers,
        loopsCaptured:false,
        pageUrl: String(pageUrl || "").slice(0, 2000),
        referrer: String(referrer || "").slice(0, 2000),
        userAgent: req.headers["user-agent"],
      });
      if (!id) {
        const raced = await findSubmissionByRequestKey(requestKey);
        return res.status(202).json({ id:raced?.id || null, status:raced?.status || "processing", duplicate:true });
      }
      waitUntil(processSubmission({ id, email:normalizedEmail, answers:cleanAnswers, marketingConsent:Boolean(marketingConsent) }));
      return res.status(202).json({ id, status:"processing" });
    } catch (error) {
      console.error("Submission processing error:", error);
      return res.status(500).json({ error: "Could not generate the report. Please try again." });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}

export const config = { api:{ bodyParser:{ sizeLimit:"40kb" } } };
