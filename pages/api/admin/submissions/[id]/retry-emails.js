import { waitUntil } from "@vercel/functions";
import { validAdminSession } from "../../../../../lib/adminAuth";
import { deliverSubmissionEmails } from "../../../../../lib/deliverSubmission";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error:"Method not allowed" });
  if (!validAdminSession(req)) return res.status(401).json({ error:"Authentication required" });
  if (!UUID_PATTERN.test(String(req.query.id || ""))) return res.status(400).json({ error:"Invalid submission" });
  waitUntil(deliverSubmissionEmails({ id:req.query.id, force:true }));
  return res.status(202).json({ scheduled:true });
}
