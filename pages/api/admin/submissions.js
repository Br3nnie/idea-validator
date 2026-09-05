import { validAdminSession } from "../../../lib/adminAuth";
import { getAnalyticsInsights, getAnalyticsSummary, getOperationalHealth, listSubmissions } from "../../../lib/submissions";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  if (!validAdminSession(req)) return res.status(401).json({ error: "Authentication required" });

  try {
    const [data, analytics, health, analyticsInsights] = await Promise.all([
      listSubmissions({ search:req.query.search, status:req.query.status, verdict:req.query.verdict, page:req.query.page, pageSize:req.query.pageSize }),
      getAnalyticsSummary(30),
      getOperationalHealth(),
      getAnalyticsInsights(30),
    ]);
    return res.status(200).json({ ...data, analytics, health, analyticsInsights });
  } catch (error) {
    console.error("Admin submissions error:", error);
    return res.status(500).json({ error: "Could not load submissions" });
  }
}
