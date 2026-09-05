import test from "node:test";
import assert from "node:assert/strict";
import { retryDelaySeconds } from "../lib/submissions.js";

test("processing retries back off exponentially and cap at fifteen minutes", () => {
  assert.deepEqual([1, 2, 3, 4, 8].map(retryDelaySeconds), [30, 60, 120, 240, 900]);
});
