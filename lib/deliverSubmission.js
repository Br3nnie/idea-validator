import { sendCompletedReport, sendOwnerNotification } from "./loops";
import { claimEmailDelivery, createReportAccessForSubmission, saveEmailDelivery } from "./submissions";

export async function deliverSubmissionEmails({ id, force = false }) {
  const submission = await claimEmailDelivery(id, force);
  if (!submission) return { claimed:false };
  const access = submission.report_email_sent ? null : await createReportAccessForSubmission(id);
  const reportUrl = access ? `${process.env.PUBLIC_SITE_URL || "https://www.testmyidea.co.uk"}/?access=${access.token}` : null;
  const skipped = { sent:true, skipped:true };
  const [reportDelivery, ownerDelivery] = await Promise.all([
    submission.report_email_sent ? skipped : sendCompletedReport({
      id, email:submission.email, result:submission.result, averageScore:submission.average_score, reportUrl,
    }),
    submission.owner_notification_sent ? skipped : sendOwnerNotification({
      id, email:submission.email, result:submission.result, averageScore:submission.average_score,
      costGbp:submission.cost_gbp, createdAt:submission.created_at,
    }),
  ]);
  const deliveryErrors = [reportDelivery.error, ownerDelivery.error].filter(Boolean).join("; ");
  const saved = await saveEmailDelivery(id, {
    reportSent:reportDelivery.sent, ownerSent:ownerDelivery.sent, error:deliveryErrors,
  });
  return { claimed:true, saved };
}
