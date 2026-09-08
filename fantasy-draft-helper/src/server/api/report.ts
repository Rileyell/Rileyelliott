import type { Context } from "hono";
import {
  getLeagueConfigs, getTeams, getRosterPlayers, getLatestRosterWeek, getPrimaryPlatform,
  upsertWeeklyReport, getWeeklyReport, type TeamRecord,
} from "../../../backend-lib/db";
import { callZo } from "../../../backend-lib/zo-api";
import { buildBigBoard, type BoardPlayer } from "./players";

const PRIMARY_POSITIONS = ["QB", "RB", "WR", "TE"];
const STARTER_REQUIREMENTS: Record<string, number> = { QB: 1, RB: 2, WR: 2, TE: 1 };

interface TeamPositionProfile {
  team: TeamRecord;
  byPosition: Record<string, BoardPlayer[]>; // rostered players at each position, sorted best ecr first
  avgEcrByPosition: Record<string, number | null>;
}

function buildTeamProfiles(
  platform: string, leagueId: string, season: number, week: number,
  teams: TeamRecord[], boardByPlayerId: Map<string, BoardPlayer>,
): TeamPositionProfile[] {
  return teams.map(team => {
    const roster = getRosterPlayers(platform, leagueId, season, week, team.team_ref);
    const byPosition: Record<string, BoardPlayer[]> = {};
    for (const row of roster) {
      const bp = boardByPlayerId.get(row.player_id);
      if (!bp || !PRIMARY_POSITIONS.includes(bp.position)) continue;
      (byPosition[bp.position] ??= []).push(bp);
    }
    for (const pos of Object.keys(byPosition)) {
      byPosition[pos].sort((a, b) => (a.ecr ?? 999) - (b.ecr ?? 999));
    }
    const avgEcrByPosition: Record<string, number | null> = {};
    for (const pos of PRIMARY_POSITIONS) {
      const players = byPosition[pos] ?? [];
      const withEcr = players.filter(p => p.ecr != null);
      avgEcrByPosition[pos] = withEcr.length
        ? withEcr.reduce((s, p) => s + (p.ecr ?? 0), 0) / withEcr.length
        : null;
    }
    return { team, byPosition, avgEcrByPosition };
  });
}

function toComparablePlayer(p: BoardPlayer): ComparablePlayer {
  return {
    player_id: p.player_id!, name: p.name, position: p.position,
    ecr: p.ecr, adp: p.adp, positionRank: p.positionRank, injury_status: p.injury_status,
  };
}

// My weakest bench player at a position (beyond starter requirement) — the natural "drop" if I add depth there.
function weakestBenchAt(profile: TeamPositionProfile, pos: string): BoardPlayer | null {
  const players = profile.byPosition[pos] ?? [];
  const required = STARTER_REQUIREMENTS[pos] ?? 0;
  if (players.length <= required) return null; // no spare depth at this position — nothing safe to drop
  return players[players.length - 1]; // sorted best ECR first, so last = weakest
}

// Fallback when the pickup's own position has no bench depth: my weakest bench player anywhere.
function weakestBenchAnywhere(profile: TeamPositionProfile): BoardPlayer | null {
  let worst: BoardPlayer | null = null;
  for (const pos of PRIMARY_POSITIONS) {
    const candidate = weakestBenchAt(profile, pos);
    if (!candidate) continue;
    if (!worst || (candidate.ecr ?? 999) > (worst.ecr ?? 999)) worst = candidate;
  }
  return worst;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export interface ComparablePlayer {
  player_id: string;
  name: string;
  position: string;
  ecr: number | null;
  adp: number | null;
  positionRank: number | null;
  injury_status: string | null;
}

export interface WaiverPickup {
  player_id: string;
  name: string;
  position: string;
  ecr: number | null;
  adp: number | null;
  positionRank: number | null;
  injury_status: string | null;
  need_position: boolean;
  drop_candidate: ComparablePlayer | null;
}

export interface TradeCandidate {
  id: string;
  other_team_ref: string;
  other_team_name: string;
  give_player: { player_id: string; name: string; position: string; ecr: number | null };
  get_player: { player_id: string; name: string; position: string; ecr: number | null };
  fairness_diff: number;
  confidence: "Low" | "Medium" | "High";
}

export interface ReportData {
  platform: string;
  league_id: string;
  season: number;
  week: number;
  my_team: { team_ref: string; team_name: string | null };
  needs: string[];
  surplus: string[];
  waiver_pickups: WaiverPickup[];
  trades: TradeCandidate[];
}

export async function computeReport(platform: string): Promise<ReportData> {
  const cfg = getLeagueConfigs().find(l => l.platform === platform);
  if (!cfg) throw new Error(`No league_config for platform=${platform}`);

  const teams = getTeams(cfg.platform, cfg.league_id, cfg.season);
  const myTeam = teams.find(t => t.is_my_team);
  if (!myTeam) throw new Error("My team not resolved — run /api/season/sync first");

  const week = getLatestRosterWeek(cfg.platform, cfg.league_id, cfg.season) ?? 1;
  const board = await buildBigBoard(platform);
  // roster_players.player_id is ESPN's own numeric player ID for ESPN
  // rosters (see season.ts syncEspnLeague), which doesn't match the board's
  // Sleeper-matched player_id — key off espn_id for that platform so team
  // profiles (and waiver/trade suggestions built from them) actually resolve.
  const idField: "player_id" | "espn_id" = cfg.platform === "espn" ? "espn_id" : "player_id";
  const boardByPlayerId = new Map(board.filter(p => p[idField]).map(p => [p[idField] as string, p]));

  const profiles = buildTeamProfiles(cfg.platform, cfg.league_id, cfg.season, week, teams, boardByPlayerId);
  const myProfile = profiles.find(p => p.team.team_ref === myTeam.team_ref)!;

  // League median avg-ECR per position (lower ECR = better player pool).
  const medianByPosition: Record<string, number | null> = {};
  for (const pos of PRIMARY_POSITIONS) {
    medianByPosition[pos] = median(
      profiles.map(p => p.avgEcrByPosition[pos]).filter((v): v is number => v != null)
    );
  }

  const needs: string[] = [];
  const surplus: string[] = [];
  for (const pos of PRIMARY_POSITIONS) {
    const mine = myProfile.avgEcrByPosition[pos];
    const med = medianByPosition[pos];
    const depth = (myProfile.byPosition[pos] ?? []).length;
    const required = STARTER_REQUIREMENTS[pos];
    if (mine == null || med == null) continue;
    if (mine > med + 15 || depth <= required) needs.push(pos);
    else if (mine < med - 15 && depth > required + 1) surplus.push(pos);
  }

  // Waiver pickups: best undrafted players at need positions (fallback: best overall undrafted).
  const undrafted = board.filter(p => !p.is_drafted && p.player_id).sort((a, b) => (a.ecr ?? 999) - (b.ecr ?? 999));
  const waiverPool = needs.length
    ? undrafted.filter(p => needs.includes(p.position))
    : undrafted.filter(p => PRIMARY_POSITIONS.includes(p.position));
  const waiver_pickups: WaiverPickup[] = waiverPool.slice(0, 5).map(p => {
    const dropCandidate = weakestBenchAt(myProfile, p.position) ?? weakestBenchAnywhere(myProfile);
    return {
      player_id: p.player_id!, name: p.name, position: p.position, ecr: p.ecr,
      adp: p.adp, positionRank: p.positionRank, injury_status: p.injury_status,
      need_position: needs.includes(p.position),
      drop_candidate: dropCandidate ? toComparablePlayer(dropCandidate) : null,
    };
  });

  // Trade candidates: for each other team, find a position where they're weak and I have surplus,
  // and a position where I'm weak and they have surplus — propose swapping bench depth.
  const trades: TradeCandidate[] = [];
  for (const other of profiles) {
    if (other.team.team_ref === myTeam.team_ref) continue;
    for (const needPos of needs) {
      const otherHasSurplus = (other.byPosition[needPos] ?? []).length > STARTER_REQUIREMENTS[needPos] + 1
        && (other.avgEcrByPosition[needPos] ?? 999) < (medianByPosition[needPos] ?? 999);
      if (!otherHasSurplus) continue;

      for (const surplusPos of surplus) {
        const iHaveSurplus = (myProfile.byPosition[surplusPos] ?? []).length > STARTER_REQUIREMENTS[surplusPos] + 1;
        const otherNeedsIt = (other.byPosition[surplusPos] ?? []).length <= STARTER_REQUIREMENTS[surplusPos]
          || (other.avgEcrByPosition[surplusPos] ?? 0) > (medianByPosition[surplusPos] ?? 0) + 10;
        if (!iHaveSurplus || !otherNeedsIt) continue;

        const giveMe = myProfile.byPosition[surplusPos]?.[myProfile.byPosition[surplusPos].length - 1]; // my weakest surplus-position bench player
        const getFromThem = other.byPosition[needPos]?.[other.byPosition[needPos].length - 1]; // their weakest depth at my need position
        if (!giveMe || !getFromThem) continue;

        const fairness_diff = Math.abs((giveMe.ecr ?? 200) - (getFromThem.ecr ?? 200));
        const confidence: TradeCandidate["confidence"] =
          fairness_diff <= 15 ? "High" : fairness_diff <= 40 ? "Medium" : "Low";

        trades.push({
          id: `${myTeam.team_ref}-${other.team.team_ref}-${surplusPos}-${needPos}`,
          other_team_ref: other.team.team_ref,
          other_team_name: other.team.team_name ?? other.team.owner_name ?? other.team.team_ref,
          give_player: { player_id: giveMe.player_id!, name: giveMe.name, position: giveMe.position, ecr: giveMe.ecr },
          get_player: { player_id: getFromThem.player_id!, name: getFromThem.name, position: getFromThem.position, ecr: getFromThem.ecr },
          fairness_diff,
          confidence,
        });
      }
    }
  }
  trades.sort((a, b) => a.fairness_diff - b.fairness_diff);
  const topTrades = trades.slice(0, 3);

  return {
    platform: cfg.platform, league_id: cfg.league_id, season: cfg.season, week,
    my_team: { team_ref: myTeam.team_ref, team_name: myTeam.team_name },
    needs, surplus, waiver_pickups, trades: topTrades,
  };
}

// ─── Narrative generation ──────────────────────────────────────────────────────

interface NarrativeResult {
  waiver_reasons: Record<string, string>; // player_id -> reason
  trade_reasons: Record<string, { reason_mine: string; reason_theirs: string }>; // trade id -> reasons
}

async function generateNarrative(report: ReportData): Promise<NarrativeResult> {
  const prompt = `You are a fantasy football analyst writing a concise weekly waiver/trade report.
Team needs: ${report.needs.join(", ") || "none identified"}. Team surplus: ${report.surplus.join(", ") || "none identified"}.

Waiver pickups to explain (write 1 short sentence each, reference the player by name and why they fit a need):
${report.waiver_pickups.map(w => `- ${w.name} (${w.position}, ECR ${w.ecr ?? "n/a"})`).join("\n") || "(none)"}

Trade proposals to explain (write one short sentence for why it helps MY team, and one short sentence for why the OTHER team's manager should accept it):
${report.trades.map(t => `- [${t.id}] I give ${t.give_player.name} (${t.give_player.position}, ECR ${t.give_player.ecr ?? "n/a"}) to ${t.other_team_name}, I get ${t.get_player.name} (${t.get_player.position}, ECR ${t.get_player.ecr ?? "n/a"})`).join("\n") || "(none)"}

Respond with ONLY valid JSON matching this shape, no markdown fences:
{
  "waiver_reasons": { "<player_id>": "reason" },
  "trade_reasons": { "<trade_id>": { "reason_mine": "...", "reason_theirs": "..." } }
}
Use these player_ids for waiver_reasons keys: ${report.waiver_pickups.map(w => w.player_id).join(", ") || "none"}
Use these trade ids for trade_reasons keys: ${report.trades.map(t => t.id).join(", ") || "none"}`;

  try {
    const res = await callZo(prompt, { model: "claude-haiku-4-5-20251001" });
    const text = typeof res.output === "string" ? res.output : JSON.stringify(res.output);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in Zo response");
    return JSON.parse(jsonMatch[0]) as NarrativeResult;
  } catch (err) {
    console.error("Narrative generation failed, falling back to templated text:", err);
    return {
      waiver_reasons: Object.fromEntries(report.waiver_pickups.map(w => [w.player_id, `Fills a need at ${w.position}, ranked #${w.ecr ?? "?"} overall.`])),
      trade_reasons: Object.fromEntries(report.trades.map(t => [t.id, {
        reason_mine: `Upgrades ${t.get_player.position} depth, a team need.`,
        reason_theirs: `Fills their ${t.give_player.position} need with a comparably ranked player.`,
      }])),
    };
  }
}

// ─── Routes ─────────────────────────────────────────────────────────────────────

export async function handleGenerateReport(c: Context): Promise<Response> {
  try {
    const platform = c.req.query("platform") ?? getPrimaryPlatform();
    const report = await computeReport(platform);
    const narrative = await generateNarrative(report);

    const enriched = {
      ...report,
      waiver_pickups: report.waiver_pickups.map(w => ({
        ...w,
        adp: w.adp,
        positionRank: w.positionRank,
        injury_status: w.injury_status,
        drop_candidate: w.drop_candidate,
        reason: narrative.waiver_reasons[w.player_id] ?? "",
      })),
      trades: report.trades.map(t => ({
        ...t,
        reason_mine: narrative.trade_reasons[t.id]?.reason_mine ?? "",
        reason_theirs: narrative.trade_reasons[t.id]?.reason_theirs ?? "",
      })),
    };

    const markdown = [
      `# Week ${report.week} Report — ${report.my_team.team_name ?? report.my_team.team_ref}`,
      `**Needs:** ${report.needs.join(", ") || "none"}  **Surplus:** ${report.surplus.join(", ") || "none"}`,
      ``,
      `## Waiver Pickups`,
      ...enriched.waiver_pickups.map(w => `- **${w.name}** (${w.position}, ECR ${w.ecr ?? "n/a"}) — ${w.reason}`),
      ``,
      `## Trade Proposals`,
      ...enriched.trades.map(t =>
        `- Give **${t.give_player.name}** to ${t.other_team_name}, get **${t.get_player.name}** — Confidence: ${t.confidence}\n  - Why it helps me: ${t.reason_mine}\n  - Why they should accept: ${t.reason_theirs}`
      ),
    ].join("\n");

    upsertWeeklyReport({
      platform: report.platform, league_id: report.league_id, season: report.season, week: report.week,
      report_markdown: markdown, report_json: enriched as unknown as Record<string, unknown>, status: "ready",
    });

    return c.json({ ok: true, report: enriched, markdown });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
}

export async function handleGetReport(c: Context): Promise<Response> {
  try {
    const platform = c.req.query("platform") ?? getPrimaryPlatform();
    const cfg = getLeagueConfigs().find(l => l.platform === platform);
    if (!cfg) return c.json({ error: `No ${platform} league configured` }, 404);
    const week = getLatestRosterWeek(cfg.platform, cfg.league_id, cfg.season) ?? 1;
    const existing = getWeeklyReport(cfg.platform, cfg.league_id, cfg.season, week);
    if (!existing) return c.json({ error: "No report generated yet — POST /api/season/report first" }, 404);
    return c.json({ ok: true, report: existing.report_json, markdown: existing.report_markdown });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
}
