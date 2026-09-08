import type { Context } from "hono";

// ── Allowlist ────────────────────────────────────────────────────
// EDIT THIS before deploying — only these emails can request an OTP code.
// Keep this in sync with the ALLOWED_EMAILS array in faq-hub.tsx and
// faq-event-admin.tsx (three separate copies in this codebase — see
// IMPLEMENTATION.md for why, and consider consolidating them).
const ALLOWED_EMAILS = [
  "you@example.com",
];

// ── OTP Store (in-memory, server-side) ──────────────────────────
// Shared via globalThis so /api/otp/verify reads the same Map
declare global {
  var __otpStore: Map<string, { code: string; expiry: number; attempts: number }> | undefined;
}
if (!globalThis.__otpStore) {
  globalThis.__otpStore = new Map();
}
const otpStore = globalThis.__otpStore;

// ── Rate limit store ─────────────────────────────────────────────
const rateLimit = new Map<string, { count: number; windowStart: number }>();

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function isRateLimited(email: string): boolean {
  const now = Date.now();
  const entry = rateLimit.get(email);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimit.set(email, { count: 1, windowStart: now });
    return false;
  }
  if (entry.count >= RATE_LIMIT_MAX) return true;
  entry.count++;
  return false;
}

export default async (c: Context) => {
  if (c.req.method !== "POST") {
    return c.json({ error: "Method not allowed" }, 405);
  }

  let body: { email?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const email = (body.email || "").trim().toLowerCase();
  if (!email) {
    return c.json({ error: "email is required" }, 400);
  }

  if (!ALLOWED_EMAILS.map(e => e.toLowerCase()).includes(email)) {
    return c.json({ error: "This email is not on the access list." }, 403);
  }

  if (isRateLimited(email)) {
    return c.json({ error: "Too many requests. Please wait a minute before trying again." }, 429);
  }

  const code = generateCode();
  const expiry = Date.now() + OTP_TTL_MS;
  otpStore.set(email, { code, expiry, attempts: 0 });

  const zoToken = process.env.ZO_CLIENT_IDENTITY_TOKEN;
  if (!zoToken) {
    console.error("[otp/send] ZO_CLIENT_IDENTITY_TOKEN not available");
    return c.json({ error: "Email service not configured." }, 500);
  }

  // FAQ_EXTRACT_MODEL must be set to your own BYOK model id (Settings > AI >
  // Providers) — this is account-specific and cannot ship with a default.
  const modelName = process.env.FAQ_EXTRACT_MODEL;
  if (!modelName) {
    console.error("[otp/send] FAQ_EXTRACT_MODEL is not set");
    return c.json({ error: "Email service not configured (missing AI provider model id)." }, 500);
  }

  try {
    const resp = await fetch("https://api.zo.computer/zo/ask", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${zoToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        input: `Send an email to ${email} with subject "Your access code" and this exact body:

Your one-time access code is:

${code}

This code expires in 10 minutes. Do not share it with anyone.`,
        model_name: modelName,
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error("[otp/send] Zo API error:", resp.status, text);
      return c.json({ error: "Failed to send email. Please try again." }, 502);
    }
  } catch (err) {
    console.error("[otp/send] Fetch error:", err);
    return c.json({ error: "Failed to send email. Please try again." }, 502);
  }

  console.log(`[otp/send] Code sent to ${email}, expires at ${new Date(expiry).toISOString()}`);
  return c.json({ ok: true, message: "Code sent. Check your email." });
};
