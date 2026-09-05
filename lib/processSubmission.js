import { generateValidation } from "./anthropic";
import { captureContact } from "./loops";
import { claimSubmission, completeSubmission, createExperimentsFromResult, releaseSubmissionForRetry, saveLoopsCapture } from "./submissions";
import { checkDailySpend } from "./alerts";
import { deliverSubmissionEmails } from "./deliverSubmission";

export async function processSubmission({ id }) {
  const claimed = await claimSubmission(id);
  if (!claimed) return { claimed:false };
  const { email, answers, marketing_consent:marketingConsent, processing_attempts:attempts } = claimed;
  const capturePromise = captureContact(email, answers, marketingConsent).then(async captured => {
    await saveLoopsCapture(id, captured);
    return captured;
  }).catch(error => {
    console.error("Loops capture persistence error:", error);
    return false;
  });
  try {
    const { result, usage } = await generateValidation(answers);
    await completeSubmission(id, result, usage);
    await createExperimentsFromResult(id, result);
    await Promise.all([
      capturePromise,
      checkDailySpend().catch(error => console.error("Spend alert error:", error)),
    ]);
    try {
      await deliverSubmissionEmails({ id });
    } catch (error) {
      console.error("Email delivery error:", error);
    }
  } catch (error) {
    console.error("Background submission processing error:", error);
    await capturePromise;
    await releaseSubmissionForRetry(id, error.message, attempts).catch(saveError => console.error("Submission retry save error:", saveError));
  }
  return { claimed:true };
}
