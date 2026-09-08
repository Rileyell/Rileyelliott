import type { Context } from "hono";
import {
  getLeagueConfigs, upsertTeam, upsertRosterPlayers, logTransaction,
  getMyTeam, getTeams, getRosterPlayers, getLatestRosterWeek, type LeagueConfig,
} from "../../../backend-lib/db";
import {
  getSleeperRosters, getSleeperUsers, getSleeperNflState, getSleeperTransactions,
  getSleeperUser, getAllSleeperPlayers,
} from "../../../backend-lib/sleeper";
import {
  getEspnLeague, getEspnCurrentWeek, getEspnTransactions, ESPN_POSITION_MAP,
} from "../../../backend-lib/espn";

// ─── POST /api/season/sync ─────────────────────────────────────────────────────
// Syncs teams, weekly roster snapshot, and transactions for every configured
// league (both platforms, one league each per Q1 — see PLAN.md).

export type SeasonSyncResults = Record<string, { ok: boolean; error?: string; teams?: number; week?: number; transactions?: number }>;

// Shared by the POST /api/season/sync route and the auto-sync trigger that
// fires when a real Sleeper draft is detected complete (see draft.ts).
export async function syncAllLeagues(): Promise<SeasonSyncResults> {
  const configs = getLeagueConfigs();
  const results: SeasonSyncResults = {};

  for (const cfg of configs) {
    const key = `${cfg.platform}:${cfg.league_id}`;
    try {
      if (cfg.platform === "sleeper") {
        results[key] = await syncSleeperLeague(cfg);
      } else {
        results[key] = await syncEspnLeague(cfg);
      }
    } catch (err) {
      results[key] = { ok: false, error: String(err) };
    }
  }

  return results;
}

export async function handleSyncSeason(c: Context): Promise<Response> {
  const results = await syncAllLeagues();
  return c.json({ results });
}

async function syncSleeperLeague(cfg: LeagueConfig) {
  const [rosters, users, nflState, players] = await Promise.all([
    getSleeperRosters(cfg.league_id),
    getSleeperUsers(cfg.league_id),
    getSleeperNflState(),
    getAllSleeperPlayers(),
  ]);

  let myUserId: string | null = null;
  const _sj = cfg.settings_json as { user_id?: string; username?: string };
  if (_sj.user_id) {
    myUserId = _sj.user_id;
  } else if (_sj.username) {
    try {
      const me = await getSleeperUser(_sj.username);
      myUserId = me.user_id;
    } catch { /* non-critical; is_my_team will be false */ }
  }

  const usersByOwnerId = new Map(users.map(u => [u.user_id, u]));
  const week = nflState.week;
  const rosterRecords = [];

  for (const roster of rosters) {
    const owner = roster.owner_id ? usersByOwnerId.get(roster.owner_id) : undefined;
    upsertTeam({
      platform: "sleeper",
      league_id: cfg.league_id,
      season: cfg.season,
      team_ref: String(roster.roster_id),
      owner_name: owner?.display_name ?? null,
      team_name: owner?.display_name ?? null,
      is_my_team: !!myUserId && roster.owner_id === myUserId,
      wins: roster.settings?.wins ?? 0,
      losses: roster.settings?.losses ?? 0,
      ties: roster.settings?.ties ?? 0,
      points_for: roster.settings?.fpts ?? 0,
      points_against: 0,
    });

    for (const playerId of roster.players ?? []) {
      rosterRecords.push({
        platform: "sleeper",
        league_id: cfg.league_id,
        season: cfg.season,
        week,
        team_ref: String(roster.roster_id),
        player_id: playerId,
        position: players[playerId]?.position ?? null,
        is_starter: (roster.starters ?? []).includes(playerId),
      });
    }
  }
  upsertRosterPlayers(rosterRecords);

  let txCount = 0;
  try {
    const txs = await getSleeperTransactions(cfg.league_id, week);
    for (const tx of txs) {
      logTransaction({
        platform: "sleeper",
        league_id: cfg.league_id,
        season: cfg.season,
        transaction_id: tx.transaction_id,
        week,
        type: tx.type,
        team_refs: (tx.roster_ids ?? []).map(String),
        adds: Object.fromEntries(Object.entries(tx.adds ?? {}).map(([pid, rid]) => [pid, String(rid)])),
        drops: Object.fromEntries(Object.entries(tx.drops ?? {}).map(([pid, rid]) => [pid, String(rid)])),
        created_at: tx.created ?? null,
      });
      txCount++;
    }
  } catch { /* non-critical — transactions endpoint failure shouldn't block sync */ }

  return { ok: true, teams: rosters.length, week, transactions: txCount };
}

async function syncEspnLeague(cfg: LeagueConfig) {
  const sj = cfg.settings_json as { espn_s2?: string; swid?: string; my_team_id?: number };
  const espnS2 = sj.espn_s2 ?? process.env.ESPN_S2;
  const swid = sj.swid ?? process.env.ESPN_SWID;
  if (!espnS2 || !swid) {
    throw new Error("ESPN credentials not found — re-connect your ESPN league from Setup.");
  }
  const creds = { espnS2, swid };
  const league = await getEspnLeague(cfg.league_id, undefined, creds);
  const myTeamId = sj.my_team_id ?? null;
  const week = getEspnCurrentWeek(league);
  const rosterRecords = [];

  for (const team of league.teams ?? []) {
    const isMyTeam = myTeamId != null ? team.id === myTeamId : (team.owners ?? []).includes(swid);
    upsertTeam({
      platform: "espn",
      league_id: cfg.league_id,
      season: cfg.season,
      team_ref: String(team.id),
      owner_name: league.members?.find(m => team.owners?.includes(m.id))?.displayName ?? null,
      team_name: team.name ?? null,
      is_my_team: isMyTeam,
      wins: team.record?.overall?.wins ?? 0,
      losses: team.record?.overall?.losses ?? 0,
      ties: team.record?.overall?.ties ?? 0,
      points_for: team.record?.overall?.pointsFor ?? 0,
      points_against: team.record?.overall?.pointsAgainst ?? 0,
    });

    for (const entry of team.roster?.entries ?? []) {
      const player = entry.playerPoolEntry?.player;
      rosterRecords.push({
        platform: "espn",
        league_id: cfg.league_id,
        season: cfg.season,
        week,
        team_ref: String(team.id),
        player_id: String(entry.playerId),
        position: player ? (ESPN_POSITION_MAP[player.defaultPositionId] ?? null) : null,
        is_starter: entry.lineupSlotId !== 20 && entry.lineupSlotId !== 21, // 20=BENCH, 21=IR
      });
    }
  }
  upsertRosterPlayers(rosterRecords);

  let txCount = 0;
  try {
    const txs = await getEspnTransactions(cfg.league_id, undefined, creds);
    for (const tx of txs) {
      const adds: Record<string, string> = {};
      const drops: Record<string, string> = {};
      const teamRefs = new Set<string>();
      for (const item of tx.items ?? []) {
        teamRefs.add(String(item.toTeamId));
        teamRefs.add(String(item.fromTeamId));
        if (item.type === "ADD") adds[String(item.playerId)] = String(item.toTeamId);
        if (item.type === "DROP") drops[String(item.playerId)] = String(item.fromTeamId);
      }
      logTransaction({
        platform: "espn",
        league_id: cfg.league_id,
        season: cfg.season,
        transaction_id: tx.id,
        week: tx.scoringPeriodId ?? week,
        type: tx.type,
        team_refs: Array.from(teamRefs).filter(r => r !== "0"),
        adds,
        drops,
        created_at: tx.proposedDate ?? null,
      });
      txCount++;
    }
  } catch { /* non-critical */ }

  return { ok: true, teams: (league.teams ?? []).length, week, transactions: txCount };
}

// ─── GET /api/season/team/:platform ────────────────────────────────────────────

export async function handleGetMyTeam(c: Context): Promise<Response> {
  const platform = c.req.param("platform");
  if (platform !== "sleeper" && platform !== "espn") {
    return c.json({ error: "platform must be 'sleeper' or 'espn'" }, 400);
  }
  const cfg = getLeagueConfigs().find(l => l.platform === platform);
  if (!cfg) return c.json({ error: `No ${platform} league configured` }, 404);

  const myTeam = getMyTeam(cfg.platform, cfg.league_id, cfg.season);
  if (!myTeam) return c.json({ error: "My team not resolved yet — run /api/season/sync first" }, 404);

  const allTeams = getTeams(cfg.platform, cfg.league_id, cfg.season);
  const latestWeek = getLatestRosterWeek(cfg.platform, cfg.league_id, cfg.season) ?? 1;
  const rosterRows = getRosterPlayers(cfg.platform, cfg.league_id, cfg.season, latestWeek, myTeam.team_ref);

  return c.json({
    league: { platform: cfg.platform, league_id: cfg.league_id, league_name: cfg.league_name },
    week: latestWeek,
    team: myTeam,
    roster: rosterRows,
    all_teams: allTeams,
  });
}
