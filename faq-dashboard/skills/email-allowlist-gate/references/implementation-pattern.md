---
created: 2026-07-02
last_edited: 2026-07-02
version: 1.0
provenance: con_BSO6B2UCenN78HpW
---

# Email Allowlist Gate — Implementation Pattern

This document describes the exact code transformation used by the email-allowlist-gate skill.

## Critical Constraint: React Hooks Rules

All React hooks (`useState`, `useEffect`, `useCallback`, etc.) must be:
1. **Declared at the top** of the component function
2. **Called unconditionally** — never inside if/else, loops, or after early returns
3. Called in the **same order** on every render

**Why this matters:** React tracks hooks by position. If a hook is conditional, React can't reliably match it to the stored state, causing error #310.

## The Transformation

### Step 1: Extract All Hooks from Original Code

Identify every hook in your dashboard:
```typescript
const [entries, setEntries] = useState<FAQEntry[]>([]);
const [editingId, setEditingId] = useState<string | null>(null);
const [newEntry, setNewEntry] = useState<FAQEntry>({...});

useEffect(() => {
  const stored = localStorage.getItem("faq_data");
  if (stored) setEntries(JSON.parse(stored));
}, []);

useEffect(() => {
  localStorage.setItem("faq_data", JSON.stringify(entries));
}, [entries]);
```

### Step 2: Add Auth Hooks FIRST

Before any dashboard hooks:
```typescript
// ── Auth state (declared first) ──
const [authedEmail, setAuthedEmail] = useState<string | null>(null);
const [authChecked, setAuthChecked] = useState(false);
const [authError, setAuthError] = useState("");

// ── Dashboard state (declared after auth) ──
const [entries, setEntries] = useState<FAQEntry[]>([]);
const [editingId, setEditingId] = useState<string | null>(null);
const [newEntry, setNewEntry] = useState<FAQEntry>({...});
```

### Step 3: Add Auth useEffect FIRST

Before any dashboard effects:
```typescript
// ── Auth initialization (checked first) ──
useEffect(() => {
  const stored = localStorage.getItem("my_dashboard_session");
  if (stored && ALLOWED_EMAILS.includes(stored)) {
    setAuthedEmail(stored);
  }
  setAuthChecked(true);
}, []);

// ── Dashboard effects (checked after) ──
useEffect(() => {
  const stored = localStorage.getItem("faq_data");
  if (stored) setEntries(JSON.parse(stored));
}, []);

useEffect(() => {
  localStorage.setItem("faq_data", JSON.stringify(entries));
}, [entries]);
```

### Step 4: Add Auth Guards AFTER All Hooks

These are the ONLY conditional returns:
```typescript
// All hooks are now called above ↑

// Early guard 1: auth check not complete yet
if (!authChecked) return null;

// Early guard 2: not authenticated
if (!authedEmail) return <AuthGate onAuth={setAuthedEmail} />;

// Only reaches here if authenticated
return <div>{/* dashboard JSX */}</div>;
```

## AuthGate Component

Place this BEFORE the main export:

```typescript
interface AuthGateProps {
  onAuth: (email: string) => void;
}

function AuthGate({ onAuth }: AuthGateProps) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Simulate a brief delay for UX
    setTimeout(() => {
      const normalized = email.toLowerCase().trim();
      if (ALLOWED_EMAILS.map((e) => e.toLowerCase()).includes(normalized)) {
        localStorage.setItem(SESSION_KEY, normalized);
        onAuth(normalized);
      } else {
        setError("Email not authorized. Contact riley@kitescouting.com for access.");
      }
      setLoading(false);
    }, 300);
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="max-w-md w-full space-y-6">
        {/* Logo section */}
        <div className="text-center">
          <img
            src="https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Pegasus_icon.svg/100px-Pegasus_icon.svg.png"
            alt="Logo"
            className="w-16 h-16 mx-auto mb-4"
          />
          <h1 className="text-2xl font-bold text-gray-900">FAQ Administration</h1>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Enter your email address to access this page
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              disabled={loading}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              style={{ color: "#111827" }}
            />
          </div>

          {error && (
            <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 bg-amber-500 text-white rounded-lg font-semibold hover:bg-amber-600 disabled:opacity-50"
          >
            {loading ? "Checking..." : "Continue →"}
          </button>
        </form>

        {/* Footer */}
        <div className="text-center text-sm text-gray-600">
          Don't have access?{" "}
          <a href="mailto:riley@kitescouting.com" className="text-amber-500 hover:underline">
            Contact support
          </a>
        </div>
      </div>
    </div>
  );
}
```

## Sign Out Button

Add this to your dashboard header:

```typescript
<button
  onClick={() => {
    localStorage.removeItem(SESSION_KEY);
    setAuthedEmail(null);
  }}
  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
>
  <LogOut className="w-4 h-4" />
  Sign Out ({authedEmail})
</button>
```

## Full Component Structure

```typescript
import { useState, useEffect } from "react";
import { LogOut } from "lucide-react";

// ── Constants ──
const ALLOWED_EMAILS = ["user1@example.com"];
const SESSION_KEY = "my_dashboard_session";

// ── AuthGate Component ──
function AuthGate({ onAuth }) { /* ... */ }

// ── Main Component ──
export default function MyDashboard() {
  // ── All hooks at top, unconditionally ──
  const [authedEmail, setAuthedEmail] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [dashboardData, setDashboardData] = useState([]);
  
  useEffect(() => {
    const stored = localStorage.getItem(SESSION_KEY);
    if (stored) setAuthedEmail(stored);
    setAuthChecked(true);
  }, []);

  // ── Auth guards (only conditional returns) ──
  if (!authChecked) return null;
  if (!authedEmail) return <AuthGate onAuth={setAuthedEmail} />;

  // ── Dashboard content (only if authed) ──
  return (
    <div>
      <header>
        <button onClick={() => {
          localStorage.removeItem(SESSION_KEY);
          setAuthedEmail(null);
        }}>
          Sign Out ({authedEmail})
        </button>
      </header>
      <main>{/* dashboard JSX */}</main>
    </div>
  );
}
```

## Checklist Before Deploying

- [ ] All `useState` calls at top of component
- [ ] All `useEffect` calls after all `useState`
- [ ] All hooks called unconditionally (no if/else wrapping)
- [ ] Auth hooks declared before dashboard hooks
- [ ] Only conditional returns after all hooks
- [ ] `AuthGate` component defined before main export
- [ ] `ALLOWED_EMAILS` array at top with correct emails
- [ ] `SESSION_KEY` constant unique and consistent
- [ ] Sign Out button added to header
- [ ] `localStorage` key matches `SESSION_KEY`
- [ ] Error message customized to match your context

## Testing

1. **Fresh browser:** Clear localStorage, visit route → see auth gate
2. **Approved email:** Enter allowed email → see dashboard
3. **Session:** Reload page → still logged in (from localStorage)
4. **Denied email:** Enter unauthorized email → see error
5. **Sign out:** Click button → gate reappears, localStorage cleared

