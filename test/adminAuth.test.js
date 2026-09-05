import test from "node:test";
import assert from "node:assert/strict";
import { ADMIN_COOKIE, createAdminSession, validAdminSession } from "../lib/adminAuth.js";

test("accepts a signed live admin session and rejects tampering", () => {
  process.env.ADMIN_DASHBOARD_PASSWORD = "a-long-test-password";
  const session = createAdminSession();
  assert.equal(validAdminSession({ headers:{ cookie:`${ADMIN_COOKIE}=${session}` } }), true);
  assert.equal(validAdminSession({ headers:{ cookie:`${ADMIN_COOKIE}=${session}bad` } }), false);
});
