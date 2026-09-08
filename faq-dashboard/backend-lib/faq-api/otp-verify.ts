import type { Context } from "hono";

// ── OTP Store (shared in-memory state) ───────────────────────────
// This must reference the same Map as /api/otp/send.
// In Hono/Bun on zo.space, routes share the same process,
// so we use a module-level singleton via globalThis.
declare global {
  var __otpStore: Map<string, { code: string; expiry: number; attempts: number }> | undefined;
}
if (!globalThis.__otpStore) {
  globalThis.__otpStore = new Map();
}
const otpStore = globalThis.__otpStore;

const MAX_ATTEMPTS = 5; // lock out after 5 wrong guesses

export default async (c: Context) => {
  if (c.req.method !== "POST") {
    return c.json({ error: "Method not allowed" }, 405);
  }

  let body: { email?: string; code?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const email = (body.email || "").trim().toLowerCase();
  const code = (body.code || "").trim();

  if (!email || !code) {
    return c.json({ error: "email and code are required" }, 400);
  }

  const entry = otpStore.get(email);

  if (!entry) {
    return c.json({ error: "No code found for this email. Please request a new one." }, 400);
  }

  if (Date.now() > entry.expiry) {
    otpStore.delete(email);
    return c.json({ error: "Code has expired. Please request a new one." }, 400);
  }

  if (entry.attempts >= MAX_ATTEMPTS) {
    otpStore.delete(email);
    return c.json({ error: "Too many incorrect attempts. Please request a new code." }, 400);
  }

  if (entry.code !== code) {
    entry.attempts++;
    const remaining = MAX_ATTEMPTS - entry.attempts;
    return c.json({ error: `Incorrect code. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.` }, 400);
  }

  // ✅ Valid — delete immediately (one-time use)
  otpStore.delete(email);
  console.log(`[otp/verify] ✓ Verified ${email}`);
  return c.json({ ok: true, email });
};
