import { reserveDailySpendAlert } from "./submissions";

export async function checkDailySpend() {
  const threshold = Number(process.env.DAILY_SPEND_ALERT_GBP || 5);
  if (!Number.isFinite(threshold) || threshold <= 0) return;
  const state = await reserveDailySpendAlert(threshold);
  if (!state.alert) return;
  const message = { event:"daily_spend_threshold_reached", costGbp:state.costGbp, thresholdGbp:threshold, date:new Date().toISOString().slice(0, 10) };
  console.warn(JSON.stringify(message));
  if (!process.env.SPEND_ALERT_WEBHOOK_URL) return;
  const response = await fetch(process.env.SPEND_ALERT_WEBHOOK_URL, {
    method:"POST", signal:AbortSignal.timeout(10000), headers:{ "Content-Type":"application/json" }, body:JSON.stringify(message),
  });
  if (!response.ok) throw new Error(`Spend alert webhook returned ${response.status}`);
}
