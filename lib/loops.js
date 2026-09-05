const LOOPS_TRANSACTIONAL_URL = "https://app.loops.so/api/v1/transactional";

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
  const assumptions = Array.isArray(result.assumptions) ? result.assumptions : [];
  const scores = Array.isArray(result.scoring) ? result.scoring : [];
  const validation = Array.isArray(result.validationSteps) ? result.validationSteps : [];
  const next = Array.isArray(result.nextSteps) ? result.nextSteps : [];
  const assumption = index => assumptions[index]
    ? `${assumptions[index].assumption} (${assumptions[index].risk || "unknown"} risk) — ${assumptions[index].evidence || "No evidence noted"}`
    : "Not provided";
  const score = index => scores[index]
    ? `${scores[index].name}: ${scores[index].score}/10 — ${scores[index].note || "No note provided"}`
    : "Not provided";
  const validationStep = index => validation[index]
    ? `${validation[index].label}: ${validation[index].description} (${validation[index].effort || "effort not set"})`
    : "Not provided";

  return sendTransactional({
    email,
    transactionalId: process.env.LOOPS_REPORT_TRANSACTIONAL_ID,
    idempotencyKey: `${id}-completed-report`,
    dataVariables: {
      ideaName: result.ideaName || "Your idea",
      tagline: result.tagline || "A practical validation report",
      verdict: result.verdict || "TEST",
      confidence: Number(result.confidence || 0),
      averageScore: Number(averageScore || 0).toFixed(1),
      rationale: result.rationale || "Not provided",
      problem: result.problem || "Not provided",
      solution: result.solution || "Not provided",
      differentiation: result.differentiation || "Not provided",
      assumption1: assumption(0),
      assumption2: assumption(1),
      assumption3: assumption(2),
      score1: score(0),
      score2: score(1),
      score3: score(2),
      score4: score(3),
      score5: score(4),
      score6: score(5),
      validation1: validationStep(0),
      validation2: validationStep(1),
      validation3: validationStep(2),
      next1: next[0] || "Not provided",
      next2: next[1] || "Not provided",
      next3: next[2] || "Not provided",
    },
  });
}

export async function sendOwnerNotification({ id, email, result, averageScore, costGbp, createdAt }) {
  return sendTransactional({
    email: process.env.OWNER_NOTIFICATION_EMAIL,
    transactionalId: process.env.LOOPS_OWNER_TRANSACTIONAL_ID,
    idempotencyKey: `${id}-owner-notification`,
    dataVariables: {
      ideaName: result.ideaName || "Unnamed idea",
      submitterEmail: email,
      verdict: result.verdict || "TEST",
      confidence: Number(result.confidence || 0),
      averageScore: Number(averageScore || 0).toFixed(1),
      costGbp: `£${Number(costGbp || 0).toFixed(4)}`,
      submittedAt: new Date(createdAt).toLocaleString("en-GB", { timeZone:"Europe/London" }),
    },
  });
}
