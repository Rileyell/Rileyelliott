import { serveStatic } from "hono/bun";
import type { ViteDevServer } from "vite";
import { createServer as createViteServer } from "vite";
import config from "./zosite.json";
import { Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { randomUUID } from "node:crypto";
import { sessionStorage } from "./backend-lib/db";

import { handleGetPlayers, handleGetPlayer, handleInvalidateBoard, buildBigBoard } from "./src/server/api/players";
import {
  handleDraftPlayer, handleUndoPick, handleGetDraft,
  handleResetDraft, handleWatchlist, handlePlayerNotes, handleSyncDraft, handleSimulateDraft,
  handleAutopickOpponents,
} from "./src/server/api/draft";
import { handleChat } from "./src/server/api/chat";
import { handleGetLeagues, handleSyncLeagues, handleDemoSeed } from "./src/server/api/leagues";
import { handleSyncSeason, handleGetMyTeam } from "./src/server/api/season";
import { handleGetTeamSummary } from "./src/server/api/team";
import { handleGenerateReport, handleGetReport } from "./src/server/api/report";

// AI agents: read README.md for navigation and contribution guidance.
type Mode = "development" | "production";
type AppEnv = { Variables: { sessionId: string } };
const app = new Hono<AppEnv>();

// ─── Session middleware ───────────────────────────────────────────────────────
// Reads or mints a `sid` cookie; attaches sessionId to Hono context.
// Any handler can call c.get("sessionId") to scope its DB to this user.
app.use("*", async (c, next) => {
  let sid = getCookie(c, "sid");
  if (!sid) {
    sid = randomUUID();
    setCookie(c, "sid", sid, {
      httpOnly: true,
      sameSite: "Lax",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });
  }
  c.set("sessionId", sid);
  // Run the rest of the request inside the session-scoped AsyncLocalStorage context
  // so getDb() in any handler automatically resolves to this user's DB file.
  await sessionStorage.run(sid, () => next());
});

const mode: Mode =
  process.env.NODE_ENV === "production" ? "production" : "development";

// ─── Health ───────────────────────────────────────────────────────────────────
app.get("/api/health", (c) => c.json({ ok: true, mode }));

// ─── Players / board ─────────────────────────────────────────────────────────
app.get("/api/players", handleGetPlayers);
app.get("/api/players/:id", handleGetPlayer);
app.post("/api/players/invalidate", handleInvalidateBoard);

// ─── Draft state ──────────────────────────────────────────────────────────────
app.get("/api/draft/state", handleGetDraft);
app.post("/api/draft/pick", handleDraftPlayer);
app.post("/api/draft/undo", handleUndoPick);
app.post("/api/draft/reset", handleResetDraft);
app.post("/api/draft/sync", handleSyncDraft);
app.post("/api/draft/simulate", handleSimulateDraft);
app.post("/api/draft/autopick-opponents", handleAutopickOpponents);
app.patch("/api/draft/pick", async (c) => {
  try {
    const { pick_no, platform: reqPlatform } = await c.req.json() as { pick_no: number; platform?: string };
    const { togglePickOwnership, getLeagueConfigs, getDraftPicks, getPrimaryPlatform } = await import("./backend-lib/db");
    const configs = getLeagueConfigs();
    if (!configs.length) return c.json({ error: "No league configured" }, 400);
    // Resolve the right config: prefer requested platform, else find whichever has the pick
    let cfg = configs.find(l => l.platform === (reqPlatform ?? getPrimaryPlatform())) ?? configs[0];
    // If that config has no picks with this pick_no, try the other configs
    if (!getDraftPicks(cfg.draft_id!, cfg.platform).find(p => p.pick_no === pick_no)) {
      const alt = configs.find(l => getDraftPicks(l.draft_id!, l.platform).find(p => p.pick_no === pick_no));
      if (alt) cfg = alt;
    }
    const newVal = togglePickOwnership(cfg.draft_id!, cfg.platform, pick_no);
    return c.json({ ok: true, pick_no, is_my_pick: newVal });
  } catch (err) { return c.json({ error: String(err) }, 500); }
});

// ─── Watchlist ────────────────────────────────────────────────────────────────
app.get("/api/watchlist", handleWatchlist);
app.post("/api/watchlist", handleWatchlist);
app.delete("/api/watchlist", handleWatchlist);
app.get("/api/watchlist/enriched", async (c) => {
  try {
    const { getWatchlist } = await import("./backend-lib/db");
    const entries = getWatchlist();
    if (entries.length === 0) return c.json({ players: [] });
    const board = await buildBigBoard();
    const boardByPlayerIdMap = new Map(board.filter(p => p.player_id).map(p => [p.player_id!, p]));
    const players = entries.map(e => {
      const b = boardByPlayerIdMap.get(e.player_id) ?? null;
      return {
        player_id: e.player_id,
        platform: e.platform,
        name: b?.name ?? e.player_id,
        position: b?.position ?? "?",
        team: b?.team ?? null,
        rank: b?.rank ?? null,
        tier: b?.tier ?? e.tier,
        is_drafted: b?.is_drafted ?? false,
        note: b?.note ?? e.note,
      };
    });
    return c.json({ players });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

// ─── Player notes ─────────────────────────────────────────────────────────────
app.get("/api/notes", handlePlayerNotes);
app.post("/api/notes", handlePlayerNotes);

// ─── League config ────────────────────────────────────────────────────────────
app.get("/api/leagues", async (c) => {
  const { getLeagueConfigs } = await import("./backend-lib/db");
  return c.json({ leagues: getLeagueConfigs() });
});

app.post("/api/leagues/sync", async (c) => { return handleSyncLeagues(c); });
app.post("/api/leagues/demo", handleDemoSeed);

app.post("/api/leagues/pick-slot", async (c) => {
  try {
    const { platform, my_pick_slot } = await c.req.json();
    const { getLeagueConfigs, upsertLeagueConfig } = await import("./backend-lib/db");
    const leagues = getLeagueConfigs().filter((l) => l.platform === platform);
    if (!leagues.length) return c.json({ error: "No league found for platform" }, 404);
    for (const l of leagues) upsertLeagueConfig({ ...l, my_pick_slot });
    return c.json({ ok: true });
  } catch (err) { return c.json({ error: String(err) }, 500); }
});

app.post("/api/leagues/seed", async (c) => {
  try {
    const { upsertLeagueConfig, getLeagueConfigs } = await import("./backend-lib/db");
    const { getSleeperLeague, detectSleeperScoring, getSleeperDraft } = await import("./backend-lib/sleeper");

    const SLEEPER_LEAGUE_ID = process.env.SLEEPER_LEAGUE_ID ?? "";
    const SLEEPER_USER_ID = process.env.SLEEPER_USER_ID ?? "";
    if (!SLEEPER_LEAGUE_ID || !SLEEPER_USER_ID) return c.json({ error: "Set SLEEPER_LEAGUE_ID and SLEEPER_USER_ID env vars to use this seed endpoint" }, 400);

    // Sleeper
    const sleeper = await getSleeperLeague(SLEEPER_LEAGUE_ID);
    const sleeperScoring = detectSleeperScoring(sleeper);
    let sleeperDraftId: string | null = sleeper.draft_id ?? null;
    let myPickSlot: number | null = null;

    if (sleeperDraftId) {
      try {
        const draft = await getSleeperDraft(sleeperDraftId);
        // Find my slot from draft_order if user_id is known
        const SLEEPER_USER_ID_ENV = process.env.SLEEPER_USER_ID ?? "";
        if (SLEEPER_USER_ID_ENV && draft.draft_order) {
          myPickSlot = draft.draft_order[SLEEPER_USER_ID_ENV] ?? null;
        }
      } catch { /* non-critical */ }
    }

    upsertLeagueConfig({
      platform: "sleeper",
      league_id: SLEEPER_LEAGUE_ID,
      league_name: sleeper.name,
      season: parseInt(sleeper.season),
      scoring_type: sleeperScoring,
      total_teams: sleeper.total_rosters,
      roster_positions: sleeper.roster_positions,
      draft_id: sleeperDraftId,
      my_pick_slot: myPickSlot,
      settings_json: sleeper.settings ?? {},
    });

    const leagues = getLeagueConfigs();
    return c.json({ ok: true, seeded: leagues.length, leagues });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

// ─── Season manager (waivers/trades) ───────────────────────────────────────────
app.post("/api/season/sync", handleSyncSeason);
app.get("/api/season/team/:platform", handleGetMyTeam);
app.get("/api/team/summary", handleGetTeamSummary);
app.post("/api/season/report", handleGenerateReport);
app.get("/api/season/report", handleGetReport);

// ─── Chat (AI draft assistant) ────────────────────────────────────────────────
app.post("/api/chat", handleChat);

// ─── News (Phase 4 stub) ─────────────────────────────────────────────────────
app.get("/api/news", async (c) => {
  return c.json({ news: [], message: "News feed coming in Phase 4" });
});

// ─── Insights ─────────────────────────────────────────────────────────────────
app.get("/api/insights", async (c) => {
  try {
    const { getLeagueConfigs, getDraftPicks, getPrimaryPlatform, upsertLeagueConfig } = await import("./backend-lib/db");
    const platform = c.req.query("platform") ?? getPrimaryPlatform();
    const configs = getLeagueConfigs();
    let cfg = configs.find(l => l.platform === platform) ?? configs[0];

    // ESPN's pick order (and therefore our slot) may not have been published
    // yet at connect time — keep checking until it resolves, same as the
    // live draft sync poll, so Insights doesn't sit stale on "no pick" forever.
    if (cfg && cfg.platform === "espn" && cfg.my_pick_slot == null) {
      try {
        const { credsFromSettings, getEspnLeague, getEspnMyDraftPickSlot } = await import("./backend-lib/espn");
        const creds = credsFromSettings(cfg.settings_json);
        if (creds) {
          const league = await getEspnLeague(cfg.league_id, cfg.season, creds);
          const mySlot = getEspnMyDraftPickSlot(league, creds.swid);
          if (mySlot != null) {
            cfg = { ...cfg, my_pick_slot: mySlot };
            upsertLeagueConfig(cfg);
          }
        }
      } catch { /* non-critical — retry on next load */ }
    }

    const board = await buildBigBoard(cfg?.platform ?? "sleeper");
    const picks = cfg?.draft_id ? getDraftPicks(cfg.draft_id, cfg.platform) : [];
    const totalTeams = cfg?.total_teams ?? 12;
    const mySlot = cfg?.my_pick_slot ?? null;
    const rounds = ((cfg?.settings_json as { draft_rounds?: number }) ?? {})?.draft_rounds ?? 15;

    const undrafted = board.filter(p => !p.is_drafted);
    const drafted = board.filter(p => p.is_drafted);
    const currentPick = picks.length + 1;
    const currentRound = Math.ceil(currentPick / totalTeams);

    // VALUE SLIDES: ECR rank much better than ADP (player going later than consensus)
    const valueSlides = undrafted
      .filter(p => p.ecr != null && p.adp != null && p.adp - p.ecr >= 10)
      .sort((a, b) => (b.adp! - b.ecr!) - (a.adp! - a.ecr!))
      .slice(0, 10)
      .map(p => ({
        player_id: p.player_id,
        name: p.name,
        position: p.position,
        team: p.team,
        rank: p.rank,
        tier: p.tier,
        ecr: p.ecr,
        adp: p.adp,
        slide_picks: Math.round(p.adp! - p.ecr!),
        best: p.best,
        worst: p.worst,
        std_dev: p.stdDev,
      }));

    // REACH ALERTS: players drafted well above ECR
    const reachAlerts = drafted
      .filter(p => p.ecr != null && p.drafted_at_pick != null && p.ecr - p.drafted_at_pick >= 15)
      .sort((a, b) => (b.ecr! - b.drafted_at_pick!) - (a.ecr! - a.drafted_at_pick!))
      .slice(0, 8)
      .map(p => ({
        player_id: p.player_id,
        name: p.name,
        position: p.position,
        team: p.team,
        ecr: p.ecr,
        drafted_at: p.drafted_at_pick,
        reach_by: Math.round(p.ecr! - p.drafted_at_pick!),
      }));

    // POSITIONAL RUNS: detect rushes in last 12 picks
    const recentPicks = picks.slice(-12);
    const posCount: Record<string, number> = {};
    for (const pk of recentPicks) {
      if (pk.position) posCount[pk.position] = (posCount[pk.position] ?? 0) + 1;
    }
    const positionRuns = Object.entries(posCount)
      .filter(([, count]) => count >= 3)
      .sort((a, b) => b[1] - a[1])
      .map(([pos, count]) => ({ position: pos, count, in_last: recentPicks.length }));

    // TIER BARGAINS: best undrafted player per tier
    const tierGroups: Record<number, typeof undrafted> = {};
    for (const p of undrafted) {
      if (p.tier == null) continue;
      if (!tierGroups[p.tier]) tierGroups[p.tier] = [];
      tierGroups[p.tier].push(p);
    }
    const tierBargains = Object.entries(tierGroups)
      .filter(([, players]) => players.length > 0)
      .sort(([a], [b]) => Number(a) - Number(b))
      .slice(0, 6)
      .map(([tier, players]) => ({
        tier: Number(tier),
        top_player: players[0] ? {
          player_id: players[0].player_id,
          name: players[0].name,
          position: players[0].position,
          team: players[0].team,
          rank: players[0].rank,
          ecr: players[0].ecr,
          adp: players[0].adp,
        } : null,
        remaining_count: players.length,
      }));

    // NEXT-PICK TARGETS: best available when I pick next (snake draft)
    let myNextPick: number | null = null;
    if (mySlot != null) {
      let pick = currentPick;
      while (pick <= totalTeams * rounds) {
        const round = Math.ceil(pick / totalTeams);
        const slotInRound = round % 2 === 1
          ? ((pick - 1) % totalTeams) + 1
          : totalTeams - ((pick - 1) % totalTeams);
        if (slotInRound === mySlot) { myNextPick = pick; break; }
        pick++;
      }
    }
    const picksUntilMine = myNextPick != null ? myNextPick - currentPick : null;
    const nextPickTargets = undrafted
      .slice(0, picksUntilMine != null ? picksUntilMine + 8 : 12)
      .map(p => ({
        player_id: p.player_id,
        name: p.name,
        position: p.position,
        team: p.team,
        rank: p.rank,
        tier: p.tier,
        ecr: p.ecr,
        adp: p.adp,
        likely_available: picksUntilMine != null && (p.adp == null || p.adp > myNextPick!),
      }));

    // POSITIONAL SCARCITY: top-12 at each position — how many gone
    const posScarcity = ["QB", "RB", "WR", "TE"].map(pos => {
      const posBoard = board.filter(p => p.position === pos).sort((a, b) => a.rank - b.rank);
      const top12 = posBoard.slice(0, 12);
      const gone = top12.filter(p => p.is_drafted).length;
      const bestRemaining = posBoard.find(p => !p.is_drafted);
      return {
        position: pos,
        top12_drafted: gone,
        top12_remaining: 12 - gone,
        best_remaining: bestRemaining ? {
          name: bestRemaining.name,
          rank: bestRemaining.rank,
          ecr: bestRemaining.ecr,
          adp: bestRemaining.adp,
          tier: bestRemaining.tier,
        } : null,
        scarcity_pct: Math.round((gone / 12) * 100),
      };
    });

    return c.json({
      draft_state: {
        current_pick: currentPick,
        current_round: currentRound,
        total_picks: picks.length,
        my_slot: mySlot,
        my_next_pick: myNextPick,
        picks_until_mine: picksUntilMine,
        total_teams: totalTeams,
      },
      value_slides: valueSlides,
      reach_alerts: reachAlerts,
      position_runs: positionRuns,
      tier_bargains: tierBargains,
      next_pick_targets: nextPickTargets,
      positional_scarcity: posScarcity,
    });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});


if (mode === "production") {
  configureProduction(app);
} else {
  await configureDevelopment(app);
}

const port = process.env.PORT
  ? parseInt(process.env.PORT, 10)
  : mode === "production"
    ? (config.publish?.published_port ?? config.local_port)
    : config.local_port;

export default { fetch: app.fetch, port, idleTimeout: 255 };

function configureProduction(app: Hono<AppEnv>) {
  app.use("/assets/*", serveStatic({ root: "./dist" }));
  app.get("/favicon.ico", (c) => c.redirect("/favicon.svg", 302));
  app.use(async (c, next) => {
    if (c.req.method !== "GET") return next();
    const path = c.req.path;
    if (path.startsWith("/api/") || path.startsWith("/assets/")) return next();
    const file = Bun.file(`./dist${path}`);
    if (await file.exists()) {
      const stat = await file.stat();
      if (stat && !stat.isDirectory()) return new Response(file);
    }
    return serveStatic({ path: "./dist/index.html" })(c, next);
  });
}

async function configureDevelopment(app: Hono<AppEnv>): Promise<ViteDevServer> {
  const vite = await createViteServer({
    server: { middlewareMode: true, hmr: false, ws: false },
    appType: "custom",
  });

  app.use("*", async (c, next) => {
    if (c.req.path.startsWith("/api/")) return next();
    if (c.req.path === "/favicon.ico") return c.redirect("/favicon.svg", 302);
    const url = c.req.path;
    try {
      if (url === "/" || url === "/index.html") {
        let template = await Bun.file("./index.html").text();
        template = await vite.transformIndexHtml(url, template);
        return c.html(template, { headers: { "Cache-Control": "no-store, must-revalidate" } });
      }
      const publicFile = Bun.file(`./public${url}`);
      if (await publicFile.exists()) {
        const stat = await publicFile.stat();
        if (stat && !stat.isDirectory()) {
          return new Response(publicFile, { headers: { "Cache-Control": "no-store, must-revalidate" } });
        }
      }
      let result;
      try { result = await vite.transformRequest(url); } catch { result = null; }
      if (result) {
        return new Response(result.code, {
          headers: { "Content-Type": "application/javascript", "Cache-Control": "no-store, must-revalidate" },
        });
      }
      let template = await Bun.file("./index.html").text();
      template = await vite.transformIndexHtml("/", template);
      return c.html(template, { headers: { "Cache-Control": "no-store, must-revalidate" } });
    } catch (error) {
      vite.ssrFixStacktrace(error as Error);
      console.error(error);
      return c.text("Internal Server Error", 500);
    }
  });

  return vite;
}

