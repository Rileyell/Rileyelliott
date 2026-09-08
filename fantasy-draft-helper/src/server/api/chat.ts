import type { Context } from "hono";
import { readFileSync } from "node:fs";
import {
  getChatHistory, appendChatHistory, getLeagueConfigs, getPrimaryPlatform, cacheGet,
  getDraftPicks, getMyTeam, getRosterPlayers, getLatestRosterWeek, type LeagueConfig,
} from "../../../backend-lib/db";
import { callZo } from "../../../backend-lib/zo-api";
import { buildBigBoard, type BoardPlayer } from "./players";
import { parseRosterSlots, formatRosterSlots, maxStartableAt } from "../../../backend-lib/roster-slots";

// ─── Multi-source expert brief (static file, refreshed manually via research pulls) ──
// Supplements the single-source FantasyPros ECR feed below with cross-checked
// rankings/disagreements/injury news from ESPN, Yahoo, RotoWire, PFF, 4for4,
// crowd ADP, and beat reporters — read once per process, not per request.
let _multiSourceBrief: string | null = null;
function getMultiSourceBrief(): string {
  if (_multiSourceBrief !== null) return _multiSourceBrief;
  try {
    _multiSourceBrief = readFileSync(
      `${import.meta.dir}/../../../backend-lib/data/multi-source-brief.md`,
      "utf-8"
    );
  } catch {
    _multiSourceBrief = "";
  }
  return _multiSourceBrief;
}

// ─── Roster construction methodology (static reference, see backend-lib/data) ──
let _rosterConstructionDoc: string | null = null;
function getRosterConstructionDoc(): string {
  if (_rosterConstructionDoc !== null) return _rosterConstructionDoc;
  try {
    _rosterConstructionDoc = readFileSync(
      `${import.meta.dir}/../../../backend-lib/data/roster-construction.md`,
      "utf-8"
    );
  } catch {
    _rosterConstructionDoc = "";
  }
  return _rosterConstructionDoc;
}

// Tells the chatbot exactly how many starting slots this league has per
// position, and — critically — exactly who the manager currently owns at
// each position, so it can never suggest "starting" more players at a
// position than there are slots for (e.g. two QBs in a 1-QB league). Prefers
// the actual synced roster (reflects trades/waivers) once the draft is
// complete; falls back to draft picks while a draft is still in progress.
function buildRosterConstructionContext(
  cfg: LeagueConfig | undefined,
  platform: string,
  picks: ReturnType<typeof getDraftPicks>,
  board: BoardPlayer[],
): string {
  const slots = parseRosterSlots(cfg?.roster_positions ?? null);
  const slotSummary = formatRosterSlots(slots);

  const ownedByPosition = new Map<string, string[]>();
  let source: "roster" | "draft" | "none" = "none";

  if (cfg) {
    const myTeam = getMyTeam(cfg.platform, cfg.league_id, cfg.season);
    const week = myTeam ? getLatestRosterWeek(cfg.platform, cfg.league_id, cfg.season) : null;
    if (myTeam && week != null) {
      const idField: "player_id" | "espn_id" = cfg.platform === "espn" ? "espn_id" : "player_id";
      const boardById = new Map(board.filter(p => p[idField]).map(p => [p[idField] as string, p]));
      const rosterRows = getRosterPlayers(cfg.platform, cfg.league_id, cfg.season, week, myTeam.team_ref);
      for (const r of rosterRows) {
        const bp = boardById.get(r.player_id);
        const pos = bp?.position ?? r.position ?? "?";
        const arr = ownedByPosition.get(pos) ?? [];
        arr.push(bp?.name ?? r.player_id);
        ownedByPosition.set(pos, arr);
      }
      source = "roster";
    }
  }

  if (source === "none") {
    const myPicks = picks.filter(p => p.is_my_pick);
    for (const p of myPicks) {
      const pos = p.position ?? "?";
      const arr = ownedByPosition.get(pos) ?? [];
      arr.push(p.player_name ?? "?");
      ownedByPosition.set(pos, arr);
    }
    if (myPicks.length > 0) source = "draft";
  }

  const header = `\nROSTER CONSTRUCTION FOR THIS LEAGUE (hard starting-slot limits — NOT a suggestion, an actual constraint):\n${slotSummary}`;

  if (source === "none") {
    return `${header}\nNo roster synced yet, so exact ownership by position isn't known — still apply these slot limits generically (e.g. never suggest starting more than the QB slot count above at QB, no matter how the players individually rank).`;
  }

  const lines = Array.from(ownedByPosition.entries()).map(([pos, names]) => {
    const cap = maxStartableAt(slots, pos);
    const flag = names.length > cap
      ? `  ⚠ owns ${names.length}, only ${cap} startable slot(s) here — pick exactly ${cap} to start, the rest are bench/trade/drop candidates, NEVER suggest starting more than ${cap}`
      : "";
    return `- ${pos}: ${names.length} owned (${cap} startable) — ${names.join(", ")}${flag}`;
  });

  const label = source === "roster" ? "MY CURRENT ROSTER BY POSITION" : "MY DRAFTED PLAYERS BY POSITION (draft still in progress)";
  return `${header}\n\n${label}:\n${lines.join("\n")}`;
}

function buildDraftContext(
  platform: string,
  picks: ReturnType<typeof getDraftPicks>,
  leagueName: string,
  scoring: string,
  totalTeams: number,
  rounds: number,
  mySlot: number | null,
): string {
  const myPicks = picks.filter(p => p.is_my_pick);
  const draftedNames = picks.map(p => `${p.pick_no}. ${p.player_name} (${p.position})`).join(", ");
  const myTeam = myPicks.map(p => `${p.player_name} (${p.position})`).join(", ");

  return `
FANTASY DRAFT CONTEXT:
- League: ${leagueName} | ${totalTeams}-team ${scoring.toUpperCase()} snake draft | ${rounds} rounds
- My draft slot: ${mySlot ?? "Unknown"}
- Picks made: ${picks.length} / ${totalTeams * rounds}
- Current round: ${Math.ceil((picks.length + 1) / totalTeams)}
- My team: ${myTeam || "None drafted yet"}
- Recent picks: ${draftedNames || "Draft not started"}
`.trim();
}

function buildRankingsContext(scoring: string): string {
  const cacheKey = `fp:rankings:${scoring}:overall`;
  const raw = cacheGet(cacheKey);
  if (!raw) return "";

  try {
    const rankings: Array<{
      rank: number;
      name: string;
      position: string;
      team: string;
      tier: number;
      ecr: number;
      bye?: number;
      positionRank?: number;
      adp?: number | null;
      best?: number | null;
      worst?: number | null;
    }> = JSON.parse(raw);

    const lines = rankings.slice(0, 200).map(p =>
      `${p.rank}. ${p.name} | ${p.position}/${p.team ?? "FA"} | Tier ${p.tier} | ECR ${p.ecr}${p.bye ? ` | Bye ${p.bye}` : ""}${p.positionRank ? ` | ${p.position}${p.positionRank}` : ""}${p.adp != null ? ` | ADP ${p.adp}` : ""}${p.best != null && p.worst != null ? ` | Range ${p.best}-${p.worst}` : ""}`
    ).join("\n");

    return `\nFANTASYPROS ${scoring.toUpperCase()} RANKINGS (Top 200 — your second brain):\n${lines}`;
  } catch {
    return "";
  }
}

export async function handleChat(c: Context): Promise<Response> {
  try {
    const body = await c.req.json() as {
      message: string;
      session_id?: string;
      platform?: string;
      include_board?: boolean;
    };

    if (!body.message?.trim()) {
      return c.json({ error: "message is required" }, 400);
    }

    const requestedPlatform = body.platform ?? getPrimaryPlatform();
    const sessionId = body.session_id ?? "default";
    const configs = getLeagueConfigs();
    const cfg = configs.find(l => l.platform === requestedPlatform) ?? configs[0];
    // cfg may have fallen back to a different platform than requested — every
    // lookup below must key off cfg's actual platform, not the request's.
    const platform = cfg?.platform ?? requestedPlatform;

    const draftId = cfg?.draft_id ?? `offline_${platform}`;
    const picks = getDraftPicks(draftId, platform);
    const scoring = cfg?.scoring_type ?? "ppr";

    const settings = cfg?.settings_json as Record<string, unknown> ?? {};
    const draftContext = buildDraftContext(
      platform,
      picks,
      cfg?.league_name ?? "Fantasy League",
      scoring,
      cfg?.total_teams ?? 12,
      (settings.draft_rounds as number) ?? 15,
      cfg?.my_pick_slot ?? null,
    );

    // Board is needed both for the "top available players" block and for
    // resolving names/positions of the user's own roster below — fetch it
    // unconditionally (cached, cheap) rather than only when include_board is set.
    const board = await buildBigBoard(platform).catch(() => [] as BoardPlayer[]);

    let boardContext = "";
    if (body.include_board !== false) {
      const available = board.filter(p => !p.is_drafted).slice(0, 100);
      const lines = available.map(p => {
        const posRank = p.positionRank ? ` | ${p.position}${p.positionRank}` : "";
        const adp = p.adp != null ? ` | ADP ${p.adp}` : "";
        const range = p.best != null && p.worst != null ? ` | Range ${p.best}-${p.worst}` : "";
        const injury = p.injury_status ? ` | ⚠ ${p.injury_status}${p.injury_body_part ? ` (${p.injury_body_part})` : ""}` : "";
        return `${p.rank}. ${p.name} ${p.position}/${p.team ?? "FA"} Tier${p.tier ?? "?"} ECR${p.ecr ?? p.rank}${posRank}${adp}${range}${injury}`;
      }).join("\n");
      boardContext = `\nTOP AVAILABLE PLAYERS (live board — ECR, position rank, ADP, analyst high/low range, injury status):\n${lines}`;
    }

    // Roster construction — exact starting-slot limits for this specific
    // league plus who the manager actually owns at each position, so the
    // model can never recommend starting more players at a position than
    // there are slots for (the "second brain" for lineup math, not just rank).
    const rosterConstructionContext = buildRosterConstructionContext(cfg, platform, picks, board);
    const rosterConstructionDoc = getRosterConstructionDoc();

    // FantasyPros rankings as second brain
    const rankingsContext = buildRankingsContext(scoring);

    // Cross-source expert brief — ESPN, Yahoo, RotoWire, PFF, 4for4, crowd ADP,
    // injury/camp reporting. Keeps the chatbot from just parroting FantasyPros ECR.
    const multiSourceBrief = getMultiSourceBrief();

    // Chat history for context
    const history = getChatHistory(sessionId, 10);
    const historyStr = history.map(h => `${h.role === "user" ? "User" : "Zo"}: ${h.content}`).join("\n");

    const prompt = `You are a fantasy football advisor — used both live during drafts and afterward for start/sit, waiver, and trade questions. You have access to FantasyPros expert consensus rankings (ECR) enriched with several other signals for each player: position rank, ADP (average draft position — compare to ECR to spot value or reaches), the analyst high/low range (a wide range means experts disagree, i.e. more risk/boom-bust; a tight range means consensus), and live injury status from Sleeper. You ALSO have a separate cross-source brief pulled from ESPN, Yahoo, RotoWire, PFF, 4for4, live crowd ADP, and beat-reporter injury/camp news — use it to check whether FantasyPros' consensus agrees or disagrees with the wider market, and to catch late-breaking news FantasyPros' rankings may not reflect yet.

${draftContext}
${boardContext}
${rosterConstructionContext}
${rosterConstructionDoc ? `\nROSTER CONSTRUCTION METHODOLOGY (how to reason about scarcity, flex, and start/sit correctly — read this before answering any lineup question):\n${rosterConstructionDoc}` : ""}
${rankingsContext}
${multiSourceBrief ? `\nCROSS-SOURCE EXPERT BRIEF (ESPN / Yahoo / RotoWire / PFF / 4for4 / crowd ADP / injury desks):\n${multiSourceBrief}` : ""}

${historyStr ? `Recent conversation:\n${historyStr}\n` : ""}
User question: ${body.message}

CRITICAL ROSTER RULE: rankings tell you talent, not who can actually start. Before recommending anyone "start," check the ROSTER CONSTRUCTION section above for the exact slot count at that position. You may never suggest starting more players at a position than that league has slots for — e.g. in a 1-QB league, if the manager owns two quarterbacks, pick exactly ONE as the starter and say explicitly what to do with the other (bench, hold as a bye-week/injury contingency, or trade/drop if it's a real 3rd option). If a position shows a "⚠ owns more than startable" flag, that is the case you're in right now — resolve it explicitly, don't recommend both.

Give a concise, direct answer using specific player names and positions. Don't lean on ECR alone — weigh it together with the other signals available: position rank (need at that position), ADP vs ECR (value/reach), analyst range (risk/consensus), injury status (availability risk), and the cross-source brief above. When FantasyPros' number and the wider market (ESPN/Yahoo/RotoWire/crowd ADP) disagree, say so explicitly rather than presenting one number as unanimous — fantasy advice from a single source is a blind spot, and the user specifically wants a range of expert opinion considered, not just one ranking site. If asking about who to draft, cite the specific player's ECR rank and tier plus whichever other signals (including cross-source disagreement or injury/camp news) are most relevant to the question. Keep it actionable.`;

    const zoResult = await callZo(prompt, { model: "claude-haiku-4-5-20251001" });
    const reply = typeof zoResult.output === "string"
      ? zoResult.output
      : JSON.stringify(zoResult.output);

    appendChatHistory(sessionId, "user", body.message, { pick_count: picks.length });
    appendChatHistory(sessionId, "assistant", reply);

    return c.json({ reply, session_id: sessionId });
  } catch (err) {
    console.error("[chat] Error:", err);
    return c.json({ error: String(err) }, 500);
  }
}
