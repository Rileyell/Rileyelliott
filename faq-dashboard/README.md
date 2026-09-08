---
created: 2026-08-13
last_edited: 2026-08-13
version: 1.0
provenance: con_CGUlfQAhrFqQEX6U
---

# FAQ Dashboard — Generic Edition

A fully generic, multi-tenant FAQ management system running as a Zo Site. This is the genericized
version of the KITE Scouting FAQ platform, with all client-specific branding removed.

## Purpose

Manage FAQ dashboards for any program or event. Supports multiple events in parallel, OTP-gated admin
access, public client-facing pages, question inbox, analytics, and logo uploads — all using flat JSON
files (no external database).

## Routes

| Path | Description |
|------|-------------|
| `/` | FAQ Hub — admin login + event list, analytics overview |
| `/admin` | Event admin — manage FAQ entries, inbox, drafts, publish |
| `/faq/:slug` | Public client page — searchable FAQ by event slug |

## Setup (after first deploy)

1. **Add allowed admin emails** — Edit `ALLOWED_EMAILS` in `src/pages/faq-hub.tsx`, `src/pages/faq-event-admin.tsx`, and `backend-lib/faq-api/otp-send.ts` (3 copies, keep in sync).
2. **Set env vars** in `zosite.json` → `env`:
   - `FAQ_EXTRACT_MODEL` — your BYOK model ID (for AI-powered FAQ extraction via OTP send)
   - `ZO_NOTIFY_EMAIL` — optional admin notification email
3. **Replace logo** — drop your brand logo at `public/images/brand-logo.png` (replaces the "F" placeholder).
4. **Create first event** — Log in at `/`, click "New Event", fill in name/slug/client/accent color.

## Data Storage

All data lives inside this site's directory:

```
data/
├── faq-events.json          ← Event registry (auto-managed)
├── logos/                   ← Uploaded logos per event slug
└── <slug>/
    └── faq_data.json        ← FAQ entries for that event
```

No external DB required. The registry file is created automatically on first event creation.

## Architecture

- **Backend**: Bun + Hono (`server.ts` + `backend-lib/faq-api/`)
- **Frontend**: React + Vite + Tailwind CSS 4 (`src/pages/`)
- **Auth**: OTP email codes (in-memory store, server-side)
- **Storage**: Flat JSON files (no SQLite, no cloud)

## Project Notes

### Key Technical Decisions
- Flat JSON chosen over SQLite for portability — files can be inspected, edited, and version-controlled
- OTP store is in-memory; restarting the server clears pending codes (by design, codes expire in ~5 min)
- Three separate ALLOWED_EMAILS arrays (hub, admin page, OTP API) — consolidation opportunity noted
- `brand-logo.png` is a generic placeholder (letter F); replace with your own for a branded look

### File Structure

```
.
├── server.ts                    ← Hono server + all API route imports
├── src/
│   ├── App.tsx                  ← React Router config (/, /admin, /faq/:slug)
│   └── pages/
│       ├── faq-hub.tsx          ← Hub: login, event list, analytics
│       ├── faq-event-admin.tsx  ← Admin: FAQ editor, inbox, drafts
│       └── faq-slug.tsx         ← Public: searchable FAQ page
├── backend-lib/
│   └── faq-api/                 ← 20 API handlers (events, faq, otp, analytics)
├── data/
│   ├── faq-events.json          ← Event registry
│   └── logos/                   ← Per-event uploaded logos
└── public/
    └── images/
        └── brand-logo.png       ← Replace with your brand logo
```

---

This is a **Zo Site** — a web application running on a Zo computer that combines Bun + Hono backend
with React + Vite frontend. Never edit `zosite.json` system fields (local_port, entrypoints).
