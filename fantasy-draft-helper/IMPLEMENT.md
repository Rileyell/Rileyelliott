---
created: 2026-09-08
last_edited: 2026-09-08
version: 1.0
provenance: con_XCsPl93lMboybzeI
---

# Implementing the Fantasy Draft Helper on a new Zo account

> **Quick path:** `ZO-START.md` at the repo root covers setup in a few terminal commands.
> This file is the detailed reference.

A full-stack fantasy football draft assistant: Bun + Hono backend, React + Vite frontend,
SQLite (per-user session DB). Syncs a Sleeper or ESPN league, then layers a live draft room,
waiver-wire recommendations, watchlist/insights, and a Zo-powered AI chat advisor on top.

## What's in this folder

Everything needed to run the app: `server.ts`, `backend-lib/` (Sleeper/ESPN clients,
FantasyPros scraper, draft simulation, SQLite schema), `src/` (pages, components), `scripts/`
(preflight check + draft simulator), and `AGENTS.md` (the architecture map + import-contract
rules this project has broken on twice before — read it before editing anything).

**Not included** (by design): `node_modules/`, `dist/`, and the `data/` directory — the SQLite
databases in `data/` hold real users' league/draft data from the original deployment and don't
belong to a fresh install. The app creates new per-session databases automatically on first use.

## Steps

1. **Create a new Zo Site.** In the new Zo account, create a blank site (e.g. named
   `draft-app`). This gives you a fresh `/home/workspace/<site-name>/` directory.
2. **Copy this folder's contents** into that directory (everything except this `IMPLEMENT.md`).
3. **Check `zosite.json` ports don't conflict.** It ships with `local_port: 57404` and
   `published_port: 53849` — the ports used on the original deployment. If those happen to
   already be in use on the new account, pick different unused ports (ask Zo to check).
4. **Install dependencies:** `bun install` (a `bun.lock` is included for exact versions).
5. **Set secrets** in Settings → Advanced → Secrets on the new account:

   | Secret | Required? | Purpose |
   |---|---|---|
   | `ZO_API_KEY` | Yes, for AI chat | Create under Settings → Advanced → Access Tokens |
   | `ESPN_S2` / `ESPN_SWID` | Only if supporting ESPN leagues | From espn.com browser cookies (DevTools → Application → Cookies) |
   | `SLEEPER_LEAGUE_ID` / `SLEEPER_USER_ID` | Optional | Only powers the `/api/leagues/seed` dev-convenience endpoint; normal use goes through the onboarding UI instead |
   | `DRAFT_DB_PATH` | No | Defaults to `<site-dir>/data/draft.db` relative to the app — no path edits needed on a new Zo |

6. **Run preflight and build** (don't run `bun run dev` — it never exits; Zo runs the site
   itself):
   ```bash
   cd /home/workspace/<site-name>
   bash scripts/preflight.sh
   bun run build
   ```
7. **Connect a league** at the app's onboarding screen — Sleeper needs only a username; ESPN
   needs a League ID plus the `ESPN_S2`/`ESPN_SWID` cookies above.
8. **Publish** when ready for a persistent URL, via the Publish button on the Zo Sites page.

## Notes on portability

The two things that broke portability in an earlier version of this app — a hardcoded absolute
DB path and a hardcoded personal Sleeper league ID — have already been fixed upstream: the DB
path now resolves relative to the app directory (overridable via `DRAFT_DB_PATH`), and the seed
endpoint reads `SLEEPER_LEAGUE_ID`/`SLEEPER_USER_ID` from the environment instead of source. No
code edits should be required to stand this up on a new account — only the steps above.

`AGENTS.md` documents a recurring failure mode (import/export mismatches breaking the server)
and the mandatory preflight check that guards against it. Follow it for any future edits.
