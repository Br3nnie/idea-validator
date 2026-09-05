import test from "node:test";
import assert from "node:assert/strict";
import { evaluateValidationQuality } from "../lib/evaluation.js";

const strong = {
  verdict:"TEST", confidence:64,
  evidenceStrength:{ biggestGap:"No observed payment behaviour", wouldChangeVerdict:"Three paid pilots within 30 days" },
  validationSteps:Array.from({ length:4 }, () => ({ description:"Offer a paid manual pilot to ten target customers." })),
  scoring:Array.from({ length:6 }, () => ({ note:"The founder supplied a plausible claim but limited observed evidence." })),
};

test("quality gate accepts evidence-led actionable reports", () => {
  assert.deepEqual(evaluateValidationQuality(strong), { passed:true, score:5, checks:{ evidenceDiscipline:true, actionableTests:true, explainedScores:true, boundedConfidence:true, explicitDecision:true } });
});

test("quality gate rejects vague validation advice", () => {
  const weak = { ...strong, validationSteps:[{ description:"Do research" }] };
  assert.equal(evaluateValidationQuality(weak).passed, false);
});
