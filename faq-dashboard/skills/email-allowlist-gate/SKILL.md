---
name: email-allowlist-gate
description: Add email-based access control to any zo.space dashboard. Two tiers — simple email check (v1) or full OTP email verification (v2). Restricts visibility to specific approved email addresses without making it fully public.
compatibility: Created for Zo Computer
metadata:
  author: rileye.zo.computer
  category: authentication
  tag: dashboard, access-control, email-gate, otp
---

# Email Allowlist Gate Skill

Two tiers of email-based access control for any zo.space dashboard:

| | **v1 — Email Check** | **v2 — OTP Verification** |
|---|---|---|
| How it works | User types email, checked against list | User types email → receives 6-digit code → enters code |
| Security | UX gate (client-side) | Server-side verified, one-time code |
| Setup | Zero infra | Requires `ZO_CLIENT_IDENTITY_TOKEN` (auto-available in routes) + two API routes |
| Use when | Trusted internal team | External collaborators, clients, higher stakes |

---

## Activation

**v1 (simple):**
> "Add an email allowlist gate to my [dashboard] for [email1], [email2]"

**v2 (OTP):**
> "Add an OTP email gate to my [dashboard] for [email1], [email2]"

---

## v1 — Email Check

### What Gets Built
- `ALLOWED_EMAILS` array in the page route
- `AuthGate` component: email form → instant check against list
- Session stored in `localStorage` on approval
- Sign Out button in header

### Implementation Steps

**1. Add constants at top of route file:**
```typescript
const ALLOWED_EMAILS = ["user1@example.com", "user2@example.com"];
const SESSION_KEY = "my_dashboard_session"; // unique per dashboard
```

**2. Add `AuthGate` component before main export:**
```typescript
function AuthGate({ onAuth }: { onAuth: (email: string) => void }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const normalized = email.trim().toLowerCase();
    setTimeout(() => {
      if (ALLOWED_EMAILS.map(e => e.toLowerCase()).includes(normalized)) {
        localStorage.setItem(SESSION_KEY, normalized);
        onAuth(normalized);
      } else {
        setError("This email doesn't have access. Contact [admin] to request access.");
      }
      setLoading(false);
    }, 400);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <h1 className="text-2xl font-bold mb-6">Dashboard Access</h1>
      <form onSubmit={handleSubmit} className="w-full max-w-sm border rounded-2xl p-8">
        <label className="block text-sm font-semibold mb-2">Email Address</label>
        <input
          type="email" value={email} onChange={e => setEmail(e.target.value)}
          required placeholder="you@example.com" autoFocus
          className="w-full px-4 py-3 rounded-xl border text-sm mb-4"
          style={{ color: "#111827" }}
        />
        {error && <div className="text-sm text-red-700 bg-red-50 rounded-lg px-4 py-3 mb-4">{error}</div>}
        <button type="submit" disabled={loading} className="w-full py-3 rounded-xl font-semibold text-sm">
          {loading ? "Checking..." : "Continue →"}
        </button>
      </form>
    </div>
  );
}
```

**3. Restructure main component — ALL hooks at top, guards after:**
```typescript
export default function MyDashboard() {
  // ── Auth state FIRST (unconditional) ──
  const [authedEmail, setAuthedEmail] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  // ── All other dashboard state (unconditional) ──
  const [data, setData] = useState([]);
  // ...

  // ── Auth check on mount ──
  useEffect(() => {
    const stored = localStorage.getItem(SESSION_KEY);
    if (stored && ALLOWED_EMAILS.map(e => e.toLowerCase()).includes(stored)) {
      setAuthedEmail(stored);
    }
    setAuthChecked(true);
  }, []);

  // ── Other effects ──
  // ...

  // ── Guards AFTER all hooks ──
  if (!authChecked) return null;
  if (!authedEmail) return <AuthGate onAuth={setAuthedEmail} />;

  // ── Dashboard renders only if authed ──
  return <div>{/* ... */}</div>;
}
```

**4. Add Sign Out button to header:**
```typescript
<button onClick={() => { localStorage.removeItem(SESSION_KEY); setAuthedEmail(null); }}>
  Sign Out ({authedEmail})
</button>
```

---

## v2 — OTP Email Verification ✉️

### What Gets Built
- **`/api/otp/send`** — checks allowlist, generates 6-digit code, stores server-side with 10-min TTL, emails code via Zo
- **`/api/otp/verify`** — validates code (one-time, max 5 attempts, locked after expiry)
- **Two-step `AuthGate`** — step 1: email entry → step 2: 6-digit code entry
- Rate limiting (5 req/min per email), 60s resend cooldown
- Same session/sign-out pattern as v1

### Prerequisites
`ZO_CLIENT_IDENTITY_TOKEN` is auto-available in all zo.space API routes — no setup needed.

### API Route: `/api/otp/send`

```typescript
import type { Context } from "hono";

const ALLOWED_EMAILS = ["user1@example.com", "user2@example.com"];

declare global {
  var __otpStore: Map<string, { code: string; expiry: number; attempts: number }> | undefined;
}
if (!globalThis.__otpStore) globalThis.__otpStore = new Map();
const otpStore = globalThis.__otpStore;

const rateLimit = new Map<string, { count: number; windowStart: number }>();
const OTP_TTL_MS = 10 * 60 * 1000;

function generateCode() { return String(Math.floor(100000 + Math.random() * 900000)); }

function isRateLimited(email: string) {
  const now = Date.now();
  const entry = rateLimit.get(email);
  if (!entry || now - entry.windowStart > 60_000) { rateLimit.set(email, { count: 1, windowStart: now }); return false; }
  if (entry.count >= 5) return true;
  entry.count++;
  return false;
}

export default async (c: Context) => {
  if (c.req.method !== "POST") return c.json({ error: "Method not allowed" }, 405);
  let body: { email?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: "Invalid JSON" }, 400); }

  const email = (body.email || "").trim().toLowerCase();
  if (!email) return c.json({ error: "email is required" }, 400);
  if (!ALLOWED_EMAILS.map(e => e.toLowerCase()).includes(email))
    return c.json({ error: "This email is not on the access list." }, 403);
  if (isRateLimited(email))
    return c.json({ error: "Too many requests. Please wait a minute." }, 429);

  const code = generateCode();
  otpStore.set(email, { code, expiry: Date.now() + OTP_TTL_MS, attempts: 0 });

  const zoToken = process.env.ZO_CLIENT_IDENTITY_TOKEN;
  if (!zoToken) return c.json({ error: "Email service not configured." }, 500);

  const resp = await fetch("https://api.zo.computer/zo/ask", {
    method: "POST",
    headers: { Authorization: `Bearer ${zoToken}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      input: `Send an email to ${email} with subject "Your access code" and this exact body:\n\nYour one-time access code is:\n\n${code}\n\nThis code expires in 10 minutes. Do not share it.\n\n— [Your name/org]`,
      model_name: process.env.FAQ_EXTRACT_MODEL, // your own BYOK model id (Settings > AI > Providers)
    }),
  });

  if (!resp.ok) return c.json({ error: "Failed to send email. Please try again." }, 502);
  return c.json({ ok: true, message: "Code sent. Check your email." });
};
```

### API Route: `/api/otp/verify`

```typescript
import type { Context } from "hono";

declare global {
  var __otpStore: Map<string, { code: string; expiry: number; attempts: number }> | undefined;
}
if (!globalThis.__otpStore) globalThis.__otpStore = new Map();
const otpStore = globalThis.__otpStore;

export default async (c: Context) => {
  if (c.req.method !== "POST") return c.json({ error: "Method not allowed" }, 405);
  let body: { email?: string; code?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: "Invalid JSON" }, 400); }

  const email = (body.email || "").trim().toLowerCase();
  const code = (body.code || "").trim();
  if (!email || !code) return c.json({ error: "email and code are required" }, 400);

  const entry = otpStore.get(email);
  if (!entry) return c.json({ error: "No code found. Please request a new one." }, 400);
  if (Date.now() > entry.expiry) { otpStore.delete(email); return c.json({ error: "Code has expired. Please request a new one." }, 400); }
  if (entry.attempts >= 5) { otpStore.delete(email); return c.json({ error: "Too many attempts. Please request a new code." }, 400); }
  if (entry.code !== code) {
    entry.attempts++;
    const remaining = 5 - entry.attempts;
    return c.json({ error: `Incorrect code. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.` }, 400);
  }

  otpStore.delete(email); // one-time use
  return c.json({ ok: true, email });
};
```

### Page Route: Two-Step `AuthGate` Component

Replace the v1 `AuthGate` with this:

```typescript
const SESSION_KEY = "my_dashboard_session";

function AuthGate({ onAuth }: { onAuth: (email: string) => void }) {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const sendCode = async (emailToSend: string) => {
    const res = await fetch("/api/otp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ email: emailToSend }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to send code.");
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      await sendCode(email.trim());
      setStep("code");
      setResendCooldown(60);
    } catch (err: any) {
      setError(err.message);
    } finally { setLoading(false); }
  };

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email: email.trim(), code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Incorrect code.");
      localStorage.setItem(SESSION_KEY, data.email);
      onAuth(data.email);
    } catch (err: any) {
      setError(err.message);
    } finally { setLoading(false); }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setLoading(true); setError(""); setCode("");
    try { await sendCode(email.trim()); setResendCooldown(60); }
    catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <h1 className="text-2xl font-bold mb-2">Dashboard Access</h1>
      <p className="text-sm text-gray-500 mb-8">
        {step === "email" ? "Enter your email to receive a one-time code" : `Code sent to ${email}`}
      </p>

      <div className="w-full max-w-sm border rounded-2xl p-8">
        {step === "email" ? (
          <form onSubmit={handleEmailSubmit}>
            <label className="block text-sm font-semibold mb-2">Email Address</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              required placeholder="you@example.com" autoFocus
              className="w-full px-4 py-3 rounded-xl border text-sm mb-4"
              style={{ color: "#111827" }}
            />
            {error && <div className="text-sm text-red-700 bg-red-50 rounded-lg px-4 py-3 mb-4">{error}</div>}
            <button type="submit" disabled={loading} className="w-full py-3 rounded-xl font-semibold text-sm">
              {loading ? "Sending code..." : "Send Code →"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleCodeSubmit}>
            <label className="block text-sm font-semibold mb-2">6-Digit Code</label>
            <input
              type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6}
              value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ""))}
              required placeholder="000000" autoFocus
              className="w-full px-4 py-3 rounded-xl border text-center tracking-[0.5em] text-lg font-mono mb-4"
              style={{ color: "#111827" }}
            />
            {error && <div className="text-sm text-red-700 bg-red-50 rounded-lg px-4 py-3 mb-4">{error}</div>}
            <button type="submit" disabled={loading} className="w-full py-3 rounded-xl font-semibold text-sm mb-3">
              {loading ? "Verifying..." : "Verify Code →"}
            </button>
            <div className="flex justify-between text-xs text-gray-500">
              <button type="button" onClick={() => { setStep("email"); setError(""); setCode(""); }}>← Different email</button>
              <button type="button" onClick={handleResend} disabled={resendCooldown > 0 || loading} className="disabled:opacity-40">
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
```

The main component structure (hooks at top, guards after) is identical to v1 — only the `AuthGate` component and the two API routes change.

---

## Critical Rule: React Hooks

**All hooks must be declared unconditionally at the top of the component, before any `if` returns.**

❌ Wrong — causes React error #310:
```typescript
if (!authedEmail) return <AuthGate />;
const [data, setData] = useState([]); // hook after return
```

✅ Correct:
```typescript
const [authedEmail, setAuthedEmail] = useState(null); // hooks first
const [data, setData] = useState([]);
if (!authedEmail) return <AuthGate />; // guard after
```

---

## Managing the Allowlist

The `ALLOWED_EMAILS` array lives in **two places** for v2 — the page route and `/api/otp/send`. Both must stay in sync.

```
"Add [email] to the allowlist on my [dashboard]"
→ I update ALLOWED_EMAILS in both the page route and /api/otp/send
```

---

## Common Issues

| Problem | Cause | Fix |
|---------|-------|-----|
| React error #310 | Hooks declared after conditional return | Move all hooks to top of component |
| "Email service not configured" | `ZO_CLIENT_IDENTITY_TOKEN` not available | This is auto-set in routes — should not occur |
| Code not arriving | Zo email delivery delay | Wait 30s, use Resend button |
| "No code found" after refresh | OTP store cleared (server restart) | Request a new code |
| Code rejected immediately | Server restart cleared in-memory store | Request a new code |

---

## Reference Implementation

- **Live example:** https://rileye.zo.space/faq-admin (v2 OTP)
- **API routes:** `/api/otp/send`, `/api/otp/verify`
- **Allowlist:** riley@kitescouting.com, christiansil@zo.computer, christian@kitescouting.com
