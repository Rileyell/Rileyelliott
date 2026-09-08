---
created: 2026-08-13
last_edited: 2026-08-30
version: 1.1
provenance: con_79RSFJOHgzh1AiGC
---

# Fantasy Draft App — Agent Guidance

## ⚠️ MANDATORY: Run preflight before AND after every change

```bash
cd /home/workspace/Fantasy/draft-app && bash scripts/preflight.sh
```

This app has broken twice due to import/export mismatches across sessions.
**Do not skip this.** If preflight fails, fix all errors before making any new changes.

---

## Architecture Quick-Map

```
server.ts                          ← Hono server + Vite middleware (DO NOT add imports before writing the target file)
src/server/api/
  draft.ts                         ← draft pick tracking, undo, reset, simulate, watchlist, player notes
  players.ts                       ← big board, player lookups, board cache invalidation
  chat.ts                          ← Zo AI chat handler
  leagues.ts                       ← league config CRUD + sync
  rankings.ts                      ← FP rankings + ADP endpoints
  season.ts                        ← post-draft roster/season tracking
  report.ts                        ← season report generation
backend-lib/
  db.ts                            ← SQLite schema, cache helpers, LeagueConfig, WatchlistEntry, getPrimaryPlatform()
  draft-sim.ts                     ← draft simulation + autopick logic
  sleeper.ts                       ← Sleeper API client
  espn.ts                          ← ESPN API client (creds come from per-league settings_json.espn_s2/swid — see credsFromSettings())
  roster-slots.ts                  ← parses a league's roster_positions into exact/flex starting-slot counts (used by chat.ts + team.ts to enforce real lineup limits)
  fantasypros.ts                   ← FantasyPros scraper (rankings, ADP, news)
  rankings.ts                      ← ranking normalization + player matching
  zo-api.ts                        ← Zo API helper
  data/
    multi-source-brief.md          ← static cross-source rankings/injury brief, injected into chat.ts prompts
    roster-construction.md         ← evergreen roster-construction/VORP methodology doc, injected into chat.ts prompts (the app's "second brain" for lineup math, not just rankings)
src/
  App.tsx                          ← React Router setup + Nav + active-league platform resolution (useActivePlatform)
  lib/platform.ts                  ← shared getActivePlatform/setActivePlatform/withPlatform helpers — every league-scoped page fetch should go through withPlatform()
  pages/                           ← UI pages (home, draft, players, watchlist, setup, reports, onboarding, team)
  components/                      ← Shared components (chat-widget, etc.)
```

**Multi-platform (Sleeper + ESPN):** every server handler that reads/writes league data takes an optional `?platform=` param defaulting to `getPrimaryPlatform()` (most recently connected/synced league) — never hardcode `"sleeper"` as a default. On the frontend, the active league is resolved once in `App.tsx` (from `?platform=` on `/draft?platform=X` links, persisted to sessionStorage via `src/lib/platform.ts`) and threaded down as a `platform` prop; every fetch from a league-scoped page should go through `withPlatform(url, platform)`, not a raw URL. ESPN player identity does NOT match Sleeper's (`player_id` is Sleeper-matched by name; `espn_id` is ESPN's own numeric ID, resolved separately via `getEspnPlayers()` name-matching since FantasyPros' data has no native ESPN id field) — anywhere you join `draft_picks`/`roster_players` against the board, pick the id field by platform (`effectivePlatform === "espn" ? "espn_id" : "player_id"`).

---

## Current Export Surface (verified 2026-08-13, tsc clean)

**server.ts imports FROM:**

| File | Imported names |
|------|---------------|
| `src/server/api/players` | `handleGetPlayers`, `handleGetPlayer`, `handleInvalidateBoard`, `buildBigBoard` |
| `src/server/api/draft` | `handleDraftPlayer`, `handleUndoPick`, `handleGetDraft`, `handleResetDraft`, `handleWatchlist`, `handlePlayerNotes`, `handleSyncDraft`, `handleSimulateDraft`, `handleAutopickOpponents` |
| `src/server/api/chat` | `handleChat` |
| `src/server/api/leagues` | `handleGetLeagues`, `handleSyncLeagues`, `handleDemoSeed` |
| `src/server/api/season` | `handleSyncSeason`, `handleGetMyTeam` |
| `src/server/api/report` | `handleGenerateReport`, `handleGetReport` |

**⚠️ If you rename or add an export in any handler file, update server.ts on the same pass.**
**⚠️ If you add a new handler file, update this table.**

---

## Iron Rules (non-negotiable)

1. **Read before writing.** Before editing any file, read it. Before editing a handler file, also read `server.ts` to know the current import contract.

2. **Never write server.ts imports before the handler file exists.** Write the handler first, export the function, then add the import in server.ts.

3. **Run `bunx tsc --noEmit` after every file you write.** Not after all files — after each one. Import mismatches surface immediately.

4. **Smoke test after TypeScript passes:**
   ```bash
   curl -s http://localhost:57404/api/health | head -5
   ```
   If health returns nothing, the server is broken — stop and diagnose.

5. **ESPN is optional.** The app must work without `ESPN_S2` / `ESPN_SWID`. Never make a non-ESPN path wait on ESPN auth. ESPN features must degrade gracefully.

6. **Build one page to a visible, working state before starting the next.** Don't write 3 pages before verifying any render.

7. **No renaming exports without updating all import sites in the same session.** Check with:
   ```bash
   grep -r "handleOldName" /home/workspace/Fantasy/draft-app/server.ts
   ```

---

## Common Failure Patterns (happened twice — do not repeat)

| Anti-pattern | What went wrong | Prevention |
|---|---|---|
| Write server.ts imports before handler files | Functions didn't exist; app unrunnable | Write handler → export → then import |
| Rename handler export without updating server.ts | 16 TypeScript errors, silent until next session | tsc after every file |
| Block app startup on ESPN auth | Whole app unusable without cookies | ESPN path must be optional/additive |
| Write multiple files without a compile check | Errors accumulate, harder to untangle | tsc after each file |
| New session reconstructs context from scratch | Misses existing contracts | Always read AGENTS.md + server.ts first |

---

## Development Workflow

```bash
# Before making changes:
bash scripts/preflight.sh

# After each file edit:
bunx tsc --noEmit

# After all changes:
bash scripts/preflight.sh
curl -s http://localhost:57404/api/health
```

---

## Key Data

- **Dev port**: `57404`
- **Published port**: `53849`
- **DB**: per-session SQLite under `data/<sid>.db` (scoped via AsyncLocalStorage in `backend-lib/db.ts`)
- **Multi-user model**: Every user gets an isolated DB file keyed by their `sid` cookie. No hardcoded league IDs or user IDs.
- **ESPN credentials**: Stored in `settings_json` column of `league_config` table (per-user DB). Read back in `season.ts` via `sj.espn_s2` / `sj.swid`. Do NOT use `process.env.ESPN_S2 =` assignment — that pollutes the shared process.
