import type { Context } from "hono";
import {
  getLeagueConfigs, getMyTeam, getRosterPlayers, getLatestRosterWeek, getPrimaryPlatform, type LeagueConfig,
} from "../../../backend-lib/db";
import { getSleeperNflState, getSleeperWeekProjections, type SleeperProjectionStats } from "../../../backend-lib/sleeper";
import { getFPProjections, type FPProjection } from "../../../backend-lib/fantasypros";
import { normalizeName } from "../../../backend-lib/rankings";
import { callZo } from "../../../backend-lib/zo-api";
import { buildBigBoard, type BoardPlayer } from "./players";

const PROJECTION_POSITIONS = ["qb", "rb", "wr", "te", "k", "dst"] as const;

export interface TeamRosterPlayer {
  player_id: string;
  name: string;
  position: string;
  team: string | null;
  is_starter: boolean;
  ecr: number | null;
  tier: number | null;
  injury_status: string | null;
  injury_body_part: string | null;
  bye: number | null;
  projected_points: number | null;
  insight: string;
}

// Resolve which NFL week to project. Sleeper exposes the authoritative
// current week; other platforms fall back to "one past the latest synced
// roster snapshot" as a reasonable guess.
async function resolveProjectionWeek(platform: string, latestWeek: number): Promise<number | "draft"> {
  if (platform === "sleeper") {
    try {
      const nflState = await getSleeperNflState();
      if (nflState.season_type === "regular" || nflState.season_type === "post") return nflState.week;
    } catch { /* fall through */ }
  }
  const guess = latestWeek + 1;
  return guess >= 1 && guess <= 18 ? guess : "draft";
}

async function fetchProjectionIndex(
  scoring: LeagueConfig["scoring_type"], season: number, week: number | "draft"
): Promise<Map<string, FPProjection>> {
  const byPos = await Promise.all(
    PROJECTION_POSITIONS.map(pos => getFPProjections(pos, scoring, season, week).catch(() => [] as FPProjection[]))
  );
  const index = new Map<string, FPProjection>();
  for (const list of byPos) {
    for (const proj of list) index.set(normalizeName(proj.player_name), proj);
  }
  return index;
}

// FantasyPros hasn't published a given in-season week's projections yet
// (e.g. too early in the preseason) — fall back to season-long numbers
// rather than show every player as unprojected. Returns the week that was
// actually served so the caller can label the numbers accurately.
async function loadProjectionIndex(
  scoring: LeagueConfig["scoring_type"], season: number, week: number | "draft"
): Promise<{ index: Map<string, FPProjection>; servedWeek: number | "draft" }> {
  const index = await fetchProjectionIndex(scoring, season, week);
  if (index.size >= 5 || week === "draft") return { index, servedWeek: week };
  return { index: await fetchProjectionIndex(scoring, season, "draft"), servedWeek: "draft" };
}

function sleeperPoints(stats: SleeperProjectionStats, scoring: LeagueConfig["scoring_type"]): number | null {
  const raw = scoring === "ppr" ? stats.pts_ppr : scoring === "half-ppr" ? stats.pts_half_ppr : stats.pts_std;
  return typeof raw === "number" ? raw : null;
}

// FantasyPros' free tier only covers the top ~10 players per position, so
// most bench/deep players never get a line from it. Sleeper publishes
// projections for every rostered player, keyed by the same player_id we
// already store — a reliable fallback with no name-matching needed.
async function loadSleeperProjections(
  platform: string, season: number, week: number | "draft"
): Promise<Map<string, SleeperProjectionStats>> {
  if (platform !== "sleeper" || week === "draft") return new Map();
  try {
    return await getSleeperWeekProjections(season, week);
  } catch {
    return new Map();
  }
}

function fallbackInsight(p: Omit<TeamRosterPlayer, "insight">, projectionWeek: number | "draft"): string {
  if (p.injury_status && ["Out", "Doubtful", "IR", "PUP"].includes(p.injury_status)) {
    return `${p.injury_status} — have a backup plan ready.`;
  }
  if (typeof projectionWeek === "number" && p.bye === projectionWeek) {
    return `On bye Week ${p.bye} — must start an alternate.`;
  }
  if (p.injury_status === "Questionable") {
    return "Questionable — check practice reports before lineup lock.";
  }
  if (p.is_starter) {
    return p.projected_points != null
      ? `Starting — projected ${p.projected_points.toFixed(1)} pts at ${p.position}.`
      : `Starting — locked into your ${p.position} slot.`;
  }
  if (p.ecr != null && p.ecr <= 100) {
    return "Bench depth — flex-worthy if a starter falters.";
  }
  return "Deep bench — low-ceiling stash, monitor for role changes.";
}

async function generateInsights(
  players: Omit<TeamRosterPlayer, "insight">[], projectionWeek: number | "draft"
): Promise<Record<string, string>> {
  const fallback = Object.fromEntries(players.map(p => [p.player_id, fallbackInsight(p, projectionWeek)]));
  if (players.length === 0) return fallback;

  const prompt = `You are a fantasy football analyst writing short, sharp roster notes for Week ${projectionWeek === "draft" ? "the upcoming season" : projectionWeek}.
For each player below, write ONE short sentence (max 14 words) — a start/sit call, an injury/bye flag, or a "look out for" note about their role or matchup outlook. Be direct and specific, not generic.

The STARTER/bench label below is already the correct, roster-slot-aware answer to "who starts" — it accounts for this league's exact starting slot limits (e.g. only 1 QB slot means only 1 QB is ever labeled STARTER, no matter how the other one ranks). Never contradict that label: don't write "start" language for a bench-labeled player, and don't imply two players at the same limited-slot position could both start.

Players (name, position, starter?, ECR rank, injury status, bye week, projected points):
${players.map(p => `- [${p.player_id}] ${p.name} (${p.position}${p.team ? `, ${p.team}` : ""}) — ${p.is_starter ? "STARTER" : "bench"}, ECR ${p.ecr ?? "n/a"}, injury: ${p.injury_status ?? "none"}, bye: ${p.bye ?? "n/a"}, proj: ${p.projected_points ?? "n/a"}`).join("\n")}

Respond with ONLY valid JSON, no markdown fences:
{ "insights": { "<player_id>": "sentence" } }
Use exactly these player_ids as keys: ${players.map(p => p.player_id).join(", ")}`;

  try {
    const res = await callZo(prompt, { model: "claude-haiku-4-5-20251001" });
    const text = typeof res.output === "string" ? res.output : JSON.stringify(res.output);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in Zo response");
    const parsed = JSON.parse(jsonMatch[0]) as { insights?: Record<string, string> };
    const insights = parsed.insights ?? {};
    // Fill any gaps with the heuristic fallback so every player always has a note.
    return { ...fallback, ...insights };
  } catch (err) {
    console.error("Team insight generation failed, using heuristic fallback:", err);
    return fallback;
  }
}

// ─── GET /api/team/summary ─────────────────────────────────────────────────────

export async function handleGetTeamSummary(c: Context): Promise<Response> {
  try {
    const platform = c.req.query("platform") ?? getPrimaryPlatform();
    const cfg = getLeagueConfigs().find(l => l.platform === platform);
    if (!cfg) return c.json({ error: `No ${platform} league configured` }, 404);

    const myTeam = getMyTeam(cfg.platform, cfg.league_id, cfg.season);
    if (!myTeam) {
      return c.json({ error: "not_synced", message: `My team not resolved yet — sync with ${platform === "espn" ? "ESPN" : "Sleeper"} first.` }, 404);
    }

    const latestWeek = getLatestRosterWeek(cfg.platform, cfg.league_id, cfg.season) ?? 1;
    const rosterRows = getRosterPlayers(cfg.platform, cfg.league_id, cfg.season, latestWeek, myTeam.team_ref);

    const [board, projectionWeek] = await Promise.all([
      buildBigBoard(platform),
      resolveProjectionWeek(platform, latestWeek),
    ]);
    // roster_players.player_id is ESPN's own numeric player ID for ESPN
    // rosters (see season.ts syncEspnLeague), which doesn't match the
    // board's Sleeper-matched player_id — key off espn_id for that platform.
    const idField: "player_id" | "espn_id" = platform === "espn" ? "espn_id" : "player_id";
    const boardByPlayerId = new Map(board.filter((p: BoardPlayer) => p[idField]).map((p: BoardPlayer) => [p[idField] as string, p]));
    const { index: projIndex, servedWeek } = await loadProjectionIndex(cfg.scoring_type, cfg.season, projectionWeek);
    const sleeperProjIndex = await loadSleeperProjections(platform, cfg.season, servedWeek);

    const enriched: Omit<TeamRosterPlayer, "insight">[] = rosterRows.map(r => {
      const bp = boardByPlayerId.get(r.player_id);
      const proj = bp ? projIndex.get(normalizeName(bp.name)) : undefined;
      const sleeperStats = sleeperProjIndex.get(r.player_id);
      const projectedPoints = proj?.fpts ?? (sleeperStats ? sleeperPoints(sleeperStats, cfg.scoring_type) : null);
      return {
        player_id: r.player_id,
        name: bp?.name ?? r.player_id,
        position: bp?.position ?? r.position ?? "?",
        team: bp?.team ?? null,
        is_starter: r.is_starter,
        ecr: bp?.ecr ?? null,
        tier: bp?.tier ?? null,
        injury_status: bp?.injury_status ?? null,
        injury_body_part: bp?.injury_body_part ?? null,
        bye: bp?.bye ?? null,
        projected_points: projectedPoints,
      };
    }).sort((a, b) => (a.ecr ?? 999) - (b.ecr ?? 999));

    const insights = await generateInsights(enriched, servedWeek);
    const withInsights: TeamRosterPlayer[] = enriched.map(p => ({ ...p, insight: insights[p.player_id] ?? fallbackInsight(p, servedWeek) }));

    return c.json({
      league: { platform: cfg.platform, league_id: cfg.league_id, league_name: cfg.league_name },
      week: latestWeek,
      projection_week: servedWeek,
      roster_slots: (cfg.roster_positions ?? []).filter(pos => pos !== "BN"),
      team: myTeam,
      starters: withInsights.filter(p => p.is_starter),
      bench: withInsights.filter(p => !p.is_starter),
    });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
}
