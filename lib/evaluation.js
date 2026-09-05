const VAGUE = /^(good|bad|test it|do research|not provided|unknown)$/i;

export function evaluateValidationQuality(result) {
  const checks = {
    evidenceDiscipline:Boolean(result?.evidenceStrength?.biggestGap && result?.evidenceStrength?.wouldChangeVerdict),
    actionableTests:(result?.validationSteps || []).every(step => step.description?.length >= 20 && !VAGUE.test(step.description.trim())),
    explainedScores:(result?.scoring || []).every(score => score.note?.length >= 12 && !VAGUE.test(score.note.trim())),
    boundedConfidence:Number(result?.confidence) >= 1 && Number(result?.confidence) <= 100,
    explicitDecision:["GO","TEST","KILL"].includes(result?.verdict),
  };
  return { passed:Object.values(checks).every(Boolean), checks, score:Object.values(checks).filter(Boolean).length };
}
