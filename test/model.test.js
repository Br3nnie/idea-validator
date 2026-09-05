import test from "node:test";
import assert from "node:assert/strict";
import { MODEL_DIMENSIONS, parseAssumptions, parseOverview, parseVerdict } from "../lib/model.js";

test("accepts a complete validation model", () => {
  assert.equal(parseOverview({ ideaName:"Idea", tagline:"Tag", problem:"Problem", solution:"Solution", differentiation:"Different" }).ideaName, "Idea");
  assert.equal(parseAssumptions({
    assumptions:Array.from({ length:4 }, (_, i) => ({ label:`A${i}`, assumption:"Must hold", risk:"high", evidence:"None" })),
    validationSteps:Array.from({ length:4 }, (_, i) => ({ label:`V${i}`, description:"Test it", effort:"One day", priority:"high" })),
  }).validationSteps.length, 4);
  const verdict = parseVerdict({
    scoring:MODEL_DIMENSIONS.map(name => ({ name, score:7, note:"Good" })), verdict:"GO", confidence:80, rationale:"Evidence supports a test.",
    nextSteps:Array.from({ length:5 }, (_, i) => `Step ${i + 1}`),
  });
  assert.equal(verdict.scoring.length, 6);
  assert.equal(verdict.nextSteps.length, 5);
});

test("rejects malformed and out-of-range model output", () => {
  assert.throws(() => parseVerdict({ scoring:[], verdict:"GO", confidence:80, rationale:"x", nextSteps:[] }), /scoring/);
  assert.throws(() => parseOverview({}), /ideaName/);
});
