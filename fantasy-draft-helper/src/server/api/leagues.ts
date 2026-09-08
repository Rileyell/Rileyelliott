import type { Context } from "hono";
import {
  getLeagueConfigs, upsertLeagueConfig,
} from "../../../backend-lib/db";
import {
  getSleeperLeague, getSleeperLeagues,
  getSleeperDraft, getSleeperUser, detectSleeperScoring,
  getSleeperMyDraftSlot,
} from "../../../backend-lib/sleeper";
import {
  getEspnLeague, detectEspnScoring, getEspnMyDraftPickSlot, getEspnMyTeamId, espnLineupSlotsToPositions,
} from "../../../backend-lib/espn";

const CURRENT_SEASON = 2026;

// ─── GET /api/leagues ─────────────────────────────────────────────────────────

export async function handleGetLeagues(c: Context): Promise<Response> {
  const configs = getLeagueConfigs();
  return c.json({ leagues: configs });
}

// ─── POST /api/leagues/sync ───────────────────────────────────────────────────
// Body: one of:
//   { platform: "sleeper", username: string }       — syncs all leagues for user
//   { platform: "espn", league_id: string, espn_s2: string, swid: string }

export async function handleSyncLeagues(c: Context): Promise<Response> {
  const body = await c.req.json().catch(() => ({})) as Record<string, string>;
  const platform = body.platform as "sleeper" | "espn" | undefined;

  if (!platform) return c.json({ error: "platform is required" }, 400);

  const results: Record<string, { ok: boolean; seeded?: number; error?: string; leagues?: unknown[] }> = {};

  // ── Sleeper ─────────────────────────────────────────────────────────────────
  if (platform === "sleeper") {
    const username = body.username?.trim();
    if (!username) return c.json({ error: "username is required for Sleeper" }, 400);

    try {
      const user = await getSleeperUser(username);
      const userId = user.user_id;
      const leagues = await getSleeperLeagues(userId, CURRENT_SEASON);

      if (!leagues.length) {
        return c.json({ ok: false, error: `No leagues found for ${username} in ${CURRENT_SEASON}` }, 404);
      }

      let seeded = 0;
      const leagueDetails: unknown[] = [];

      for (const league of leagues) {
        const scoring = detectSleeperScoring(league);
        let mySlot: number | null = null;

        if (league.draft_id) {
          try {
            const draft = await getSleeperDraft(league.draft_id);
            mySlot = getSleeperMyDraftSlot(draft, userId);
          } catch { /* non-critical */ }
        }

        upsertLeagueConfig({
          platform: "sleeper",
          league_id: league.league_id,
          league_name: league.name,
          season: parseInt(league.season),
          scoring_type: scoring,
          total_teams: league.total_rosters,
          roster_positions: league.roster_positions,
          draft_id: league.draft_id ?? null,
          my_pick_slot: mySlot,
          settings_json: {
            draft_rounds: league.settings?.draft_rounds ?? 15,
            max_keepers: league.settings?.max_keepers ?? 0,
            status: league.status,
            username,
            user_id: userId,
          },
        });

        seeded++;
        leagueDetails.push({ name: league.name, status: league.status, draft_id: league.draft_id, scoring, my_slot: mySlot });
      }

      results.sleeper = { ok: true, seeded, leagues: leagueDetails };
    } catch (err) {
      results.sleeper = { ok: false, error: String(err) };
    }
  }

  // ── ESPN ─────────────────────────────────────────────────────────────────────
  if (platform === "espn") {
    const leagueId = body.league_id?.trim();
    const espnS2 = body.espn_s2?.trim();
    const swid = body.swid?.trim();

    if (!leagueId) return c.json({ error: "league_id is required for ESPN" }, 400);
    if (!espnS2 || !swid) return c.json({ error: "espn_s2 and swid are required for ESPN" }, 400);

    try {
      const creds = { espnS2, swid };
      const league = await getEspnLeague(leagueId, CURRENT_SEASON, creds);
      const scoring = detectEspnScoring(league.settings);
      const myTeamId = getEspnMyTeamId(league, swid);
      const mySlot = getEspnMyDraftPickSlot(league, swid);
      const draftId = `espn_${leagueId}_${CURRENT_SEASON}`;

      upsertLeagueConfig({
        platform: "espn",
        league_id: leagueId,
        league_name: league.settings?.name ?? "ESPN League",
        season: CURRENT_SEASON,
        scoring_type: scoring,
        total_teams: league.settings?.size ?? 12,
        roster_positions: espnLineupSlotsToPositions(league.settings?.rosterSettings?.lineupSlotCounts),
        draft_id: draftId,
        my_pick_slot: mySlot,
        settings_json: {
          draft_type: league.settings?.draftSettings?.type,
          draft_date: league.settings?.draftSettings?.date,
          my_team_id: myTeamId,
          status: league.status?.isActive ? "active" : "inactive",
          espn_s2: espnS2,
          swid,
        },
      });

      results.espn = {
        ok: true,
        seeded: 1,
        leagues: [{ name: league.settings?.name, scoring, size: league.settings?.size, draft_type: league.settings?.draftSettings?.type, my_slot: mySlot }],
      };
    } catch (err) {
      results.espn = { ok: false, error: String(err) };
    }
  }

  const anyOk = Object.values(results).some(r => r.ok);
  const totalSeeded = Object.values(results).reduce((sum, r) => sum + (r.seeded ?? 0), 0);
  return c.json({ ok: anyOk, seeded: totalSeeded, results });
}

// ─── POST /api/leagues/demo ───────────────────────────────────────────────────
// Seeds a fake 12-team PPR league so visitors can explore without credentials.

export async function handleDemoSeed(c: Context): Promise<Response> {
  try {
    const {
      upsertLeagueConfig, getLeagueConfigs, getDraftPicks, upsertTeam,
    } = await import("../../../backend-lib/db");
    const DEMO_LEAGUE_ID = "demo_league_2026";
    const DEMO_DRAFT_ID  = "demo_draft_2026";
    const SEASON = 2026;

    upsertLeagueConfig({
      platform: "sleeper",
      league_id: DEMO_LEAGUE_ID,
      league_name: "Demo League",
      season: SEASON,
      scoring_type: "ppr",
      total_teams: 12,
      roster_positions: ["QB","RB","RB","WR","WR","TE","FLEX","FLEX","K","DEF","BN","BN","BN","BN","BN"],
      draft_id: DEMO_DRAFT_ID,
      my_pick_slot: 6,
      settings_json: { draft_rounds: 15, demo: true },
    });

    // Seed 12 placeholder teams so loadSetup() doesn't throw during simulate/live-draft
    const TEAM_NAMES = [
      "Gridiron Ghosts", "Blitz Brigade", "Red Zone Rockets", "Turf Titans",
      "Hail Mary Heroes", "Your Team", "End Zone Elite", "Pocket Protectors",
      "Sack Pack", "Double Coverage", "Penalty Box", "Fourth & Long",
    ];
    for (let slot = 1; slot <= 12; slot++) {
      upsertTeam({
        platform: "sleeper",
        league_id: DEMO_LEAGUE_ID,
        season: SEASON,
        team_ref: `demo_team_${slot}`,
        owner_name: TEAM_NAMES[slot - 1],
        team_name: TEAM_NAMES[slot - 1],
        is_my_team: slot === 6,
        wins: 0, losses: 0, ties: 0,
        points_for: 0, points_against: 0,
      });
    }

    const picks = getDraftPicks(DEMO_DRAFT_ID, "sleeper");

    return c.json({
      ok: true,
      seeded: 1,
      already_simulated: picks.length > 0,
      leagues: getLeagueConfigs(),
    });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
}
