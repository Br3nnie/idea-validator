import crypto from "crypto";

export const ADMIN_COOKIE = "idea_validator_admin";
const SESSION_SECONDS = 60 * 60 * 12;

function password() {
  return process.env.ADMIN_DASHBOARD_PASSWORD || "";
}

function signature(expiresAt) {
  return crypto.createHmac("sha256", `idea-validator:${password()}`).update(String(expiresAt)).digest("hex");
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function adminConfigured() {
  return password().length >= 12;
}

export function passwordMatches(candidate) {
  return adminConfigured() && safeEqual(candidate || "", password());
}

export function createAdminSession() {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  return `${expiresAt}.${signature(expiresAt)}`;
}

export function validAdminSession(req) {
  if (!adminConfigured()) return false;
  const cookies = Object.fromEntries(
    String(req.headers.cookie || "").split(";").map(item => item.trim().split(/=(.*)/s).slice(0, 2))
  );
  const [expiresAt, suppliedSignature] = String(cookies[ADMIN_COOKIE] || "").split(".");
  const now = Math.floor(Date.now() / 1000);
  const expiry = Number(expiresAt);
  if (!expiresAt || !suppliedSignature || !Number.isInteger(expiry) || expiry < now || expiry > now + SESSION_SECONDS) return false;
  return safeEqual(suppliedSignature, signature(expiresAt));
}

export function sessionCookie(value, maxAge = SESSION_SECONDS) {
  return `${ADMIN_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge};${process.env.NODE_ENV === "production" ? " Secure;" : ""}`;
}
