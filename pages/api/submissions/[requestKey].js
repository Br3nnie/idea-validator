import { findSubmissionByRequestKey, hasDatabase } from "../../../lib/submissions";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).json({ error:"Method not allowed" });
  if (!UUID_PATTERN.test(String(req.query.requestKey || ""))) return res.status(400).json({ error:"Invalid request key" });
  if (!hasDatabase()) return res.status(503).json({ error:"Submission storage is unavailable" });
  try {
    const submission = await findSubmissionByRequestKey(req.query.requestKey);
    if (!submission) return res.status(404).json({ error:"Report not found" });
    if (submission.status === "completed") return res.status(200).json({ id:submission.id, status:submission.status, result:submission.result });
    if (submission.status === "failed") return res.status(200).json({ id:submission.id, status:submission.status, error:"The report could not be generated. Please start a new request." });
    return res.status(200).json({ id:submission.id, status:"processing", updatedAt:submission.updated_at });
  } catch (error) {
    console.error("Submission status error:", error);
    return res.status(500).json({ error:"Could not load report status" });
  }
}
