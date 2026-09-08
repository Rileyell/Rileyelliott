import { cacheGet, cacheSet } from "./db";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EspnLeague {
  id: number;
  seasonId: number;
  scoringPeriodId: number;
  status: {
    currentMatchupPeriod: number;
    isActive: boolean;
    latestScoringPeriod: number;
    standingsUpdateDate: number;
    teamsJoined: number;
    waiverLastExecutionDate: number;
    waiversProcessed: number;
  };
  settings: {
    name: string;
    size: number;
    isPublic: boolean;
    draftSettings: {
      date: string;
      type: string; // "SNAKE" | "AUCTION"
      pickOrder: number[];
      isTradingEnabled: boolean;
      timePerSelection: number;
      keeperCount: number;
    };
    scoringSettings: {
      scoringType: string; // "STANDARD" | "PPR" | "HALF_PPR"
    };
    rosterSettings: {
      lineupSlotCounts: Record<string, number>;
      positionLimits: Record<string, number>;
    };
    scheduleSettings: {
      numberOfPlayoffTeams: number;
    };
  };
  teams: EspnTeam[];
  members: EspnMember[];
  draftDetail?: {
    picks: EspnDraftPick[];
    drafted: boolean;
    inProgress: boolean;
  };
}

export interface EspnRosterEntry {
  playerId: number;
  lineupSlotId: number;
  playerPoolEntry: {
    player: {
      id: number;
      fullName: string;
      defaultPositionId: number;
      injuryStatus?: string;
    };
  };
}

export interface EspnTeam {
  id: number;
  abbrev: string;
  location: string;
  nickname: string;
  name: string;
  primaryOwner: string;
  owners: string[];
  record: {
    overall: { wins: number; losses: number; ties: number; pointsFor: number; pointsAgainst: number };
  };
  draftDayProjectedRank: number;
  currentProjectedRank: number;
  playoffSeed: number;
  waiverRank: number;
  logo: string;
  logoType: string;
  roster?: { entries: EspnRosterEntry[] };
}

export interface EspnMember {
  id: string; // SWID-style "{GUID}"
  displayName: string;
  firstName: string;
  lastName: string;
  isLeagueManager: boolean;
}

export interface EspnPlayer {
  id: number;
  onTeamId: number;
  defaultPositionId: number;
  eligibleSlots: number[];
  firstName: string;
  lastName: string;
  fullName: string;
  proTeamId: number;
  universeId: number;
  ownership: {
    averageDraftPosition: number;
    averageDraftPositionPercentChange: number;
    date: number;
    leagueType: number;
    percentChange: number;
    percentOwned: number;
    percentStarted: number;
  };
  stats?: EspnPlayerStats[];
  ratings?: Record<string, { positionalRanking: number; totalRanking: number; totalRating: number }>;
}

export interface EspnPlayerStats {
  externalId: string;
  id: string;
  proTeamId: number;
  scoringPeriodId: number;
  seasonId: number;
  statSourceId: number;
  statSplitTypeId: number;
  stats: Record<string, number>;
  appliedTotal?: number;
}

export interface EspnDraftPick {
  autoDraftTypeId: number;
  bidAmount: number;
  id: number;
  keeper: boolean;
  lineupSlotId: number;
  memberId: string;
  nominatingTeamId: number;
  overallPickNumber: number;
  playerId: number;
  reservedForKeeper: boolean;
  roundId: number;
  roundPickNumber: number;
  teamId: number;
  tradeLocked: boolean;
}

// Position ID → name mapping
export const ESPN_POSITION_MAP: Record<number, string> = {
  1: "QB", 2: "RB", 3: "WR", 4: "TE", 5: "K", 16: "DST",
};

export const ESPN_SLOT_MAP: Record<number, string> = {
  0: "QB", 2: "RB", 4: "WR", 6: "TE", 16: "DST", 17: "K",
  20: "BENCH", 21: "IR", 23: "FLEX",
};

// Converts ESPN's lineupSlotCounts (keyed by numeric slot ID) into a flat
// roster_positions array in the same vocabulary Sleeper's native format
// uses (e.g. ["QB","RB","RB","WR","WR","TE","FLEX","K","DST","BN","BN"]) —
// so downstream roster-slot logic (backend-lib/roster-slots.ts) can treat
// both platforms identically without platform-specific branching.
export function espnLineupSlotsToPositions(lineupSlotCounts: Record<string, number> | undefined): string[] {
  if (!lineupSlotCounts) return [];
  const positions: string[] = [];
  for (const [slotId, count] of Object.entries(lineupSlotCounts)) {
    const label = ESPN_SLOT_MAP[Number(slotId)];
    if (!label || count <= 0) continue;
    const normalized = label === "BENCH" ? "BN" : label;
    for (let i = 0; i < count; i++) positions.push(normalized);
  }
  return positions;
}

// ─── Auth helpers ─────────────────────────────────────────────────────────────

export interface EspnCreds { espnS2: string; swid: string }

// Shared resolver for cfg.settings_json (falls back to env vars) — used by
// any handler that needs to make an authenticated ESPN call.
export function credsFromSettings(settings: unknown): EspnCreds | null {
  const sj = (settings ?? {}) as { espn_s2?: string; swid?: string };
  const espnS2 = sj.espn_s2 ?? process.env.ESPN_S2;
  const swid = sj.swid ?? process.env.ESPN_SWID;
  if (!espnS2 || !swid) return null;
  return { espnS2, swid };
}

function getEspnHeaders(creds?: EspnCreds): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    "x-fantasy-source": "kona",
    "x-fantasy-platform": "kona-PROD-m.fantasy.espn.com-rapid-android-public",
  };
  if (creds?.espnS2 && creds?.swid) {
    headers["Cookie"] = `espn_s2=${creds.espnS2}; SWID=${creds.swid}`;
  }
  return headers;
}

// ─── API base ─────────────────────────────────────────────────────────────────

const ESPN_BASE = "https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl";

async function espnFetch<T>(path: string, params: Record<string, string> = {}, ttlSeconds = 120, creds?: EspnCreds): Promise<T> {
  // ESPN's API requires each `view` as its own repeated query param
  // (?view=mRoster&view=mDraftDetail) — a single comma-joined value is
  // silently ignored, so callers passing "mRoster,mDraftDetail,mTeam" would
  // get back a response missing draftDetail/roster entirely with no error.
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === "view") {
      for (const v of value.split(",")) search.append("view", v);
    } else {
      search.append(key, value);
    }
  }
  const queryString = search.toString();
  const fullPath = queryString ? `${path}?${queryString}` : path;
  const cacheKey = `espn:${fullPath}`;
  const cached = cacheGet(cacheKey);
  if (cached) return JSON.parse(cached) as T;

  const url = `${ESPN_BASE}${fullPath}`;
  const res = await fetch(url, { headers: getEspnHeaders(creds) });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`ESPN API ${fullPath}: ${res.status} — ${body.slice(0, 200)}`);
  }
  const data = await res.json() as T;
  if (ttlSeconds > 0) cacheSet(cacheKey, JSON.stringify(data), ttlSeconds);
  return data;
}

// ─── League ───────────────────────────────────────────────────────────────────

export async function getEspnLeague(
  leagueId: number | string, seasonId = 2026, creds?: EspnCreds
): Promise<EspnLeague> {
  if (!creds?.espnS2 || !creds?.swid) throw new Error("ESPN credentials (espn_s2 + swid) are required");
  return espnFetch<EspnLeague>(
    `/seasons/${seasonId}/segments/0/leagues/${leagueId}`,
    { view: "mTeam,mRoster,mSettings,mDraftDetail" },
    300,
    creds
  );
}

// Live draft sync: picks + completion flags + roster entries (for player
// name/position lookup, since draftDetail.picks only carries a numeric
// playerId). Short TTL keeps pace with the app's 3s client-side poll while
// still sparing ESPN's API from a request on every single tick.
export interface EspnDraftSync {
  picks: EspnDraftPick[];
  drafted: boolean;
  inProgress: boolean;
  teams: EspnTeam[];
}

export async function getEspnDraftSync(
  leagueId: number | string, seasonId = 2026, creds?: EspnCreds
): Promise<EspnDraftSync> {
  if (!creds?.espnS2 || !creds?.swid) throw new Error("ESPN credentials required");
  const league = await espnFetch<EspnLeague>(
    `/seasons/${seasonId}/segments/0/leagues/${leagueId}`,
    { view: "mRoster,mDraftDetail,mTeam" },
    15,
    creds
  );
  return {
    picks: league.draftDetail?.picks ?? [],
    drafted: league.draftDetail?.drafted ?? false,
    inProgress: league.draftDetail?.inProgress ?? false,
    teams: league.teams ?? [],
  };
}

export async function getEspnLeagueMembers(
  leagueId: number | string, seasonId = 2026, creds?: EspnCreds
): Promise<{ teams: EspnTeam[]; members: EspnMember[] }> {
  if (!creds?.espnS2 || !creds?.swid) throw new Error("ESPN credentials required");
  const league = await espnFetch<EspnLeague>(
    `/seasons/${seasonId}/segments/0/leagues/${leagueId}`,
    { view: "mTeam,mSettings" },
    300,
    creds
  );
  return { teams: league.teams ?? [], members: league.members ?? [] };
}

// ─── Current week ─────────────────────────────────────────────────────────────

export function getEspnCurrentWeek(league: EspnLeague): number {
  return league.status?.currentMatchupPeriod ?? league.scoringPeriodId ?? 1;
}

// ─── Transactions ─────────────────────────────────────────────────────────────

export interface EspnTransaction {
  id: string;
  type: string; // "WAIVER" | "FREEAGENT" | "TRADE" | ...
  status: string;
  scoringPeriodId: number;
  proposedDate: number;
  teamId?: number;
  items: Array<{ playerId: number; type: string; fromTeamId: number; toTeamId: number }>;
}

// ESPN returns a zero-length response body (not an error) when a league has no
// transactions yet — e.g. before the draft. espnFetch's res.json() would throw
// on that, so this fetcher parses manually and treats empty as [].
export async function getEspnTransactions(
  leagueId: number | string, seasonId = 2026, creds?: EspnCreds
): Promise<EspnTransaction[]> {
  if (!creds?.espnS2 || !creds?.swid) throw new Error("ESPN credentials required");
  const path = `/seasons/${seasonId}/segments/0/leagues/${leagueId}/transactions`;
  const cacheKey = `espn:${path}:mTransactions2`;
  const cached = cacheGet(cacheKey);
  if (cached) return JSON.parse(cached) as EspnTransaction[];

  const res = await fetch(`${ESPN_BASE}${path}?view=mTransactions2`, { headers: getEspnHeaders(creds) });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`ESPN transactions ${leagueId}: ${res.status} — ${body.slice(0, 200)}`);
  }
  const text = await res.text();
  const data: EspnTransaction[] = text.trim() ? (JSON.parse(text) as EspnTransaction[]) : [];
  cacheSet(cacheKey, JSON.stringify(data), 120);
  return data;
}

// ─── Players ──────────────────────────────────────────────────────────────────

export async function getEspnPlayers(
  seasonId = 2026, limit = 1000, creds?: EspnCreds
): Promise<EspnPlayer[]> {
  const cacheKey = `espn:players:${seasonId}:${limit}`;
  const cached = cacheGet(cacheKey);
  if (cached) return JSON.parse(cached) as EspnPlayer[];

  const filterHeader = JSON.stringify({
    players: {
      filterSlotIds: { value: [0, 2, 4, 6, 16, 17, 23] },
      filterStatsForCurrentSeasonScoringPeriodId: { value: [0] },
      sortPercOwned: { sortAsc: false, sortPriority: 1 },
      limit,
      offset: 0,
      filterRanksForScoringPeriodIds: { value: [0] },
      filterRanksForRankTypes: { value: ["PPR"] },
      filterStatsForTopScoringPeriodIds: { value: 2, additionalValue: ["00" + seasonId, "10" + seasonId] },
    },
  });

  const url = `${ESPN_BASE}/seasons/${seasonId}/players?scoringPeriodId=0&view=players_wl`;
  const res = await fetch(url, {
    headers: {
      ...getEspnHeaders(creds),
      "x-fantasy-filter": filterHeader,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`ESPN players ${seasonId}: ${res.status} — ${body.slice(0, 200)}`);
  }
  const data = await res.json() as EspnPlayer[];
  cacheSet(cacheKey, JSON.stringify(data), 3600);
  return data;
}

// ─── Detection ────────────────────────────────────────────────────────────────

export function detectEspnScoring(settings: EspnLeague["settings"]): "ppr" | "half-ppr" | "standard" {
  const type = settings.scoringSettings?.scoringType?.toUpperCase() ?? "";
  if (type.includes("PPR") && !type.includes("HALF")) return "ppr";
  if (type.includes("HALF")) return "half-ppr";
  return "standard";
}

export function getEspnMyTeamId(league: EspnLeague, swid: string): number | null {
  const member = league.members?.find(m => m.id === swid);
  if (!member) return null;
  const team = league.teams?.find(t => t.owners?.includes(swid));
  return team?.id ?? null;
}

export function getEspnMyDraftPickSlot(
  league: EspnLeague, swid: string
): number | null {
  const order = league.settings?.draftSettings?.pickOrder;
  if (!order) return null;
  const myTeamId = getEspnMyTeamId(league, swid);
  if (!myTeamId) return null;
  const idx = order.indexOf(myTeamId);
  return idx === -1 ? null : idx + 1;
}
