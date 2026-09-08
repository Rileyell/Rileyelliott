import { cacheGet, cacheSet } from "./db";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FPRanking {
  rank: number;
  player_name: string;
  team: string;
  position: string;
  bye_week: number | null;
  best_rank: number;
  worst_rank: number;
  avg_rank: number;
  std_dev: number;
  ecr_vs_adp: number;
  fp_player_id?: string;
  pos_rank: number;
}

export interface FPProjection {
  player_name: string;
  team: string;
  position: string;
  games: number;
  pass_att?: number;
  pass_cmp?: number;
  pass_yds?: number;
  pass_tds?: number;
  pass_ints?: number;
  rush_att?: number;
  rush_yds?: number;
  rush_tds?: number;
  rec?: number;
  rec_yds?: number;
  rec_tds?: number;
  targets?: number;
  fl?: number;
  fpts: number;
}

// ─── Scraper helpers ──────────────────────────────────────────────────────────

const FP_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
};

async function fpFetch(url: string, ttlSeconds = 3600): Promise<string> {
  const cacheKey = `fp:${url}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const res = await fetch(url, { headers: FP_HEADERS });
  if (!res.ok) throw new Error(`FantasyPros fetch ${url}: ${res.status}`);
  const html = await res.text();
  if (ttlSeconds > 0) cacheSet(cacheKey, html, ttlSeconds);
  return html;
}

// ─── Extract embedded JSON (ecrData) ─────────────────────────────────────────

function extractEcrData(html: string): FPRanking[] {
  const match = html.match(/var\s+ecrData\s*=\s*(\{[\s\S]*?\});\s*\n/);
  if (!match) {
    // Try alternate pattern
    const altMatch = html.match(/ecrData\s*=\s*(\{[\s\S]{10,20000}?\});/);
    if (!altMatch) return [];
    try {
      const data = JSON.parse(altMatch[1]);
      return parseEcrPlayers(data);
    } catch { return []; }
  }
  try {
    const data = JSON.parse(match[1]);
    return parseEcrPlayers(data);
  } catch { return []; }
}

function parseEcrPlayers(data: { players?: unknown[] }): FPRanking[] {
  if (!data?.players || !Array.isArray(data.players)) return [];
  return (data.players as Record<string, unknown>[]).map((p, i) => ({
    rank: (p.rank_ecr as number) ?? (p.rank as number) ?? i + 1,
    player_name: (p.player_name as string) ?? (p.player_name_html as string) ?? "",
    team: (p.player_team_id as string) ?? "",
    position: (p.player_position_id as string) ?? "",
    bye_week: (p.player_bye_week as number) ?? null,
    best_rank: (p.rank_min as number) ?? 0,
    worst_rank: (p.rank_max as number) ?? 0,
    avg_rank: (p.rank_ave as number) ?? 0,
    std_dev: (p.rank_std as number) ?? 0,
    ecr_vs_adp: (p.pos_rank as number) ?? 0,
    fp_player_id: String(p.player_id ?? ""),
    pos_rank: (p.pos_rank as number) ?? 0,
  }));
}

// ─── Public rankings endpoints ────────────────────────────────────────────────

type Scoring = "ppr" | "half-ppr" | "standard";
type Position = "overall" | "qb" | "rb" | "wr" | "te" | "k" | "dst";

function fpRankingsUrl(scoring: Scoring, position: Position, year = 2026): string {
  const scoringSlug = scoring === "ppr" ? "ppr-" : scoring === "half-ppr" ? "half-point-ppr-" : "";
  const posSlug = position === "overall" ? "cheatsheets" : position;
  if (position === "overall") {
    return `https://www.fantasypros.com/nfl/rankings/${scoringSlug}cheatsheets.php`;
  }
  return `https://www.fantasypros.com/nfl/rankings/${scoringSlug}${posSlug}.php`;
}

export async function getFPRankings(
  scoring: Scoring = "ppr",
  position: Position = "overall",
  year = 2026
): Promise<FPRanking[]> {
  const cacheKey = `fp:rankings:${scoring}:${position}:${year}`;
  const cached = cacheGet(cacheKey);
  if (cached) return JSON.parse(cached) as FPRanking[];

  const url = fpRankingsUrl(scoring, position, year);
  const html = await fpFetch(url, 0); // don't double-cache
  const rankings = extractEcrData(html);

  if (rankings.length > 0) {
    cacheSet(cacheKey, JSON.stringify(rankings), 3600); // 1h
  }
  return rankings;
}

// ─── Projections ──────────────────────────────────────────────────────────────

function extractProjectionTable(html: string, position: string): FPProjection[] {
  const results: FPProjection[] = [];

  // Find the data table in FantasyPros projections page
  const tableMatch = html.match(/<table[^>]*id="data"[^>]*>([\s\S]*?)<\/table>/i);
  if (!tableMatch) return results;

  // Rows are tagged with a "mpb-player-<id>" class, not a data-player attribute.
  const rows = tableMatch[1].match(/<tr[^>]*class="[^"]*mpb-player-[^"]*"[\s\S]*?<\/tr>/gi) ?? [];

  for (const row of rows) {
    const nameMatch = row.match(/fp-player-name="([^"]*)"/i);
    if (!nameMatch) continue;
    const player_name = nameMatch[1].trim();

    // Team code trails the closing </a> in the same cell (absent for DST rows).
    const teamMatch = row.match(/<\/a>\s*([A-Z]{2,4})\s*<\/td>/);
    const team = teamMatch ? teamMatch[1] : "";

    // FPTS is the only column carrying data-sort-value, and is always last.
    const fptsMatch = row.match(/data-sort-value="([\d.]+)"/);
    const fpts = fptsMatch ? parseFloat(fptsMatch[1]) : 0;

    results.push({ player_name, team, position, games: 16, fpts });
  }

  return results;
}

export async function getFPProjections(
  position: "qb" | "rb" | "wr" | "te" | "k" | "dst",
  scoring: Scoring = "ppr",
  year = 2026,
  week: number | "draft" = "draft"
): Promise<FPProjection[]> {
  const cacheKey = `fp:proj:${position}:${scoring}:${year}:${week}`;
  const cached = cacheGet(cacheKey);
  if (cached) return JSON.parse(cached) as FPProjection[];

  const url = `https://www.fantasypros.com/nfl/projections/${position}.php?week=${week}&scoring=${scoring.toUpperCase()}`;

  const html = await fpFetch(url, 0);
  const projections = extractProjectionTable(html, position.toUpperCase());

  if (projections.length > 0) {
    // Weekly (in-season) projections shift daily with news/injuries — cache
    // for a short window. Draft-week (season-long) projections are stable.
    cacheSet(cacheKey, JSON.stringify(projections), week === "draft" ? 7200 : 1800);
  }
  return projections;
}

// ─── ADP ─────────────────────────────────────────────────────────────────────

export interface FPAdpEntry {
  rank: number;
  player_name: string;
  position: string;
  team: string;
  bye_week: number | null;
  adp: number;
  vs_adp: number;
}

function extractAdpData(html: string): FPAdpEntry[] {
  const results: FPAdpEntry[] = [];

  // FantasyPros embeds ADP as ecrData too in their ADP pages
  const rankings = extractEcrData(html);
  if (rankings.length > 0) {
    return rankings.map((r, i) => ({
      rank: i + 1,
      player_name: r.player_name,
      position: r.position,
      team: r.team,
      bye_week: r.bye_week,
      adp: r.avg_rank,
      vs_adp: r.ecr_vs_adp,
    }));
  }

  return results;
}

export async function getFPAdp(scoring: Scoring = "ppr", year = 2026): Promise<FPAdpEntry[]> {
  const cacheKey = `fp:adp:${scoring}:${year}`;
  const cached = cacheGet(cacheKey);
  if (cached) return JSON.parse(cached) as FPAdpEntry[];

  const scoringSlug = scoring === "ppr" ? "ppr-" : scoring === "half-ppr" ? "half-point-ppr-" : "";
  const url = `https://www.fantasypros.com/nfl/adp/${scoringSlug}overall.php`;

  const html = await fpFetch(url, 0);
  const adp = extractAdpData(html);

  if (adp.length > 0) {
    cacheSet(cacheKey, JSON.stringify(adp), 3600);
  }
  return adp;
}

// ─── News scraper ─────────────────────────────────────────────────────────────

export interface FPNews {
  player_name: string;
  position: string;
  team: string;
  headline: string;
  summary: string;
  analysis: string;
  published: string;
}

export async function getFPPlayerNews(limit = 20): Promise<FPNews[]> {
  const cacheKey = `fp:news:${limit}`;
  const cached = cacheGet(cacheKey);
  if (cached) return JSON.parse(cached) as FPNews[];

  const html = await fpFetch("https://www.fantasypros.com/nfl/player-news.php", 0);

  const results: FPNews[] = [];
  const articles = html.match(/<article[^>]*class="[^"]*player-news-item[^"]*"[^>]*>([\s\S]*?)<\/article>/gi) ?? [];

  for (const article of articles.slice(0, limit)) {
    const nameMatch = article.match(/class="player-name[^"]*"[^>]*>([^<]+)</i);
    const posTeamMatch = article.match(/class="player-position[^"]*"[^>]*>([^<]+)<\/span>\s*-\s*([^<]+)/i);
    const headlineMatch = article.match(/<h4[^>]*>([^<]+)<\/h4>/i);
    const summaryMatch = article.match(/<p[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
    const dateMatch = article.match(/datetime="([^"]+)"/i);

    results.push({
      player_name: nameMatch ? nameMatch[1].trim() : "",
      position: posTeamMatch ? posTeamMatch[1].trim() : "",
      team: posTeamMatch ? posTeamMatch[2].trim() : "",
      headline: headlineMatch ? headlineMatch[1].trim() : "",
      summary: summaryMatch ? summaryMatch[1].replace(/<[^>]+>/g, "").trim() : "",
      analysis: "",
      published: dateMatch ? dateMatch[1] : new Date().toISOString(),
    });
  }

  if (results.length > 0) {
    cacheSet(cacheKey, JSON.stringify(results), 1800); // 30min
  }
  return results;
}
