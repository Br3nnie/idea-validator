import {
  completeSubmission,
  consumeRateLimit,
  createSubmission,
  failSubmission,
  hasDatabase,
  saveEmailDelivery,
} from "../../lib/submissions";
import { sendCompletedReport, sendOwnerNotification } from "../../lib/loops";
import { generateValidation } from "../../lib/anthropic";

const REQUIRED_ANSWERS = ["idea", "user", "evidence", "competition", "monetisation", "blockers"];

function validEmail(value) {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function captureInLoops(email, answers, marketingConsent) {
  if (!process.env.LOOPS_API_KEY) return false;

  const ideaSummary = REQUIRED_ANSWERS
    .map(key => `${key}: ${String(answers[key] || "")}`)
    .join("\n")
    .slice(0, 2000);

  try {
    const response = await fetch("https://app.loops.so/api/v1/contacts/update", {
      method: "PUT",
      signal: AbortSignal.timeout(15000),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.LOOPS_API_KEY}`,
      },
      body: JSON.stringify({
        email,
        source: "test-my-idea",
        ideaSummary,
        ...(marketingConsent && process.env.LOOPS_MAILING_LIST_ID?.trim()
          ? { mailingLists: { [process.env.LOOPS_MAILING_LIST_ID.trim()]: true } }
          : {}),
      }),
    });
    if (!response.ok) console.error("Loops contact error:", response.status);
    return response.ok;
  } catch (error) {
    console.error("Loops capture error:", error);
    return false;
  }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "POST") {
    const { email, answers, pageUrl, referrer, marketingConsent = false } = req.body || {};
    if (!validEmail(email) || email.length > 320) return res.status(400).json({ error: "A valid email is required" });
    if (!answers || REQUIRED_ANSWERS.some(key => typeof answers[key] !== "string" || !answers[key].trim())) {
      return res.status(400).json({ error: "All six answers are required" });
    }
    const cleanAnswers = Object.fromEntries(
      REQUIRED_ANSWERS.map(key => [key, answers[key].trim().slice(0, 5000)])
    );
    if (!hasDatabase()) {
      console.error("Submission processing disabled: DATABASE_URL is not configured");
      return res.status(503).json({ error: "Submission processing is temporarily unavailable" });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const clientIp = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").split(",")[0].trim();
    try {
      const [ipLimit, emailLimit] = await Promise.all([
        consumeRateLimit({ scope:"submission-ip", identifier:clientIp, limit:10, windowSeconds:86400 }),
        consumeRateLimit({ scope:"submission-email", identifier:normalizedEmail, limit:5, windowSeconds:86400 }),
      ]);
      if (!ipLimit.allowed || !emailLimit.allowed) {
        res.setHeader("Retry-After", "86400");
        return res.status(429).json({ error: "Daily submission limit reached. Please try again tomorrow." });
      }

      const loopsCaptured = await captureInLoops(normalizedEmail, cleanAnswers, Boolean(marketingConsent));
      const id = await createSubmission({
        email: normalizedEmail,
        answers: cleanAnswers,
        loopsCaptured,
        pageUrl: String(pageUrl || "").slice(0, 2000),
        referrer: String(referrer || "").slice(0, 2000),
        userAgent: req.headers["user-agent"],
      });
      try {
        const { result, usage } = await generateValidation(cleanAnswers);
        const submission = await completeSubmission(id, result, usage);
        const [reportDelivery, ownerDelivery] = await Promise.all([
          sendCompletedReport({ id, email:normalizedEmail, result, averageScore:submission.average_score }),
          sendOwnerNotification({ id, email:normalizedEmail, result, averageScore:submission.average_score, costGbp:submission.cost_gbp, createdAt:submission.created_at }),
        ]);
        const deliveryErrors = [reportDelivery.error, ownerDelivery.error].filter(Boolean).join("; ");
        try {
          await saveEmailDelivery(id, { reportSent:reportDelivery.sent, ownerSent:ownerDelivery.sent, error:deliveryErrors });
        } catch (deliverySaveError) {
          console.error("Email delivery status save error:", deliverySaveError);
        }
        return res.status(201).json({ id, result });
      } catch (generationError) {
        await failSubmission(id, generationError.message);
        throw generationError;
      }
    } catch (error) {
      console.error("Submission processing error:", error);
      return res.status(500).json({ error: "Could not generate the report. Please try again." });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}

export const config = { api:{ bodyParser:{ sizeLimit:"40kb" } } };
