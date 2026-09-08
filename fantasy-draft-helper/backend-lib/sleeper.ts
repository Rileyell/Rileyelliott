import { cacheGet, cacheSet } from "./db";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SleeperLeague {
  league_id: string;
  name: string;
  status: string; // "pre_draft" | "drafting" | "in_season" | "complete"
  season: string;
  season_type: string;
  total_rosters: number;
  roster_positions: string[];
  draft_id: string;
  scoring_settings: Record<string, number>;
  settings: {
    max_keepers: number;
    draft_rounds: number;
    trade_deadline: number;
    num_teams: number;
    playoff_teams: number;
    [key: string]: number;
  };
  previous_league_id: string | null;
  avatar: string | null;
}

export interface SleeperRoster {
  roster_id: number;
  owner_id: string | null;
  co_owners: string[] | null;
  league_id: string;
  players: string[];
  reserve: string[];
  starters: string[];
  taxi: string[] | null;
  metadata: { streak?: string; record?: string } | null;
  settings: {
    wins: number; losses: number; ties: number; fpts: number; fpts_decimal: number;
  };
}

export interface SleeperUser {
  user_id: string;
  username: string;
  display_name: string;
  avatar: string | null;
}

export interface SleeperPlayer {
  player_id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  position: string | null;
  fantasy_positions: string[] | null;
  team: string | null;
  age: number | null;
  years_exp: number | null;
  status: string | null; // "Active" | "Injured Reserve" | "PUP" etc.
  injury_status: string | null; // "Questionable" | "Out" | "Doubtful" | "IR" | "PUP"
  injury_body_part: string | null;
  injury_notes: string | null;
  search_rank: number | null;
  depth_chart_position: string | null;
  depth_chart_order: number | null;
  college: string | null;
  number: number | null;
  height: string | null;
  weight: string | null;
  birth_date: string | null;
  sportradar_id: string | null;
  espn_id: number | null;
  // Optional — filled in at runtime
  _adp?: number | null;
  _ecr?: number | null;
  _tier?: number | null;
}

export interface SleeperDraft {
  draft_id: string;
  league_id: string;
  type: "snake" | "auction" | "linear";
  status: "pre_draft" | "drafting" | "paused" | "complete";
  season: string;
  season_type: string;
  created: number;
  last_message_time: number;
  last_picked: number;
  start_time: number;
  sport: string;
  settings: {
    teams: number;
    rounds: number;
    pick_timer: number;
    nomination_timer: number;
    slots_qb: number; slots_rb: number; slots_wr: number; slots_te: number;
    slots_flex: number; slots_k: number; slots_def: number; slots_bn: number;
    reversal_round: number; cpu_autopick: number; player_type: number;
    enforce_position_limits: number; alpha_sort: number;
  };
  draft_order: Record<string, number> | null; // user_id → slot
  slot_to_roster_id: Record<string, number>;
  metadata: { scoring_type?: string; name?: string } | null;
}

export interface SleeperDraftPick {
  draft_id: string;
  player_id: string;
  picked_by: string; // user_id
  roster_id: number;
  round: number;
  draft_slot: number;
  pick_no: number;
  metadata: {
    player_id: string;
    position: string;
    team: string;
    first_name: string;
    last_name: string;
    years_exp: string;
    slot_name?: string;
    status?: string;
    injury_status?: string;
    sport: string;
    number: string;
    amount?: string;
  };
  is_keeper: boolean | null;
  player_type: number;
  reactions: unknown[];
}

export interface SleeperTransaction {
  transaction_id: string;
  type: "trade" | "free_agent" | "waiver";
  status: "complete" | "failed";
  created: number;
  adds: Record<string, number> | null; // player_id → roster_id
  drops: Record<string, number> | null;
  roster_ids: number[];
  settings: Record<string, unknown> | null;
  metadata: Record<string, string> | null;
  leg: number;
}

// ─── Scoring detection ────────────────────────────────────────────────────────

export function detectSleeperScoring(league: SleeperLeague): "ppr" | "half-ppr" | "standard" {
  const rec = league.scoring_settings?.rec ?? 0;
  if (rec >= 1) return "ppr";
  if (rec >= 0.4) return "half-ppr";
  return "standard";
}

// ─── HTTP helper ──────────────────────────────────────────────────────────────

const SLEEPER_BASE = "https://api.sleeper.app/v1";

async function sleeperFetch<T>(path: string, ttlSeconds = 120): Promise<T> {
  const cacheKey = `sleeper:${path}`;
  const cached = cacheGet(cacheKey);
  if (cached) return JSON.parse(cached) as T;

  const res = await fetch(`${SLEEPER_BASE}${path}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Sleeper API ${path}: ${res.status} — ${body.slice(0, 200)}`);
  }
  const data = await res.json() as T;
  if (ttlSeconds > 0) cacheSet(cacheKey, JSON.stringify(data), ttlSeconds);
  return data;
}

// ─── User ─────────────────────────────────────────────────────────────────────

export async function getSleeperUser(username: string): Promise<SleeperUser> {
  return sleeperFetch<SleeperUser>(`/user/${username}`, 3600);
}

// ─── NFL state (current week) ──────────────────────────────────────────────────

export interface SleeperNflState {
  week: number;
  season: string;
  season_type: string; // "pre" | "regular" | "post"
  display_week: number;
}

export async function getSleeperNflState(): Promise<SleeperNflState> {
  return sleeperFetch<SleeperNflState>(`/state/nfl`, 3600);
}

// ─── Weekly projections (fallback source when FantasyPros has no line) ────────
// Undocumented but stable/widely-used endpoint — lives on a different host
// path than the rest of the v1 API, so it doesn't go through sleeperFetch.

const SLEEPER_PROJECTIONS_POSITIONS = ["QB", "RB", "WR", "TE", "K", "DEF"];

export interface SleeperProjectionStats {
  pts_ppr?: number;
  pts_half_ppr?: number;
  pts_std?: number;
}

// player_id -> projected stat lines for the given week.
export async function getSleeperWeekProjections(
  season: number, week: number
): Promise<Map<string, SleeperProjectionStats>> {
  const cacheKey = `sleeper:proj:${season}:${week}`;
  const cached = cacheGet(cacheKey);
  if (cached) return new Map(JSON.parse(cached) as [string, SleeperProjectionStats][]);

  const qs = SLEEPER_PROJECTIONS_POSITIONS.map(p => `position[]=${p}`).join("&");
  const url = `https://api.sleeper.app/projections/nfl/${season}/${week}?season_type=regular&${qs}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Sleeper projections ${season}/${week}: ${res.status}`);
  const rows = await res.json() as Array<{ player_id: string; stats?: SleeperProjectionStats }>;

  const entries: [string, SleeperProjectionStats][] = rows
    .filter(r => r.player_id && r.stats)
    .map(r => [r.player_id, r.stats!]);
  cacheSet(cacheKey, JSON.stringify(entries), 1800);
  return new Map(entries);
}

// ─── Leagues ─────────────────────────────────────────────────────────────────

export async function getSleeperLeagues(userId: string, season = 2026): Promise<SleeperLeague[]> {
  return sleeperFetch<SleeperLeague[]>(`/user/${userId}/leagues/nfl/${season}`, 300);
}

export async function getSleeperLeague(leagueId: string): Promise<SleeperLeague> {
  return sleeperFetch<SleeperLeague>(`/league/${leagueId}`, 300);
}

// ─── Rosters ─────────────────────────────────────────────────────────────────

export async function getSleeperRosters(leagueId: string): Promise<SleeperRoster[]> {
  return sleeperFetch<SleeperRoster[]>(`/league/${leagueId}/rosters`, 120);
}

export async function getSleeperUsers(leagueId: string): Promise<SleeperUser[]> {
  return sleeperFetch<SleeperUser[]>(`/league/${leagueId}/users`, 300);
}

// ─── Draft ────────────────────────────────────────────────────────────────────

export async function getSleeperDraft(draftId: string): Promise<SleeperDraft> {
  return sleeperFetch<SleeperDraft>(`/draft/${draftId}`, 60);
}

export async function getSleeperDraftPicks(draftId: string): Promise<SleeperDraftPick[]> {
  return sleeperFetch<SleeperDraftPick[]>(`/draft/${draftId}/picks`, 30);
}

export async function getSleeperTradedPicks(draftId: string): Promise<unknown[]> {
  return sleeperFetch<unknown[]>(`/draft/${draftId}/traded_picks`, 300);
}

// ─── Players (large — cached for 24h) ────────────────────────────────────────

let _playerCache: Record<string, SleeperPlayer> | null = null;

export async function getAllSleeperPlayers(): Promise<Record<string, SleeperPlayer>> {
  if (_playerCache) return _playerCache;

  const cacheKey = "sleeper:/players/nfl";
  const cached = cacheGet(cacheKey);
  if (cached) {
    _playerCache = JSON.parse(cached) as Record<string, SleeperPlayer>;
    return _playerCache;
  }

  const res = await fetch(`${SLEEPER_BASE}/players/nfl`);
  if (!res.ok) throw new Error(`Sleeper /players/nfl: ${res.status}`);
  const data = await res.json() as Record<string, SleeperPlayer>;
  // Add player_id field to each record for convenience
  for (const [id, p] of Object.entries(data)) {
    p.player_id = id;
  }
  cacheSet(cacheKey, JSON.stringify(data), 86400);
  _playerCache = data;
  return data;
}

export async function getTrendingPlayers(
  type: "add" | "drop" = "add",
  limit = 25,
  lookbackHours = 24
): Promise<Array<{ player_id: string; count: number }>> {
  const cacheKey = `sleeper:trending:${type}:${lookbackHours}:${limit}`;
  const cached = cacheGet(cacheKey);
  if (cached) return JSON.parse(cached);

  const res = await fetch(
    `${SLEEPER_BASE}/players/nfl/trending/${type}?lookback_hours=${lookbackHours}&limit=${limit}`
  );
  if (!res.ok) return [];
  const data = await res.json() as Array<{ player_id: string; count: number }>;
  cacheSet(cacheKey, JSON.stringify(data), 3600);
  return data;
}

// ─── Transactions ─────────────────────────────────────────────────────────────

export async function getSleeperTransactions(
  leagueId: string, week = 1
): Promise<SleeperTransaction[]> {
  return sleeperFetch<SleeperTransaction[]>(`/league/${leagueId}/transactions/${week}`, 120);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function sleeperDraftPickNumber(round: number, slot: number, totalTeams: number, reversal = true): number {
  if (reversal && round % 2 === 0) {
    return (round - 1) * totalTeams + (totalTeams - slot + 1);
  }
  return (round - 1) * totalTeams + slot;
}

export function sleeperPickToRoundSlot(pickNo: number, totalTeams: number): { round: number; slot: number } {
  const round = Math.ceil(pickNo / totalTeams);
  const slot = pickNo - (round - 1) * totalTeams;
  return { round, slot };
}

export function getSleeperMyRosterIdByUserId(
  rosters: SleeperRoster[], userId: string
): number | null {
  return rosters.find(r => r.owner_id === userId)?.roster_id ?? null;
}

export function getSleeperMyDraftSlot(
  draft: SleeperDraft, userId: string
): number | null {
  if (!draft.draft_order) return null;
  return draft.draft_order[userId] ?? null;
}
