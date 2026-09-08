# Quick Reference: Email Allowlist Gate

## Activation

```
"Add an email allowlist gate to my [route-name] dashboard for [email1], [email2], ..."
```

Example:
```
"Add an email allowlist gate to my dashboard for alice@company.com and bob@company.com"
```

## What Gets Added

1. `ALLOWED_EMAILS` array (edit this to add/remove users)
2. `SESSION_KEY` constant (unique per route)
3. Auth state: `authedEmail`, `authChecked`
4. Auth effect: checks localStorage on mount
5. `AuthGate` component: login form
6. Auth guards: early returns if not checked/authenticated
7. Sign Out button: in header

## After Activation

**Add more emails:**
```typescript
const ALLOWED_EMAILS = [
  "existing@example.com",
  "new@example.com",  // ← add here
];
```

**Remove emails:**
```typescript
const ALLOWED_EMAILS = [
  "keep@example.com",
  // "remove@example.com",  ← delete or comment out
];
```

**Change error message:**
Find in `AuthGate`:
```typescript
setError("Custom error message here");
```

**Change contact email:**
Find in `AuthGate` footer:
```typescript
<a href="mailto:your-email@example.com">
```

**Change session timeout:**
In auth `useEffect`:
```typescript
useEffect(() => {
  const stored = localStorage.getItem(SESSION_KEY);
  const timestamp = localStorage.getItem(SESSION_KEY + "_time");
  const isExpired = Date.now() - parseInt(timestamp || "0") > 24 * 60 * 60 * 1000; // 24 hours
  
  if (stored && !isExpired) {
    setAuthedEmail(stored);
  }
  setAuthChecked(true);
}, []);
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| React error #310 | All hooks must be declared at top, unconditionally. The skill handles this. |
| Users stay logged in forever | Session has no expiry. Add timestamp check to expire after X hours. |
| Can't see who's accessing | No logging built-in. I can add console.log or notifications. |
| Need API-driven allowlist | I can replace hardcoded array with API fetch. |
| Gate doesn't appear after logout | Make sure Sign Out button clears `localStorage.removeItem(SESSION_KEY)` |

## Files Modified

- Your zo.space route code only (e.g., `/faq-admin`)
- No other files affected
- Can be undone by reverting the route to previous version

## Security Notes

- **Client-side validation only** — suitable for trusted teams
- **Not encrypted** — emails visible in code and localStorage
- **For sensitive data:** Add server-side token validation
- **No audit log** — currently no record of who accessed when

## Examples

### Example 1: FAQ Admin Dashboard
```
"Add email gate to /faq-admin for riley@kitescouting.com and christian@kitescouting.com"
```
Result: Only those two can see the FAQ admin interface.

### Example 2: Reports Dashboard
```
"Add email gate to /reports for team@company.com"
```
Result: Anyone with team@company.com can access.

### Example 3: Expand Allowlist
```
"Add alex@company.com and jordan@company.com to the allowlist on my reports dashboard"
```
Result: Those two emails added to existing list.

### Example 4: Remove Access
```
"Remove jordan@company.com from the allowlist on my reports dashboard"
```
Result: That email no longer has access.

