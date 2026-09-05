import test from "node:test";
import assert from "node:assert/strict";
import { sendCompletedReport } from "../lib/loops.js";

test("customer email includes every structured report row", async t => {
  process.env.LOOPS_API_KEY = "test-key";
  process.env.LOOPS_REPORT_TRANSACTIONAL_ID = "test-template";
  const originalFetch = global.fetch;
  let requestBody;
  global.fetch = async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return { ok:true, status:200, json:async () => ({}) };
  };
  t.after(() => { global.fetch = originalFetch; });
  const result = {
    ideaName:"Idea", tagline:"Tag", verdict:"TEST", confidence:70, rationale:"Why", problem:"Problem", solution:"Solution", differentiation:"Different",
    assumptions:Array.from({ length:4 }, (_, i) => ({ assumption:`Assumption ${i + 1}`, risk:"high", evidence:"None" })),
    scoring:Array.from({ length:6 }, (_, i) => ({ name:`Score ${i + 1}`, score:5, note:"Note" })),
    validationSteps:Array.from({ length:4 }, (_, i) => ({ label:`Test ${i + 1}`, description:"Description", effort:"One day" })),
    nextSteps:Array.from({ length:5 }, (_, i) => `Next ${i + 1}`),
  };
  await sendCompletedReport({ id:"submission", email:"founder@example.com", result, averageScore:5 });
  assert.match(requestBody.dataVariables.assumption4, /Assumption 4/);
  assert.match(requestBody.dataVariables.validation4, /Test 4/);
  assert.equal(requestBody.dataVariables.next5, "Next 5");
});
