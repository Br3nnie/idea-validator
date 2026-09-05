import { createReportShare, revokeReportShares } from "../../../../lib/submissions";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const requestKey = String(req.query.requestKey || "");
  if (!UUID_PATTERN.test(requestKey)) return res.status(400).json({ error:"Invalid request key" });
  try {
    if (req.method === "POST") {
      const share = await createReportShare(requestKey, req.body?.expiryDays);
      if (!share) return res.status(404).json({ error:"Completed report not found" });
      return res.status(201).json({ url:`${process.env.PUBLIC_SITE_URL || "https://www.testmyidea.co.uk"}/share/${share.token}`, expiresAt:share.expiresAt });
    }
    if (req.method === "DELETE") return res.status(200).json({ revoked:await revokeReportShares(requestKey) });
    return res.status(405).json({ error:"Method not allowed" });
  } catch (error) {
    console.error("Share API error:", error);
    return res.status(500).json({ error:"Could not manage the share link" });
  }
}
