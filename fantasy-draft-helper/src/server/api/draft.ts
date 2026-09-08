import type { Context } from "hono";
import {
  getDraftPicks, saveDraftPick, getLeagueConfigs, getDb, upsertLeagueConfig,
  getPrimaryPlatform, type DraftPickRecord, type LeagueConfig,
} from "../../../backend-lib/db";
import {
  getSleeperDraftPicks, getSleeperDraft,
} from "../../../backend-lib/sleeper";
import {
  getEspnDraftSync, ESPN_POSITION_MAP, credsFromSettings,
  getEspnLeague, getEspnMyDraftPickSlot,
} from "../../../backend-lib/espn";
import { simulateDraft, resetSimulatedDraft, autopickOpponentsUntilMyTurn, ROUNDS } from "../../../backend-lib/draft-sim";
import { invalidateBoardCache } from "./players";
import { syncAllLeagues } from "./season";

// A real, externally-tracked Sleeper draft has a numeric draft_id. Offline/demo
// placeholders use synthetic prefixes and should never trigger a live Sleeper sync.
function isRealSleeperDraftId(draftId: string | null | undefined): draftId is string {
  return !!draftId && !draftId.startsWith("offline_") && !draftId.startsWith("demo_");
}

// A connected ESPN league always gets a real `espn_<leagueId>_<season>` draft_id
// (see leagues.ts) — the offline placeholder only appears when no cfg exists.
function isRealEspnDraftId(draftId: string | null | undefined): draftId is string {
  return !!draftId && draftId.startsWith("espn_");
}

function isRealDraftId(platform: string, draftId: string | null | undefined): boolean {
  return platform === "espn" ? isRealEspnDraftId(draftId) : isRealSleeperDraftId(draftId);
}

// ─── Get draft state ──────────────────────────────────────────────────────────

export async function handleGetDraft(c: Context): Promise<Response> {
  try {
    const platform = c.req.query("platform") ?? getPrimaryPlatform();
    const configs = getLeagueConfigs();
    const cfg = configs.find(l => l.platform === platform);
    const draftId = cfg?.draft_id ?? `offline_${platform}`;
    const picks = getDraftPicks(draftId, platform);

    const totalTeams = cfg?.total_teams ?? 12;
    // cfg.settings_json.draft_rounds can be stale (seen "3" for a real 15-round
    // league), so ROUNDS is the trusted fallback for completion math.
    const rounds = (cfg?.settings_json as Record<string, unknown>)?.draft_rounds ?? ROUNDS;
    const isRealDraft = isRealDraftId(platform, cfg?.draft_id);

    // Authoritative completion check for a real draft; falls back to the local
    // pick-count heuristic for offline/demo/simulated drafts, or if the
    // platform's API is unreachable.
    let isComplete = picks.length >= totalTeams * (rounds as number);
    if (isRealDraft && platform === "sleeper") {
      try {
        const draftMeta = await getSleeperDraft(cfg!.draft_id!);
        isComplete = draftMeta.status === "complete";
      } catch { /* keep heuristic */ }
    } else if (isRealDraft && platform === "espn") {
      const creds = credsFromSettings(cfg!.settings_json);
      if (creds) {
        try {
          const sync = await getEspnDraftSync(cfg!.league_id, cfg!.season, creds);
          isComplete = sync.drafted;
        } catch { /* keep heuristic */ }
      }
    }

    return c.json({
      draft_id: draftId,
      platform,
      picks,
      total_picks: picks.length,
      current_round: Math.ceil((picks.length + 1) / totalTeams),
      next_pick_no: picks.length + 1,
      total_teams: totalTeams,
      rounds,
      my_slot: cfg?.my_pick_slot ?? null,
      is_offline: !isRealDraft,
      is_complete: isComplete,
    });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
}

// ─── Record a manual pick ─────────────────────────────────────────────────────

export async function handleRecordPick(c: Context): Promise<Response> {
  try {
    const body = await c.req.json() as {
      platform?: string;
      player_id?: string;
      player_name: string;
      position?: string;
      team_name?: string;
      is_my_pick?: boolean;
    };

    const platform = body.platform ?? getPrimaryPlatform();
    const configs = getLeagueConfigs();
    const cfg = configs.find(l => l.platform === platform);
    const draftId = cfg?.draft_id ?? `offline_${platform}`;
    const totalTeams = cfg?.total_teams ?? 12;

    const existingPicks = getDraftPicks(draftId, platform);
    const pickNo = existingPicks.length + 1;
    const round = Math.ceil(pickNo / totalTeams);

    // Snake draft slot calculation
    const slot = round % 2 === 0
      ? totalTeams - ((pickNo - 1) % totalTeams)
      : ((pickNo - 1) % totalTeams) + 1;

    const pick: DraftPickRecord = {
      draft_id: draftId,
      platform,
      pick_no: pickNo,
      round,
      slot,
      player_id: body.player_id,
      player_name: body.player_name,
      position: body.position,
      team_name: body.team_name,
      is_my_pick: body.is_my_pick ?? false,
    };

    saveDraftPick(pick);

    // Invalidate the merged board (who's drafted) — NOT the FantasyPros rankings
    // cache, which is unaffected by picks and should keep its normal 1h TTL.
    invalidateBoardCache();

    return c.json({ ok: true, pick });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
}

// ─── Undo last pick ───────────────────────────────────────────────────────────

export async function handleUndoPick(c: Context): Promise<Response> {
  try {
    const platform = c.req.query("platform") ?? getPrimaryPlatform();
    const configs = getLeagueConfigs();
    const cfg = configs.find(l => l.platform === platform);
    const draftId = cfg?.draft_id ?? `offline_${platform}`;

    // We delete the highest pick_no
    const db = getDb();
    db.run(
      "DELETE FROM draft_picks WHERE draft_id = ? AND platform = ? AND pick_no = (SELECT MAX(pick_no) FROM draft_picks WHERE draft_id = ? AND platform = ?)",
      [draftId, platform, draftId, platform]
    );

    const picks = getDraftPicks(draftId, platform);
    invalidateBoardCache();
    return c.json({ ok: true, total_picks: picks.length });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
}

// ─── Sync live draft picks (Sleeper or ESPN) ─────────────────────────────────

async function syncSleeperPicks(cfg: LeagueConfig): Promise<{ synced: number; draftComplete: boolean }> {
  const [livePicks, draftMeta] = await Promise.all([
    getSleeperDraftPicks(cfg.draft_id!),
    isRealSleeperDraftId(cfg.draft_id) ? getSleeperDraft(cfg.draft_id!).catch(() => null) : Promise.resolve(null),
  ]);
  let synced = 0;
  const existing = getDraftPicks(cfg.draft_id!, "sleeper");
  const existingPickNos = new Set(existing.map(p => p.pick_no));

  for (const lp of livePicks) {
    if (existingPickNos.has(lp.pick_no)) continue;

    saveDraftPick({
      draft_id: cfg.draft_id!,
      platform: "sleeper",
      pick_no: lp.pick_no,
      round: lp.round,
      slot: lp.draft_slot,
      player_id: lp.player_id,
      player_name: `${lp.metadata.first_name} ${lp.metadata.last_name}`.trim(),
      position: lp.metadata.position,
      roster_id: lp.roster_id,
      is_my_pick: false, // will be patched by my_slot check
      is_keeper: lp.is_keeper ?? false,
    });
    synced++;
  }

  return { synced, draftComplete: draftMeta?.status === "complete" };
}

async function syncEspnPicks(cfg: LeagueConfig): Promise<{ synced: number; draftComplete: boolean }> {
  const creds = credsFromSettings(cfg.settings_json);
  if (!creds) throw new Error("ESPN credentials not found — re-connect your ESPN league from Setup.");

  // The draft pick slot is only knowable once ESPN's commissioner sets/publishes
  // the pick order — often not yet true at initial connect time. Keep checking
  // on each sync until it resolves, then persist it so this stops firing.
  if (cfg.my_pick_slot == null) {
    try {
      const league = await getEspnLeague(cfg.league_id, cfg.season, creds);
      const mySlot = getEspnMyDraftPickSlot(league, creds.swid);
      if (mySlot != null) {
        cfg.my_pick_slot = mySlot;
        upsertLeagueConfig({ ...cfg, my_pick_slot: mySlot });
      }
    } catch { /* non-critical — retry on next sync */ }
  }

  const sync = await getEspnDraftSync(cfg.league_id, cfg.season, creds);

  // draftDetail.picks only carries a numeric playerId — resolve names/positions
  // from each team's live roster (ESPN assigns a player to a roster the moment
  // they're drafted, so this stays in sync with the picks feed).
  const playerIndex = new Map<number, { name: string; position: string }>();
  for (const team of sync.teams) {
    for (const entry of team.roster?.entries ?? []) {
      const pl = entry.playerPoolEntry?.player;
      if (pl) playerIndex.set(pl.id, { name: pl.fullName, position: ESPN_POSITION_MAP[pl.defaultPositionId] ?? "" });
    }
  }

  let synced = 0;
  const existing = getDraftPicks(cfg.draft_id!, "espn");
  const existingPickNos = new Set(existing.map(p => p.pick_no));

  for (const ep of sync.picks) {
    // ESPN pre-fills every remaining draft slot with a playerId of -1 as a
    // placeholder until that pick actually happens — must be skipped, or
    // the entire draft gets recorded as "complete" the moment it starts.
    if (ep.playerId == null || ep.playerId <= 0) continue;
    if (existingPickNos.has(ep.overallPickNumber)) continue;
    const info = playerIndex.get(ep.playerId);

    saveDraftPick({
      draft_id: cfg.draft_id!,
      platform: "espn",
      pick_no: ep.overallPickNumber,
      round: ep.roundId,
      slot: ep.roundPickNumber,
      player_id: String(ep.playerId),
      player_name: info?.name ?? `Player ${ep.playerId}`,
      position: info?.position,
      roster_id: ep.teamId,
      is_my_pick: false, // will be patched by my_slot check
      is_keeper: ep.keeper ?? false,
    });
    synced++;
  }

  return { synced, draftComplete: sync.drafted };
}

export async function handleSyncDraft(c: Context): Promise<Response> {
  try {
    const platform = c.req.query("platform") ?? getPrimaryPlatform();
    const configs = getLeagueConfigs();
    const cfg = configs.find(l => l.platform === platform);
    if (!cfg?.draft_id) {
      return c.json({ ok: false, error: `No ${platform} draft ID — connect a league from Setup first` });
    }

    const { synced, draftComplete } = platform === "espn"
      ? await syncEspnPicks(cfg)
      : await syncSleeperPicks(cfg);

    if (synced > 0) invalidateBoardCache();

    // The real draft just wrapped up — pull fresh teams/rosters for everyone
    // so "My Team" and league standings reflect the finished draft without
    // the user having to remember to hit Sync manually. Gated by a one-time
    // flag so the 3s client poll (draft.tsx) doesn't re-trigger a full
    // league-wide resync on every tick once the draft is already complete —
    // that was firing repeatedly and could race itself.
    let seasonSync: import("./season").SeasonSyncResults | null = null;
    if (draftComplete && !cfg.settings_json?.draft_complete_synced) {
      try {
        seasonSync = await syncAllLeagues();
        upsertLeagueConfig({ ...cfg, settings_json: { ...cfg.settings_json, draft_complete_synced: true } });
      } catch (err) {
        seasonSync = { season_sync: { ok: false, error: String(err) } };
      }
    }

    return c.json({ ok: true, synced, draft_complete: draftComplete, season_sync: seasonSync });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
}

// ─── Draft a player (alias for handleRecordPick, used by server router) ───────

export const handleDraftPlayer = handleRecordPick;

// ─── Reset entire draft ───────────────────────────────────────────────────────

export async function handleResetDraft(c: import("hono").Context): Promise<Response> {
  try {
    const platform = c.req.query("platform") ?? getPrimaryPlatform();
    resetSimulatedDraft(platform); // clears draft_picks and any seeded roster_players together
    invalidateBoardCache();
    return c.json({ ok: true, message: "Draft reset" });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
}

// ─── Simulate a full draft (demo tool — resets, then re-drafts) ───────────────

export async function handleSimulateDraft(c: import("hono").Context): Promise<Response> {
  try {
    const platform = c.req.query("platform") ?? getPrimaryPlatform();
    resetSimulatedDraft(platform);
    const result = await simulateDraft(platform);
    invalidateBoardCache();
    return c.json({ ok: true, ...result });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
}

// ─── Live Draft mode: autopick every opponent slot until it's my turn ─────────

export async function handleAutopickOpponents(c: import("hono").Context): Promise<Response> {
  try {
    const platform = c.req.query("platform") ?? getPrimaryPlatform();
    const result = await autopickOpponentsUntilMyTurn(platform);
    if (result.picksMade > 0) invalidateBoardCache();
    return c.json({ ok: true, ...result });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
}

// ─── Watchlist handlers ───────────────────────────────────────────────────────

export async function handleWatchlist(c: import("hono").Context): Promise<Response> {
  try {
    const { getWatchlist, addToWatchlist, removeFromWatchlist } = await import("../../../backend-lib/db");
    const method = c.req.method;

    if (method === "GET") {
      return c.json({ watchlist: getWatchlist() });
    }
    if (method === "POST") {
      const body = await c.req.json() as { player_id: string; platform?: string; note?: string; tier?: number };
      addToWatchlist(body.player_id, body.platform ?? "sleeper", body.note, body.tier);
      return c.json({ ok: true });
    }
    if (method === "DELETE") {
      const body = await c.req.json() as { player_id: string; platform?: string };
      removeFromWatchlist(body.player_id, body.platform ?? "sleeper");
      return c.json({ ok: true });
    }
    return c.json({ error: "Method not allowed" }, 405);
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
}

// ─── Player notes handlers ────────────────────────────────────────────────────

export async function handlePlayerNotes(c: import("hono").Context): Promise<Response> {
  try {
    const { getPlayerNotes, upsertPlayerNote } = await import("../../../backend-lib/db");
    const method = c.req.method;

    if (method === "GET") {
      const notes = getPlayerNotes();
      return c.json({ notes });
    }
    if (method === "POST") {
      const body = await c.req.json() as { player_id: string; note?: string; custom_rank?: number; do_not_draft?: boolean };
      upsertPlayerNote(body.player_id, {
        note: body.note,
        custom_rank: body.custom_rank,
        do_not_draft: body.do_not_draft,
      });
      return c.json({ ok: true });
    }
    return c.json({ error: "Method not allowed" }, 405);
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
}
