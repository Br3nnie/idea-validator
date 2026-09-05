import {
  adminConfigured,
  createAdminSession,
  passwordMatches,
  sessionCookie,
  validAdminSession,
} from "../../../lib/adminAuth";
import { consumeRateLimit, hasDatabase } from "../../../lib/submissions";

const MAX_ATTEMPTS = 5;

function clientKey(req) {
  return String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").split(",")[0].trim();
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "GET") {
    return res.status(200).json({ authenticated: validAdminSession(req), configured: adminConfigured() });
  }

  if (req.method === "DELETE") {
    res.setHeader("Set-Cookie", sessionCookie("", 0));
    return res.status(200).json({ authenticated: false });
  }

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!adminConfigured()) return res.status(503).json({ error: "Dashboard password is not configured" });

  if (!hasDatabase()) return res.status(503).json({ error: "Secure login is temporarily unavailable" });
  const rate = await consumeRateLimit({ scope:"admin-login", identifier:clientKey(req), limit:MAX_ATTEMPTS, windowSeconds:900 });
  if (!rate.allowed) {
    res.setHeader("Retry-After", "900");
    return res.status(429).json({ error: "Too many attempts. Try again later." });
  }

  if (!passwordMatches(req.body?.password)) {
    await new Promise(resolve => setTimeout(resolve, 600));
    return res.status(401).json({ error: "Incorrect password" });
  }

  res.setHeader("Set-Cookie", sessionCookie(createAdminSession()));
  return res.status(200).json({ authenticated: true });
}
