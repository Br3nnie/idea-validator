import { listExperiments, updateExperiment, validReportAccess } from "../../../../lib/submissions";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATUSES = new Set(["planned", "running", "completed"]);

function clean(value, max = 3000) { return String(value || "").trim().slice(0, max); }

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const requestKey = String(req.query.requestKey || "");
  if (!UUID_PATTERN.test(requestKey)) return res.status(400).json({ error:"Invalid request key" });
  try {
    if (!await validReportAccess(requestKey, req.headers["x-report-access-token"])) return res.status(401).json({ error:"Report access required" });
    if (req.method === "GET") return res.status(200).json({ experiments:await listExperiments(requestKey) });
    if (req.method === "PUT") {
      const { id, hypothesis, method, targetAudience, successThreshold, metricName, baselineValue, observedValue, learning, deadline, result, decision, status } = req.body || {};
      if (!UUID_PATTERN.test(String(id || "")) || !clean(hypothesis) || !clean(method) || !STATUSES.has(status)) return res.status(400).json({ error:"Invalid experiment" });
      const experiment = await updateExperiment(requestKey, id, {
        hypothesis:clean(hypothesis), method:clean(method), targetAudience:clean(targetAudience), successThreshold:clean(successThreshold),
        metricName:clean(metricName, 500), baselineValue:clean(baselineValue, 500), observedValue:clean(observedValue, 500), learning:clean(learning),
        deadline:/^\d{4}-\d{2}-\d{2}$/.test(String(deadline || "")) ? deadline : null,
        result:clean(result), decision:clean(decision), status,
      });
      if (!experiment) return res.status(404).json({ error:"Experiment not found" });
      return res.status(200).json({ experiment });
    }
    return res.status(405).json({ error:"Method not allowed" });
  } catch (error) {
    console.error("Experiment API error:", error);
    return res.status(500).json({ error:"Could not save the experiment" });
  }
}

export const config = { api:{ bodyParser:{ sizeLimit:"20kb" } } };
