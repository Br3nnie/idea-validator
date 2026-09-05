import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeAnalyticsProperties, tokenHash } from "../lib/submissions.js";

test("capability tokens are stored as one-way hashes", () => {
  const raw="private-report-token";
  assert.equal(tokenHash(raw).length, 64);
  assert.notEqual(tokenHash(raw), raw);
  assert.equal(tokenHash(raw), tokenHash(raw));
});

test("analytics properties retain only coarse allowlisted context", () => {
  assert.deepEqual(sanitizeAnalyticsProperties({ path:"/", referrerHost:"example.com", viewport:"mobile", email:"private@example.com" }), { path:"/", referrerHost:"example.com", viewport:"mobile" });
  assert.equal(sanitizeAnalyticsProperties({ viewport:"watch" }).viewport, "unknown");
});
