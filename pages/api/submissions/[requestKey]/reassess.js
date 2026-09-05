import { generateValidation } from "../../../../lib/anthropic";
import { getReassessmentContext, listReportRevisions, saveReportRevision, validReportAccess } from "../../../../lib/submissions";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const requestKey = String(req.query.requestKey || "");
  if (!UUID_PATTERN.test(requestKey)) return res.status(400).json({ error:"Invalid request key" });
  if (!await validReportAccess(requestKey, req.headers["x-report-access-token"])) return res.status(401).json({ error:"Report access required" });
  try {
    if (req.method === "GET") return res.status(200).json({ revisions:await listReportRevisions(requestKey) });
    if (req.method !== "POST") return res.status(405).json({ error:"Method not allowed" });
    const context = await getReassessmentContext(requestKey);
    if (!context) return res.status(404).json({ error:"Report not found" });
    const completed = context.experiments.filter(item => item.status === "completed" && item.result?.trim());
    if (!completed.length) return res.status(400).json({ error:"Complete at least one experiment and record its result first" });
    const experimentEvidence = completed.map((item, index) => `Experiment ${index + 1}: ${item.hypothesis}\nSuccess threshold: ${item.success_threshold || "Not set"}\nObserved result: ${item.result}\nDecision: ${item.decision || "Not recorded"}`).join("\n\n");
    const { result, usage } = await generateValidation({ ...context.answers, experimentEvidence });
    const revision = await saveReportRevision(context.id, result, usage, completed);
    return res.status(201).json({ revision, original:context.result });
  } catch (error) {
    console.error("Report reassessment error:", error);
    return res.status(500).json({ error:"Could not reassess this report" });
  }
}

export const config = { maxDuration:120 };
