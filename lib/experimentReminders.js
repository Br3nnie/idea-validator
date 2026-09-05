import { sendExperimentReminder } from "./loops";
import { listDueExperimentReminders, markExperimentReminderSent } from "./submissions";

export async function deliverDueExperimentReminders() {
  if (!process.env.LOOPS_EXPERIMENT_REMINDER_ID) return { disabled:true, sent:0 };
  const due = await listDueExperimentReminders();
  let sent = 0;
  for (const experiment of due) {
    const delivery = await sendExperimentReminder({
      id:experiment.id, email:experiment.email, ideaName:experiment.idea_name, hypothesis:experiment.hypothesis,
      deadline:experiment.deadline, successThreshold:experiment.success_threshold,
    });
    if (delivery.sent) { await markExperimentReminderSent(experiment.id); sent += 1; }
  }
  return { disabled:false, sent, due:due.length };
}
