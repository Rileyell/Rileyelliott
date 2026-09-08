import { cacheGet, cacheSet } from "./db";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RankedPlayer {
  rank: number;
  player_id: string | null; // Sleeper player_id matched by name
  espn_id: string | null;
  name: string;
  position: string;
  team: string;
  bye: number | null;
  adp: number | null;
  positionRank: number | null;
  tier: number | null;
  ecr: number | null; // Expert Consensus Rank
  best: number | null;
  worst: number | null;
  stdDev: number | null;
  slug: string;
}

export type ScoringFormat = "ppr" | "half-ppr" | "standard";

// ─── FantasyPros scraper ──────────────────────────────────────────────────────

const FP_BASE = "https://www.fantasypros.com/nfl";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

function scoringToFP(scoring: ScoringFormat): string {
  if (scoring === "ppr") return "ppr-";
  if (scoring === "half-ppr") return "half-point-ppr-";
  return "";
}

export async function getFPRankings(
  scoring: ScoringFormat = "ppr",
  position: "overall" | "QB" | "RB" | "WR" | "TE" | "K" | "DST" = "overall"
): Promise<RankedPlayer[]> {
  const cacheKey = `fp:rankings:${scoring}:${position}`;
  const cached = cacheGet(cacheKey);
  if (cached) return JSON.parse(cached) as RankedPlayer[];

  const prefix = scoringToFP(scoring);
  let urlPath: string;
  if (position === "overall") {
    urlPath = `/rankings/${prefix}cheatsheets.php`;
  } else {
    urlPath = `/rankings/${prefix}${position.toLowerCase()}.php`;
  }

  try {
    const res = await fetch(`${FP_BASE}${urlPath}`, {
      headers: {
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.fantasypros.com/nfl/rankings/",
      },
    });

    if (!res.ok) throw new Error(`FantasyPros ${urlPath}: ${res.status}`);
    const html = await res.text();
    const players = parseEcrDataFromHtml(html, scoring);

    // Merge live ADP so ADP-vs-ECR (value/reach) actually has data — parseEcrDataFromHtml
    // always leaves adp null since the rankings page doesn't carry it.
    if (players.length > 0) {
      try {
        const adpEntries = await getFPADP(scoring);
        const adpIndex = new Map(adpEntries.map(a => [normalizeName(a.name), a.adp]));
        for (const p of players) {
          const adp = adpIndex.get(normalizeName(p.name));
          if (adp != null) p.adp = adp;
        }
      } catch { /* ADP is best-effort enrichment */ }
    }

    if (players.length > 0) {
      cacheSet(cacheKey, JSON.stringify(players), 3600); // 1 hour
    }
    return players;
  } catch (err) {
    console.error("FantasyPros fetch error:", err);
    return [];
  }
}

export async function getFPADP(scoring: ScoringFormat = "ppr"): Promise<RankedPlayer[]> {
  const cacheKey = `fp:adp:${scoring}`;
  const cached = cacheGet(cacheKey);
  if (cached) return JSON.parse(cached) as RankedPlayer[];

  const prefix = scoringToFP(scoring);
  const url = `${FP_BASE}/adp/${prefix}overall.php`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml",
        "Referer": "https://www.fantasypros.com/nfl/adp/",
      },
    });
    if (!res.ok) throw new Error(`FantasyPros ADP ${url}: ${res.status}`);
    const html = await res.text();
    const players = parseAdpFromHtml(html, scoring);
    if (players.length > 0) {
      cacheSet(cacheKey, JSON.stringify(players), 3600);
    }
    return players;
  } catch (err) {
    console.error("FantasyPros ADP fetch error:", err);
    return [];
  }
}

// ─── HTML parsers ─────────────────────────────────────────────────────────────

function parseEcrDataFromHtml(html: string, scoring: ScoringFormat): RankedPlayer[] {
  // FantasyPros embeds ecrData as JSON in a <script> tag
  const ecrMatch = html.match(/var\s+ecrData\s*=\s*(\{[\s\S]*?\});\s*\n/);
  if (!ecrMatch) {
    // Fallback: try parsing the table
    return parseRankingsTableFromHtml(html, scoring);
  }

  try {
    const ecr = JSON.parse(ecrMatch[1]);
    const players = ecr.players as Array<Record<string, unknown>>;
    return players.map((p, i) => ({
      rank: (p.rank_ecr as number) ?? i + 1,
      player_id: null,
      espn_id: p.espn_id ? String(p.espn_id) : null,
      name: String(p.player_name ?? ""),
      position: String(p.player_position_id ?? ""),
      team: String(p.player_team_id ?? ""),
      bye: p.player_bye_week ? Number(p.player_bye_week) : null,
      adp: p.pos_rank ? null : null, // adp comes from separate endpoint
      positionRank: p.pos_rank ? parseInt(String(p.pos_rank).replace(/\D/g, "")) : null,
      tier: p.tier ? Number(p.tier) : null,
      ecr: Number(p.rank_ecr ?? i + 1),
      best: p.rank_best ? Number(p.rank_best) : null,
      worst: p.rank_worst ? Number(p.rank_worst) : null,
      stdDev: p.rank_std ? Number(p.rank_std) : null,
      slug: String(p.player_filename ?? ""),
    }));
  } catch (e) {
    console.error("ECR parse error:", e);
    return parseRankingsTableFromHtml(html, scoring);
  }
}

function parseRankingsTableFromHtml(html: string, _scoring: ScoringFormat): RankedPlayer[] {
  const players: RankedPlayer[] = [];
  // Match table rows: look for player-name anchors in data rows
  const rowRegex = /<tr[^>]*>[\s\S]*?<\/tr>/g;
  const rows = html.match(rowRegex) ?? [];

  let rank = 1;
  for (const row of rows) {
    if (!row.includes("player-name")) continue;
    const nameMatch = row.match(/player-name[^>]*>([^<]+)</);
    const posMatch = row.match(/data-position="([^"]+)"/);
    const teamMatch = row.match(/data-team="([^"]+)"/);
    if (!nameMatch) continue;

    players.push({
      rank: rank++,
      player_id: null,
      espn_id: null,
      name: nameMatch[1].trim(),
      position: posMatch?.[1] ?? "",
      team: teamMatch?.[1] ?? "",
      bye: null,
      adp: null,
      positionRank: null,
      tier: null,
      ecr: rank,
      best: null,
      worst: null,
      stdDev: null,
      slug: "",
    });
  }
  return players;
}

function parseAdpFromHtml(html: string, _scoring: ScoringFormat): RankedPlayer[] {
  // ADP data is often in an adpData variable
  const adpMatch = html.match(/var\s+adpData\s*=\s*(\{[\s\S]*?\});\s*\n/);
  if (adpMatch) {
    try {
      const adp = JSON.parse(adpMatch[1]);
      const players = adp.players as Array<Record<string, unknown>>;
      return players.map((p, i) => ({
        rank: i + 1,
        player_id: null,
        espn_id: p.espn_id ? String(p.espn_id) : null,
        name: String(p.player_name ?? ""),
        position: String(p.player_position_id ?? ""),
        team: String(p.player_team_id ?? ""),
        bye: p.player_bye_week ? Number(p.player_bye_week) : null,
        adp: p.average_pick ? Number(p.average_pick) : i + 1,
        positionRank: p.pos_rank ? parseInt(String(p.pos_rank).replace(/\D/g, "")) : null,
        tier: null,
        ecr: p.rank_ecr ? Number(p.rank_ecr) : i + 1,
        best: p.high ? Number(p.high) : null,
        worst: p.low ? Number(p.low) : null,
        stdDev: p.std_dev ? Number(p.std_dev) : null,
        slug: String(p.player_filename ?? ""),
      }));
    } catch { /* fall through */ }
  }
  return parseRankingsTableFromHtml(html, "ppr");
}

// ─── Player matching (FP name → Sleeper player_id) ────────────────────────────

export function normalizeName(name: string): string {
  return name.toLowerCase()
    .replace(/\s+jr\.?$/i, "")
    .replace(/\s+sr\.?$/i, "")
    .replace(/\s+iii$/i, "")
    .replace(/\s+ii$/i, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildNameIndex(
  sleeperPlayers: Record<string, { full_name: string | null; position: string | null; team: string | null }>
): Map<string, string> {
  const index = new Map<string, string>();
  for (const [id, p] of Object.entries(sleeperPlayers)) {
    if (p.full_name) {
      index.set(normalizeName(p.full_name), id);
    }
    // Sleeper indexes team defenses by team abbreviation with full_name: null
    // (e.g. id "SEA", position "DEF"), so they never get a name-based match.
    // Index them by team code too, since FantasyPros DST rows carry `team`.
    if (p.position === "DEF" && p.team) {
      index.set(p.team.toLowerCase(), id);
    }
  }
  return index;
}

export function matchPlayerIds(
  rankings: RankedPlayer[],
  nameIndex: Map<string, string>
): RankedPlayer[] {
  return rankings.map(r => {
    const key = normalizeName(r.name);
    const id = nameIndex.get(key)
      ?? (r.position === "DST" ? nameIndex.get(r.team.toLowerCase()) : undefined)
      ?? null;
    return { ...r, player_id: id };
  });
}
