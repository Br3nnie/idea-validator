const LOOPS_TRANSACTIONAL_URL = "https://app.loops.so/api/v1/transactional";

function list(items, formatter) {
  return Array.isArray(items) && items.length
    ? items.map((item, index) => `${index + 1}. ${formatter(item)}`).join("\n")
    : "Not provided";
}

async function sendTransactional({ email, transactionalId, dataVariables, idempotencyKey }) {
  if (!process.env.LOOPS_API_KEY || !transactionalId || !email) {
    return { sent:false, error:"Loops transactional email is not fully configured" };
  }

  try {
    const response = await fetch(LOOPS_TRANSACTIONAL_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.LOOPS_API_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({ email, transactionalId, dataVariables }),
    });
    const payload = await response.json().catch(() => ({}));
    if (response.ok || response.status === 409) return { sent:true, duplicate:response.status === 409 };
    return { sent:false, error:payload.message || `Loops returned ${response.status}` };
  } catch (error) {
    return { sent:false, error:error.message };
  }
}

export async function sendCompletedReport({ id, email, result, averageScore }) {
  const reportText = [
    result.ideaName || "Your idea",
    result.tagline || "",
    "",
    `Verdict: ${result.verdict || "TEST"}`,
    `Confidence: ${Number(result.confidence || 0)}%`,
    `Average score: ${Number(averageScore || 0).toFixed(1)}/10`,
    "",
    "Why this verdict",
    result.rationale || "Not provided",
    "",
    "Problem",
    result.problem || "Not provided",
    "",
    "Solution",
    result.solution || "Not provided",
    "",
    "Differentiation",
    result.differentiation || "Not provided",
    "",
    "Critical assumptions",
    list(result.assumptions, item => `${item.assumption} (${item.risk} risk) — ${item.evidence || "No evidence noted"}`),
    "",
    "Scores",
    list(result.scoring, item => `${item.name}: ${item.score}/10 — ${item.note || ""}`),
    "",
    "Validation plan",
    list(result.validationSteps, item => `${item.label}: ${item.description} [${item.effort || "effort not set"}]`),
    "",
    "Next steps",
    list(result.nextSteps, item => item),
  ].join("\n");

  return sendTransactional({
    email,
    transactionalId: process.env.LOOPS_REPORT_TRANSACTIONAL_ID,
    idempotencyKey: `${id}-completed-report`,
    dataVariables: { reportText },
  });
}

export async function sendOwnerNotification({ id, email, result, averageScore, costGbp, createdAt }) {
  const notificationText = [
    `Idea: ${result.ideaName || "Unnamed idea"}`,
    `Submitter: ${email}`,
    `Verdict: ${result.verdict || "TEST"}`,
    `Confidence: ${Number(result.confidence || 0)}%`,
    `Average score: ${Number(averageScore || 0).toFixed(1)}/10`,
    `Generation cost: £${Number(costGbp || 0).toFixed(4)}`,
    `Submitted: ${new Date(createdAt).toLocaleString("en-GB", { timeZone:"Europe/London" })}`,
  ].join("\n");

  return sendTransactional({
    email: process.env.OWNER_NOTIFICATION_EMAIL,
    transactionalId: process.env.LOOPS_OWNER_TRANSACTIONAL_ID,
    idempotencyKey: `${id}-owner-notification`,
    dataVariables: { notificationText },
  });
}
