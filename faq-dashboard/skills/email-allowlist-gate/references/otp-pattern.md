---
created: 2026-07-02
last_edited: 2026-07-02
version: 1.0
provenance: con_BSO6B2UCenN78HpW
---
# OTP Pattern — Architecture Notes

## How the OTP Store Works

OTP codes are stored in a `globalThis`**-scoped Map** so both `/api/otp/send` and `/api/otp/verify` share the same in-memory store across the single Bun/Hono process.

```typescript
declare global {
  var __otpStore: Map<string, { code: string; expiry: number; attempts: number }> | undefined;
}
if (!globalThis.__otpStore) globalThis.__otpStore = new Map();
const otpStore = globalThis.__otpStore;
```

**Why** `globalThis`**?** Each route file is a module. A plain `const otpStore = new Map()` in `/api/otp/send` is not visible in `/api/otp/verify`. `globalThis` is the shared singleton across all modules in the same process.

**Trade-off:** Cleared on server restart. Users see "No code found" and need to request a new one. Acceptable for this use case.

## Security Properties

| Property | Value |
| --- | --- |
| Code length | 6 digits (1,000,000 combinations) |
| TTL | 10 minutes |
| Max attempts | 5 (then code deleted) |
| Rate limit | 5 requests/minute per email |
| Resend cooldown | 60 seconds (client-side) |
| One-time use | Code deleted immediately on first valid verify |
| Allowlist check | Server-side in `/api/otp/send`, not just client |

## Email Delivery

Uses the Zo `/zo/ask` API with `ZO_CLIENT_IDENTITY_TOKEN` (automatically available in all zo.space API routes — no setup required).

The `input` field instructs Zo to send the email via `send_email_to_user`. Zo routes the email from the account owner's registered address.

## Naming API Routes per Dashboard

If you have multiple dashboards each with their own OTP gate, use distinct route paths:

```markdown
/api/otp/send         ← shared (allowlist varies per route)
/api/otp/verify       ← shared (otpStore shared globally)

OR per-dashboard:
/api/faq-admin/otp/send
/api/reports/otp/send
```

Sharing `/api/otp/send` across dashboards is fine as long as each dashboard has its own `ALLOWED_EMAILS` — just note the allowlist must be updated in the send route, not the page route alone.