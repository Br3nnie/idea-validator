export async function verifyTurnstile(token, remoteIp) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;
  try {
    const body = new URLSearchParams({ secret, response:String(token), ...(remoteIp ? { remoteip:remoteIp } : {}) });
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method:"POST", signal:AbortSignal.timeout(10000), body,
    });
    const result = await response.json();
    return response.ok && result.success === true;
  } catch (error) {
    console.error("Turnstile verification error:", error);
    return false;
  }
}
