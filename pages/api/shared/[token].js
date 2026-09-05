import { getSharedReport } from "../../../lib/submissions";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method !== "GET") return res.status(405).json({ error:"Method not allowed" });
  const token = String(req.query.token || "");
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return res.status(400).json({ error:"Invalid share link" });
  try {
    const report = await getSharedReport(token);
    if (!report) return res.status(404).json({ error:"This share link is invalid or has expired" });
    return res.status(200).json(report);
  } catch (error) {
    console.error("Shared report error:", error);
    return res.status(500).json({ error:"Could not load the shared report" });
  }
}
