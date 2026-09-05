import { generateValidation } from "./anthropic";
import { captureContact, sendCompletedReport, sendOwnerNotification } from "./loops";
import { completeSubmission, createExperimentsFromResult, failSubmission, saveEmailDelivery, saveLoopsCapture } from "./submissions";
import { checkDailySpend } from "./alerts";

export async function processSubmission({ id, email, answers, marketingConsent }) {
  const capturePromise = captureContact(email, answers, marketingConsent).then(async captured => {
    await saveLoopsCapture(id, captured);
    return captured;
  }).catch(error => {
    console.error("Loops capture persistence error:", error);
    return false;
  });
  try {
    const { result, usage } = await generateValidation(answers);
    const submission = await completeSubmission(id, result, usage);
    await createExperimentsFromResult(id, result);
    await Promise.all([
      capturePromise,
      checkDailySpend().catch(error => console.error("Spend alert error:", error)),
    ]);
    const [reportDelivery, ownerDelivery] = await Promise.all([
      sendCompletedReport({ id, email, result, averageScore:submission.average_score }),
      sendOwnerNotification({ id, email, result, averageScore:submission.average_score, costGbp:submission.cost_gbp, createdAt:submission.created_at }),
    ]);
    const deliveryErrors = [reportDelivery.error, ownerDelivery.error].filter(Boolean).join("; ");
    try {
      await saveEmailDelivery(id, { reportSent:reportDelivery.sent, ownerSent:ownerDelivery.sent, error:deliveryErrors });
    } catch (error) {
      console.error("Email delivery status save error:", error);
    }
  } catch (error) {
    console.error("Background submission processing error:", error);
    await capturePromise;
    await failSubmission(id, error.message).catch(saveError => console.error("Submission failure save error:", saveError));
  }
}
