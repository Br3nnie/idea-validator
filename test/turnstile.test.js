import assert from "node:assert/strict";
import test from "node:test";
import { verifyTurnstile } from "../lib/turnstile.js";

test("Turnstile is optional until a secret is configured", async () => {
  const original = process.env.TURNSTILE_SECRET_KEY;
  delete process.env.TURNSTILE_SECRET_KEY;
  assert.equal(await verifyTurnstile("", "127.0.0.1"), true);
  if (original !== undefined) process.env.TURNSTILE_SECRET_KEY = original;
});

test("Turnstile requires a token and honours the verification response", async () => {
  const originalSecret = process.env.TURNSTILE_SECRET_KEY;
  const originalFetch = globalThis.fetch;
  process.env.TURNSTILE_SECRET_KEY = "test-secret";
  assert.equal(await verifyTurnstile("", "127.0.0.1"), false);
  globalThis.fetch = async (_url, options) => {
    assert.match(String(options.body), /secret=test-secret/);
    assert.match(String(options.body), /response=test-token/);
    return { ok:true, json:async () => ({ success:true }) };
  };
  try {
    assert.equal(await verifyTurnstile("test-token", "127.0.0.1"), true);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalSecret === undefined) delete process.env.TURNSTILE_SECRET_KEY;
    else process.env.TURNSTILE_SECRET_KEY = originalSecret;
  }
});
