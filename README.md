---
created: 2026-09-08
last_edited: 2026-09-08
version: 1.0
provenance: con_XCsPl93lMboybzeI
---

# Riley Elliott — KITE Scouting 2026 Internship Projects

Portable source + context for the four projects showcased on
[rileye.zo.space](https://rileye.zo.space), built end-to-end on Zo Computer during a summer
at KITE Scouting. Each project folder is self-contained: source code, any supporting "second
brain" context it depends on (skills, knowledge bases, source data), and an `IMPLEMENT.md` with
step-by-step instructions for standing it back up on a different Zo account.

See `HANDOFF.md` for why this repo exists and how ownership migration actually works on Zo.

## Projects

| Folder | What it is | Live (original) |
|---|---|---|
| `resume-site/` | The homepage itself — a zo.space page route | https://rileye.zo.space |
| `fantasy-draft-helper/` | Multi-user fantasy football draft assistant — Sleeper/ESPN sync, live draft tool, waiver recommendations, AI chat | https://draft-app-rileye.zocomputer.io |
| `faq-dashboard/` | Point at any site, scrapes it, auto-generates a searchable FAQ hub with an AI chatbot and admin review tools | https://faq-dashboard-rileye.zocomputer.io |
| `climate-market-map/` | PitchBook-sourced European climate tech market intelligence dashboard (2,674 companies, contact data redacted) | https://climate-market-map-rileye.zocomputer.io |
| `data-designer/` | "Riley Voss" — a custom AI persona for data-viz critique, benchmarked against Claude and Gemini | https://data-designer-rileye.zocomputer.io |

## What's deliberately excluded

- `node_modules/`, `dist/`, `.claude/` local dev settings — regenerated on install, not needed.
- Per-user runtime data (e.g. Fantasy Draft Helper's per-session SQLite databases) — these belong
  to whoever used the live app, not to the codebase.
- Raw PitchBook source exports (`Pitchbook Sheets/*.xlsx`, etc.) — licensed data with personal
  contact fields. Only the already-redacted, company-level dataset that the live dashboard
  actually serves (`climate-market-map/data/companies.json`) is included.

## General setup pattern

**Setting up on a new account? Start with `ZO-START.md`** — a few terminal commands, no AI
credits needed. The rest of this section is background.

Every app here was built as a **Zo Site** (a `zosite.json`-defined Bun + Vite + React project).
On a new Zo account:

1. Create a new Site (in chat: "create a new site called X") or just `git clone` this repo and
   have Zo treat the folder as a Site workdir.
2. Copy the project's `zosite.json` and source into place.
3. `bun install` to pull dependencies (nothing here is hand-pinned to Zo-specific package
   versions beyond what's in `package.json`).
4. Follow the project's own `IMPLEMENT.md` for anything project-specific (secrets, seed data,
   skills it depends on).
5. `publish_site` to get a persistent `*.zocomputer.io` URL.

Each `IMPLEMENT.md` has the specifics — read it before starting, don't assume this generic
pattern covers everything.
