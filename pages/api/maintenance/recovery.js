import { waitUntil } from "@vercel/functions";
import { listRecoverableEmailDeliveries, listRecoverableSubmissions } from "../../../lib/submissions";
import { processSubmission } from "../../../lib/processSubmission";
import { deliverSubmissionEmails } from "../../../lib/deliverSubmission";
import { deliverDueExperimentReminders } from "../../../lib/experimentReminders";

function authorised(req) {
  const expected = process.env.CRON_SECRET;
  return Boolean(expected) && req.headers.authorization === `Bearer ${expected}`;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).json({ error:"Method not allowed" });
  if (!authorised(req)) return res.status(401).json({ error:"Unauthorized" });
  try {
    const [rows, emailRows] = await Promise.all([listRecoverableSubmissions(10), listRecoverableEmailDeliveries(10)]);
    rows.forEach(row => waitUntil(processSubmission({ id:row.id })));
    emailRows.forEach(row => waitUntil(deliverSubmissionEmails({ id:row.id })));
    waitUntil(deliverDueExperimentReminders());
    return res.status(202).json({ processingScheduled:rows.length, emailScheduled:emailRows.length });
  } catch (error) {
    console.error("Submission recovery error:", error);
    return res.status(500).json({ error:"Could not schedule submission recovery" });
  }
}
