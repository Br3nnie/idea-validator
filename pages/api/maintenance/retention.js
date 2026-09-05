import { deleteExpiredSubmissions, hasDatabase } from "../../../lib/submissions";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).json({ error:"Method not allowed" });
  const expected = process.env.CRON_SECRET;
  if (!expected || req.headers.authorization !== `Bearer ${expected}`) return res.status(401).json({ error:"Authentication required" });
  if (!hasDatabase()) return res.status(503).json({ error:"Database is not configured" });
  try {
    const deleted = await deleteExpiredSubmissions(process.env.SUBMISSION_RETENTION_DAYS || 365, process.env.ANALYTICS_RETENTION_DAYS || 90);
    return res.status(200).json({ deleted });
  } catch (error) {
    console.error("Retention cleanup error:", error);
    return res.status(500).json({ error:"Retention cleanup failed" });
  }
}
