import {
  completeSubmission,
  createSubmission,
  failSubmission,
  hasDatabase,
} from "../../lib/submissions";

const REQUIRED_ANSWERS = ["idea", "user", "evidence", "competition", "monetisation", "blockers"];

function validEmail(value) {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function captureInLoops(email, answers) {
  if (!process.env.LOOPS_API_KEY) return false;

  const ideaSummary = REQUIRED_ANSWERS
    .map(key => `${key}: ${String(answers[key] || "")}`)
    .join("\n")
    .slice(0, 2000);

  try {
    const response = await fetch("https://app.loops.so/api/v1/contacts/update", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.LOOPS_API_KEY}`,
      },
      body: JSON.stringify({
        email,
        source: "test-my-idea",
        ideaSummary,
        ...(process.env.LOOPS_MAILING_LIST_ID?.trim()
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
  if (req.method === "POST") {
    const { email, answers, pageUrl, referrer } = req.body || {};
    if (!validEmail(email) || email.length > 320) return res.status(400).json({ error: "A valid email is required" });
    if (!answers || REQUIRED_ANSWERS.some(key => typeof answers[key] !== "string" || !answers[key].trim())) {
      return res.status(400).json({ error: "All six answers are required" });
    }
    const cleanAnswers = Object.fromEntries(
      REQUIRED_ANSWERS.map(key => [key, answers[key].trim().slice(0, 5000)])
    );

    const loopsCaptured = await captureInLoops(email.trim().toLowerCase(), cleanAnswers);
    if (!hasDatabase()) {
      console.error("Submission storage disabled: DATABASE_URL is not configured");
      return res.status(200).json({ id: null, loopsCaptured, stored: false });
    }

    try {
      const id = await createSubmission({
        email: email.trim().toLowerCase(),
        answers: cleanAnswers,
        loopsCaptured,
        pageUrl: String(pageUrl || "").slice(0, 2000),
        referrer: String(referrer || "").slice(0, 2000),
        userAgent: req.headers["user-agent"],
      });
      return res.status(201).json({ id, loopsCaptured, stored: true });
    } catch (error) {
      console.error("Submission create error:", error);
      return res.status(200).json({ id: null, loopsCaptured, stored: false });
    }
  }

  if (req.method === "PUT") {
    const { id, status, result, error } = req.body || {};
    if (!id) return res.status(400).json({ error: "Submission ID is required" });
    if (!hasDatabase()) return res.status(503).json({ error: "Submission storage is not configured" });

    try {
      if (status === "completed" && result) await completeSubmission(id, result);
      else if (status === "failed") await failSubmission(id, error);
      else return res.status(400).json({ error: "Invalid submission update" });
      return res.status(200).json({ saved: true });
    } catch (saveError) {
      console.error("Submission update error:", saveError);
      return res.status(500).json({ error: "Could not save submission" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
