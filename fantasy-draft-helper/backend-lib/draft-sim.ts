// Draft simulation + autopick engine. Two modes:
//  - simulateDraft(): fully automated, all 12 teams, used by "Simulate Full Draft"
//  - autopickOpponentsUntilMyTurn(): picks for every non-mine slot only, stopping
//    right before the human's turn — used by "Live Draft" mode, where the human
//    drafts their own team through the real board and opponents fill instantly
//    between turns.
// Both share the same player pool, position-cap logic, and roster seeding so
// results stay consistent regardless of which mode produced the picks.

import {
  getLeagueConfigs, getTeams, saveDraftPick, getDraftPicks, getDb, getRosterPlayers,
  upsertRosterPlayers, type DraftPickRecord, type RosterPlayerRecord, type TeamRecord, type LeagueConfig,
} from "./db";
import { getFPRankings, matchPlayerIds, buildNameIndex, type RankedPlayer } from "./rankings";
import { getAllSleeperPlayers } from "./sleeper";

const STARTER_SLOTS = ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "FLEX", "K", "DEF"];
const POSITION_CAPS: Record<string, number> = { QB: 3, RB: 7, WR: 8, TE: 3, K: 1, DST: 1 };
export const ROUNDS = 15; // real league setting (verified via Sleeper API; league_config cache has a stale "3")

// ─── Shared setup ───────────────────────────────────────────────────────────────

interface DraftSetup {
  cfg: LeagueConfig;
  draftId: string;
  teams: TeamRecord[];
  myTeam: TeamRecord | undefined;
  totalTeams: number;
  slotToTeamRef: Map<number, string>;
}

function loadSetup(platform: string): DraftSetup {
  const cfg = getLeagueConfigs().find(l => l.platform === platform);
  if (!cfg) throw new Error(`No league_config row for platform=${platform}`);
  const draftId = cfg.draft_id ?? `offline_${platform}`;
  const teams = getTeams(platform, cfg.league_id, cfg.season ?? 2026);
  if (teams.length === 0) throw new Error(`No teams synced for ${platform} — run /api/season/sync first`);

  const totalTeams = cfg.total_teams ?? teams.length;
  const mySlot = cfg.my_pick_slot ?? 1;
  const myTeam = teams.find(t => t.is_my_team);
  const others = teams.filter(t => !t.is_my_team).sort((a, b) => a.team_ref.localeCompare(b.team_ref));
  const slotToTeamRef = new Map<number, string>();
  if (myTeam) slotToTeamRef.set(mySlot, myTeam.team_ref);
  let cursor = 0;
  for (let slot = 1; slot <= totalTeams; slot++) {
    if (slotToTeamRef.has(slot)) continue;
    slotToTeamRef.set(slot, others[cursor++]?.team_ref ?? `team_${slot}`);
  }

  return { cfg, draftId, teams, myTeam, totalTeams, slotToTeamRef };
}

async function loadPlayerPool(platform: string, cfg: LeagueConfig): Promise<RankedPlayer[]> {
  const scoring = (cfg.scoring_type ?? "ppr") as "ppr" | "half-ppr" | "standard";
  const raw = await getFPRankings(scoring, "overall");
  const sleeperPlayers = platform === "sleeper" ? await getAllSleeperPlayers().catch(() => ({})) : {};
  const nameIndex = buildNameIndex(sleeperPlayers);
  return matchPlayerIds(raw, nameIndex).filter(p => p.name && p.position);
}

function slotForPick(pickNo: number, totalTeams: number): { round: number; slot: number } {
  const round = Math.ceil(pickNo / totalTeams);
  const slot = round % 2 === 0
    ? totalTeams - ((pickNo - 1) % totalTeams)
    : ((pickNo - 1) % totalTeams) + 1;
  return { round, slot };
}

function pickBestAvailable(
  pool: RankedPlayer[], draftedIds: Set<string>, rosterCounts: Map<string, Record<string, number>>,
  teamRef: string, pickNo: number, totalTeams: number,
): RankedPlayer | null {
  const counts = rosterCounts.get(teamRef) ?? (rosterCounts.set(teamRef, {}).get(teamRef)!);
  const lateRound = pickNo > (ROUNDS - 3) * totalTeams; // last 3 rounds: allow K/DST
  for (const p of pool) {
    const key = p.player_id ?? p.name;
    if (draftedIds.has(key)) continue;
    const pos = p.position.toUpperCase();
    if ((pos === "K" || pos === "DST") && !lateRound) continue;
    const cap = POSITION_CAPS[pos] ?? 4;
    if ((counts[pos] ?? 0) >= cap) continue;
    draftedIds.add(key);
    counts[pos] = (counts[pos] ?? 0) + 1;
    return p;
  }
  return null;
}

// Reconstructs drafted-player-ids and per-team position counts from picks
// already recorded (mix of human "mine" picks + prior autopicked rows).
function stateFromExistingPicks(existing: DraftPickRecord[], myTeamRef: string | undefined) {
  const draftedIds = new Set<string>(existing.filter(p => p.player_id).map(p => p.player_id!));
  const rosterCounts = new Map<string, Record<string, number>>();
  for (const p of existing) {
    const teamRef = p.is_my_pick ? myTeamRef : p.team_name; // team_name repurposed to carry team_ref (see saveDraftPick calls below)
    if (!teamRef || !p.position) continue;
    const counts = rosterCounts.get(teamRef) ?? (rosterCounts.set(teamRef, {}).get(teamRef)!);
    const pos = p.position.toUpperCase();
    counts[pos] = (counts[pos] ?? 0) + 1;
  }
  return { draftedIds, rosterCounts };
}

// ─── Reset ──────────────────────────────────────────────────────────────────────

export function resetSimulatedDraft(platform: string): void {
  const configs = getLeagueConfigs();
  const cfg = configs.find(l => l.platform === platform);
  const draftId = cfg?.draft_id ?? `offline_${platform}`;
  const db = getDb();
  db.run("DELETE FROM draft_picks WHERE draft_id = ? AND platform = ?", [draftId, platform]);
  if (cfg) {
    db.run(
      "DELETE FROM roster_players WHERE platform = ? AND league_id = ? AND season = ?",
      [platform, cfg.league_id, cfg.season]
    );
  }
}

// ─── Roster seeding (shared by both modes) ──────────────────────────────────────

export function seedRostersFromPicks(platform: string): number {
  const { cfg, draftId, myTeam } = loadSetup(platform);
  const picks = getDraftPicks(draftId, platform).filter(p => p.player_id);

  const byTeam = new Map<string, DraftPickRecord[]>();
  for (const p of picks) {
    const teamRef = p.is_my_pick ? myTeam?.team_ref : p.team_name;
    if (!teamRef) continue;
    const arr = byTeam.get(teamRef) ?? [];
    arr.push(p);
    byTeam.set(teamRef, arr);
  }

  const rosterRecords: RosterPlayerRecord[] = [];
  for (const [teamRef, teamPicks] of byTeam) {
    const sorted = [...teamPicks].sort((a, b) => a.pick_no - b.pick_no);
    const filledSlots: string[] = [];
    for (const pick of sorted) {
      const pos = (pick.position ?? "").toUpperCase();
      let isStarter = false;
      const needIdx = STARTER_SLOTS.findIndex((slotPos, i) => {
        if (filledSlots[i]) return false;
        if (slotPos === "FLEX") return pos === "RB" || pos === "WR" || pos === "TE";
        return slotPos === pos || (slotPos === "DEF" && pos === "DST");
      });
      if (needIdx !== -1) {
        filledSlots[needIdx] = pos;
        isStarter = true;
      }
      rosterRecords.push({
        platform, league_id: cfg.league_id, season: cfg.season ?? 2026, week: 1,
        team_ref: teamRef, player_id: pick.player_id!, position: pick.position ?? null, is_starter: isStarter,
      });
    }
  }

  upsertRosterPlayers(rosterRecords);
  return rosterRecords.length;
}

function buildMyRosterView(
  platform: string, leagueId: string, season: number, myTeamRef: string, allPicks: DraftPickRecord[],
): Array<{ name: string; position: string; pick_no: number; is_starter: boolean }> {
  const rosterRows = getRosterPlayers(platform, leagueId, season, 1, myTeamRef);
  const pickByPlayerId = new Map(allPicks.filter(p => p.player_id).map(p => [p.player_id, p]));
  return rosterRows.map(r => {
    const pick = pickByPlayerId.get(r.player_id);
    return { name: pick?.player_name ?? r.player_id, position: r.position ?? "", pick_no: pick?.pick_no ?? 0, is_starter: r.is_starter };
  }).sort((a, b) => a.pick_no - b.pick_no);
}

// ─── Mode 1: fully automated draft ──────────────────────────────────────────────

export interface SimulateResult {
  platform: string;
  picks: number;
  rounds: number;
  rosterRows: number;
  teams: number;
  myTeamRef: string | null;
  myRoster: Array<{ name: string; position: string; pick_no: number; is_starter: boolean }>;
}

export async function simulateDraft(platform: string): Promise<SimulateResult> {
  const { cfg, draftId, myTeam, totalTeams, slotToTeamRef } = loadSetup(platform);
  const existing = getDraftPicks(draftId, platform);
  if (existing.length > 0) {
    throw new Error(`draft_picks already has ${existing.length} rows for ${platform} — call resetSimulatedDraft() first.`);
  }

  const pool = await loadPlayerPool(platform, cfg);
  const draftedIds = new Set<string>();
  const rosterCounts = new Map<string, Record<string, number>>();

  const picks: DraftPickRecord[] = [];
  for (let pickNo = 1; pickNo <= ROUNDS * totalTeams; pickNo++) {
    const { round, slot } = slotForPick(pickNo, totalTeams);
    const teamRef = slotToTeamRef.get(slot)!;
    const player = pickBestAvailable(pool, draftedIds, rosterCounts, teamRef, pickNo, totalTeams);
    if (!player) continue;

    const pick: DraftPickRecord = {
      draft_id: draftId, platform, pick_no: pickNo, round, slot,
      player_id: player.player_id ?? undefined, player_name: player.name, position: player.position,
      team_name: teamRef, is_my_pick: teamRef === myTeam?.team_ref, is_keeper: false,
    };
    saveDraftPick(pick);
    picks.push(pick);
  }

  const rosterRows = seedRostersFromPicks(platform);
  const myRoster = myTeam ? buildMyRosterView(platform, cfg.league_id, cfg.season ?? 2026, myTeam.team_ref, picks) : [];

  return { platform, picks: picks.length, rounds: ROUNDS, rosterRows, teams: slotToTeamRef.size, myTeamRef: myTeam?.team_ref ?? null, myRoster };
}

// ─── Mode 2: live draft — autopick opponents only, stop on my turn ─────────────

export interface AutopickResult {
  picksMade: number;
  draftComplete: boolean;
  nextPickNo: number;
  isMyTurn: boolean;
}

export async function autopickOpponentsUntilMyTurn(platform: string): Promise<AutopickResult> {
  const { cfg, draftId, myTeam, totalTeams, slotToTeamRef } = loadSetup(platform);
  const pool = await loadPlayerPool(platform, cfg);

  const existing = getDraftPicks(draftId, platform);
  const { draftedIds, rosterCounts } = stateFromExistingPicks(existing, myTeam?.team_ref);

  let pickCount = existing.length;
  let picksMade = 0;
  const maxPicks = ROUNDS * totalTeams;

  while (pickCount < maxPicks) {
    const pickNo = pickCount + 1;
    const { round, slot } = slotForPick(pickNo, totalTeams);
    const teamRef = slotToTeamRef.get(slot)!;
    if (teamRef === myTeam?.team_ref) break; // stop right before the human's turn

    const player = pickBestAvailable(pool, draftedIds, rosterCounts, teamRef, pickNo, totalTeams);
    if (!player) break; // pool exhausted under position caps — avoid an infinite loop

    saveDraftPick({
      draft_id: draftId, platform, pick_no: pickNo, round, slot,
      player_id: player.player_id ?? undefined, player_name: player.name, position: player.position,
      team_name: teamRef, is_my_pick: false, is_keeper: false,
    });
    pickCount++;
    picksMade++;
  }

  const draftComplete = pickCount >= maxPicks;
  if (draftComplete) seedRostersFromPicks(platform);

  return { picksMade, draftComplete, nextPickNo: pickCount + 1, isMyTurn: !draftComplete };
}
