import type { Context } from "hono";
import {
  getLeagueConfigs, getDraftPicks, getPlayerNotes, getPrimaryPlatform,
} from "../../../backend-lib/db";
import {
  getAllSleeperPlayers, type SleeperPlayer,
} from "../../../backend-lib/sleeper";
import {
  getEspnPlayers, credsFromSettings,
} from "../../../backend-lib/espn";
import {
  getFPRankings, matchPlayerIds, buildNameIndex, normalizeName, type RankedPlayer, type ScoringFormat,
} from "../../../backend-lib/rankings";

// ─── Merged board player ──────────────────────────────────────────────────────

export interface BoardPlayer {
  rank: number;
  player_id: string | null;
  espn_id: string | null;
  name: string;
  position: string;
  team: string | null;
  bye: number | null;
  adp: number | null;
  ecr: number | null;
  tier: number | null;
  positionRank: number | null;
  best: number | null;
  worst: number | null;
  stdDev: number | null;
  age: number | null;
  injury_status: string | null;
  injury_body_part: string | null;
  search_rank: number | null;
  custom_rank: number | null;
  do_not_draft: boolean;
  note: string;
  is_drafted: boolean;
  drafted_at_pick: number | null;
  is_my_pick: boolean;
}

// ─── Cache for built board ────────────────────────────────────────────────────
// Keyed by resolved platform — otherwise a board built for one platform could
// be served back for a request against the other within the TTL window.

const _boardCache = new Map<string, { board: BoardPlayer[]; ts: number }>();
const BOARD_CACHE_MS = 60_000; // 1 minute

// ─── Build the merged board ───────────────────────────────────────────────────

export async function buildBigBoard(platform?: string): Promise<BoardPlayer[]> {
  const resolvedPlatform = platform ?? getPrimaryPlatform();
  const now = Date.now();
  const cached = _boardCache.get(resolvedPlatform);
  if (cached && now - cached.ts < BOARD_CACHE_MS) return cached.board;

  const configs = getLeagueConfigs();
  const cfg = configs.find(l => l.platform === resolvedPlatform) ?? configs[0];
  // If no config matches the requested platform, cfg falls back to whatever
  // IS configured — draftId/picks lookups below must key off cfg's actual
  // platform, not the originally-requested one, or picks silently vanish.
  const effectivePlatform = cfg?.platform ?? resolvedPlatform;
  const scoring: ScoringFormat = (cfg?.scoring_type ?? "ppr") as ScoringFormat;

  // 1. Rankings from FantasyPros
  const rawRankings = await getFPRankings(scoring, "overall");

  // 2. Sleeper player universe for enrichment
  let sleeperPlayers: Record<string, SleeperPlayer> = {};
  try {
    sleeperPlayers = await getAllSleeperPlayers();
  } catch { /* no enrichment */ }

  // 3. Match ranking names to Sleeper IDs
  const nameIndex = buildNameIndex(sleeperPlayers);
  let rankings = matchPlayerIds(rawRankings, nameIndex);

  // 3b. For ESPN, also resolve ESPN's own numeric player ID by name — FantasyPros'
  // rankings carry no native ESPN id, but draft picks synced from ESPN are keyed
  // by ESPN's playerId (see draft.ts handleSyncDraft), so this is required for
  // "who's drafted" to work at all on that platform.
  if (effectivePlatform === "espn" && cfg) {
    const creds = credsFromSettings(cfg.settings_json);
    if (creds) {
      try {
        const espnPlayers = await getEspnPlayers(cfg.season, 1000, creds);
        const espnIndex = new Map<string, number>();
        for (const p of espnPlayers) espnIndex.set(normalizeName(p.fullName), p.id);
        rankings = rankings.map(r => {
          const espnId = espnIndex.get(normalizeName(r.name));
          return espnId != null ? { ...r, espn_id: String(espnId) } : r;
        });
      } catch { /* board still usable; ESPN picks just won't show as drafted */ }
    }
  }

  // 4. Draft picks. ESPN picks are saved keyed by ESPN's numeric player ID
  // (see draft.ts handleSyncDraft), which doesn't match rankings' Sleeper-
  // matched player_id — use the espn_id resolved above for that platform.
  const draftId = cfg?.draft_id ?? `offline_${effectivePlatform}`;
  const picks = getDraftPicks(draftId, effectivePlatform);
  const idField: "player_id" | "espn_id" = effectivePlatform === "espn" ? "espn_id" : "player_id";
  const draftedPlayerIds = new Set(picks.map(p => p.player_id).filter(Boolean));
  const draftedPickByPlayerId = new Map(picks.map(p => [p.player_id, p]));

  // 5. Custom notes
  const notes = getPlayerNotes();

  // 6. Merge
  const board: BoardPlayer[] = rankings
    .filter(r => ["QB", "RB", "WR", "TE", "K", "DST"].includes(r.position))
    .map(r => {
      const sleeper = r.player_id ? sleeperPlayers[r.player_id] : null;
      const note = notes[r.player_id ?? ""];
      const matchId = r[idField];
      const draftedPick = matchId ? draftedPickByPlayerId.get(matchId ?? "") : undefined;
      const isDrafted = matchId
        ? draftedPlayerIds.has(matchId)
        : picks.some(p => p.player_name?.toLowerCase() === r.name.toLowerCase());

      return {
        rank: r.rank,
        player_id: r.player_id,
        espn_id: r.espn_id,
        name: r.name,
        position: r.position,
        team: sleeper?.team ?? r.team ?? null,
        bye: r.bye ?? null,
        adp: r.adp,
        ecr: r.ecr,
        tier: r.tier,
        positionRank: r.positionRank,
        best: r.best,
        worst: r.worst,
        stdDev: r.stdDev,
        age: sleeper?.age ?? null,
        injury_status: sleeper?.injury_status ?? null,
        injury_body_part: sleeper?.injury_body_part ?? null,
        search_rank: sleeper?.search_rank ?? null,
        custom_rank: note?.custom_rank ?? null,
        do_not_draft: note?.do_not_draft ?? false,
        note: note?.note ?? "",
        is_drafted: isDrafted,
        drafted_at_pick: draftedPick?.pick_no ?? null,
        is_my_pick: draftedPick?.is_my_pick ?? false,
      };
    });

  _boardCache.set(resolvedPlatform, { board, ts: now });
  return board;
}

// ─── Route handlers ───────────────────────────────────────────────────────────

export async function handleGetPlayers(c: Context): Promise<Response> {
  try {
    const pos = c.req.query("pos"); // "QB" | "RB" | "WR" | "TE" | "K" | "DST" | all
    const includeRostered = c.req.query("drafted") === "true";
    const limit = parseInt(c.req.query("limit") ?? "300");
    const platform = c.req.query("platform") ?? getPrimaryPlatform();

    const board = await buildBigBoard(platform);

    let filtered = board;
    if (pos) filtered = filtered.filter(p => p.position === pos);
    if (!includeRostered) filtered = filtered.filter(p => !p.is_drafted);

    return c.json({
      players: filtered.slice(0, limit),
      total: filtered.length,
    });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
}

export async function handleGetRankings(c: Context): Promise<Response> {
  try {
    const platform = c.req.query("platform") ?? getPrimaryPlatform();
    const board = await buildBigBoard(platform);
    return c.json({
      rankings: board.slice(0, 250),
      total: board.length,
    });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
}

// ─── Invalidate in-memory board cache (call after draft picks) ────────────────

export function invalidateBoardCache(): void {
  _boardCache.clear();
}

// ─── Single player lookup ─────────────────────────────────────────────────────

export async function handleGetPlayer(c: import("hono").Context): Promise<Response> {
  try {
    const id = c.req.param("id");
    const platform = c.req.query("platform") ?? getPrimaryPlatform();
    const board = await buildBigBoard(platform);
    const player = board.find(p => p.player_id === id);
    if (!player) return c.json({ error: "Player not found" }, 404);
    return c.json(player);
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
}

// ─── Invalidate board cache ───────────────────────────────────────────────────

export async function handleInvalidateBoard(c: import("hono").Context): Promise<Response> {
  invalidateBoardCache();
  return c.json({ ok: true, message: "Board cache cleared" });
}
