const LOOPS_TRANSACTIONAL_URL = "https://app.loops.so/api/v1/transactional";
const REQUIRED_ANSWERS = ["idea", "user", "evidence", "competition", "monetisation", "blockers"];

export async function captureContact(email, answers, marketingConsent = false) {
  if (!process.env.LOOPS_API_KEY) return false;
  const ideaSummary = REQUIRED_ANSWERS.map(key => `${key}: ${String(answers[key] || "")}`).join("\n").slice(0, 2000);
  try {
    const response = await fetch("https://app.loops.so/api/v1/contacts/update", {
      method:"PUT",
      signal:AbortSignal.timeout(15000),
      headers:{ "Content-Type":"application/json", Authorization:`Bearer ${process.env.LOOPS_API_KEY}` },
      body:JSON.stringify({
        email,
        source:"test-my-idea",
        ideaSummary,
        ...(marketingConsent && process.env.LOOPS_MAILING_LIST_ID?.trim()
          ? { mailingLists:{ [process.env.LOOPS_MAILING_LIST_ID.trim()]:true } }
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

async function sendTransactional({ email, transactionalId, dataVariables, idempotencyKey }) {
  if (!process.env.LOOPS_API_KEY || !transactionalId || !email) {
    return { sent:false, error:"Loops transactional email is not fully configured" };
  }

  try {
    const response = await fetch(LOOPS_TRANSACTIONAL_URL, {
      method: "POST",
      signal: AbortSignal.timeout(15000),
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

export async function sendCompletedReport({ id, email, result, averageScore, reportUrl }) {
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
      evidenceLevel: result.evidenceStrength?.level || "Not provided",
      evidenceRationale: result.evidenceStrength?.rationale || "Not provided",
      evidenceGap: result.evidenceStrength?.biggestGap || "Not provided",
      verdictChange: result.evidenceStrength?.wouldChangeVerdict || "Not provided",
      reportUrl: reportUrl || "https://www.testmyidea.co.uk",
      problem: result.problem || "Not provided",
      solution: result.solution || "Not provided",
      differentiation: result.differentiation || "Not provided",
      assumption1: assumption(0),
      assumption2: assumption(1),
      assumption3: assumption(2),
      assumption4: assumption(3),
      score1: score(0),
      score2: score(1),
      score3: score(2),
      score4: score(3),
      score5: score(4),
      score6: score(5),
      validation1: validationStep(0),
      validation2: validationStep(1),
      validation3: validationStep(2),
      validation4: validationStep(3),
      next1: next[0] || "Not provided",
      next2: next[1] || "Not provided",
      next3: next[2] || "Not provided",
      next4: next[3] || "Not provided",
      next5: next[4] || "Not provided",
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

export async function sendExperimentReminder({ id, email, ideaName, hypothesis, deadline, successThreshold }) {
  return sendTransactional({
    email,
    transactionalId:process.env.LOOPS_EXPERIMENT_REMINDER_ID,
    idempotencyKey:`${id}-experiment-reminder`,
    dataVariables:{
      ideaName:ideaName || "Your idea", hypothesis, deadline:new Date(deadline).toLocaleDateString("en-GB"),
      successThreshold:successThreshold || "Not set", reportUrl:process.env.PUBLIC_SITE_URL || "https://www.testmyidea.co.uk",
    },
  });
}
