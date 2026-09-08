import { Database } from "bun:sqlite";
import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { AsyncLocalStorage } from "node:async_hooks";

// Request-scoped session storage — the session middleware in server.ts
// calls sessionStorage.run(sid, next) so every db call in that request
// automatically resolves to the right per-user DB without any explicit threading.
export const sessionStorage = new AsyncLocalStorage<string>();

export type ScoringFormat = "ppr" | "half-ppr" | "standard";

// ─── Database setup ───────────────────────────────────────────────────────────

const DEFAULT_DB_PATH = process.env.DRAFT_DB_PATH ?? `${import.meta.dir}/../data/draft.db`;
const DATA_DIR = `${import.meta.dir}/../data`;

// Per-session DB cache: sessionId -> Database instance
const _dbCache = new Map<string, Database>();
const DEFAULT_KEY = "__default__";

/**
 * Returns the DB for a given session.
 * - Explicit sessionId → uses that session's DB file
 * - No explicit arg → reads from AsyncLocalStorage (set by session middleware)
 * - Neither → falls back to the legacy default draft.db (single-user compat)
 */
export function getDb(sessionId?: string): Database {
  const resolved = sessionId ?? sessionStorage.getStore();
  const key = resolved ?? DEFAULT_KEY;
  const cached = _dbCache.get(key);
  if (cached) return cached;

  const dbPath = resolved
    ? `${DATA_DIR}/${resolved}.db`
    : DEFAULT_DB_PATH;

  const db = new Database(dbPath);
  db.run("PRAGMA journal_mode = WAL");
  db.run("PRAGMA synchronous = NORMAL");
  initSchema(db);
  _dbCache.set(key, db);
  return db;
}

function initSchema(db: Database): void {
  // Cache table for HTTP responses
  db.run(`CREATE TABLE IF NOT EXISTS cache (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  )`);

  // League config table
  db.run(`CREATE TABLE IF NOT EXISTS league_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platform TEXT NOT NULL,
    league_id TEXT NOT NULL,
    league_name TEXT,
    season INTEGER NOT NULL,
    scoring_type TEXT DEFAULT 'ppr',
    total_teams INTEGER DEFAULT 12,
    roster_positions TEXT DEFAULT '[]',
    draft_id TEXT,
    my_pick_slot INTEGER,
    settings_json TEXT DEFAULT '{}',
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch()),
    UNIQUE(platform, league_id, season)
  )`);

  // Player watchlist
  db.run(`CREATE TABLE IF NOT EXISTS watchlist (
    player_id TEXT NOT NULL,
    platform TEXT NOT NULL,
    note TEXT DEFAULT '',
    tier INTEGER DEFAULT 0,
    added_at INTEGER DEFAULT (unixepoch()),
    PRIMARY KEY(player_id, platform)
  )`);

  // Draft picks log (for mock/offline tracking)
  db.run(`CREATE TABLE IF NOT EXISTS draft_picks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    draft_id TEXT NOT NULL,
    platform TEXT NOT NULL,
    pick_no INTEGER NOT NULL,
    round INTEGER NOT NULL,
    slot INTEGER NOT NULL,
    player_id TEXT,
    player_name TEXT,
    position TEXT,
    team_name TEXT,
    roster_id INTEGER,
    is_my_pick INTEGER DEFAULT 0,
    is_keeper INTEGER DEFAULT 0,
    picked_at INTEGER DEFAULT (unixepoch()),
    UNIQUE(draft_id, pick_no)
  )`);

  // Chat history for Zo chatbot
  db.run(`CREATE TABLE IF NOT EXISTS chat_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    context_json TEXT DEFAULT '{}',
    created_at INTEGER DEFAULT (unixepoch())
  )`);

  // Custom player notes/rankings
  db.run(`CREATE TABLE IF NOT EXISTS player_notes (
    player_id TEXT PRIMARY KEY,
    custom_rank INTEGER,
    do_not_draft INTEGER DEFAULT 0,
    note TEXT DEFAULT '',
    updated_at INTEGER DEFAULT (unixepoch())
  )`);

  // Season manager: one row per team per league per season
  db.run(`CREATE TABLE IF NOT EXISTS teams (
    platform TEXT NOT NULL,
    league_id TEXT NOT NULL,
    season INTEGER NOT NULL,
    team_ref TEXT NOT NULL,
    owner_name TEXT,
    team_name TEXT,
    is_my_team INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    ties INTEGER DEFAULT 0,
    points_for REAL DEFAULT 0,
    points_against REAL DEFAULT 0,
    updated_at INTEGER DEFAULT (unixepoch()),
    PRIMARY KEY (platform, league_id, season, team_ref)
  )`);

  // Season manager: weekly roster snapshots (queryable trend history, never overwritten across weeks)
  db.run(`CREATE TABLE IF NOT EXISTS roster_players (
    platform TEXT NOT NULL,
    league_id TEXT NOT NULL,
    season INTEGER NOT NULL,
    week INTEGER NOT NULL,
    team_ref TEXT NOT NULL,
    player_id TEXT NOT NULL,
    position TEXT,
    is_starter INTEGER DEFAULT 0,
    snapshot_at INTEGER DEFAULT (unixepoch()),
    PRIMARY KEY (platform, league_id, season, week, team_ref, player_id)
  )`);

  // Season manager: add/drop/trade log, mirrors platform transaction feeds
  db.run(`CREATE TABLE IF NOT EXISTS transactions_log (
    platform TEXT NOT NULL,
    league_id TEXT NOT NULL,
    season INTEGER NOT NULL,
    transaction_id TEXT NOT NULL,
    week INTEGER,
    type TEXT,
    team_refs_json TEXT DEFAULT '[]',
    adds_json TEXT DEFAULT '{}',
    drops_json TEXT DEFAULT '{}',
    created_at INTEGER,
    logged_at INTEGER DEFAULT (unixepoch()),
    PRIMARY KEY (platform, league_id, transaction_id)
  )`);

  // Season manager: generated weekly waiver/trade reports
  db.run(`CREATE TABLE IF NOT EXISTS weekly_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platform TEXT NOT NULL,
    league_id TEXT NOT NULL,
    season INTEGER NOT NULL,
    week INTEGER NOT NULL,
    generated_at INTEGER DEFAULT (unixepoch()),
    report_markdown TEXT,
    report_json TEXT,
    status TEXT DEFAULT 'pending',
    UNIQUE(platform, league_id, season, week)
  )`);
}

// ─── Cache helpers ────────────────────────────────────────────────────────────

export function cacheGet(key: string): string | null {
  try {
    const db = getDb();
    const now = Math.floor(Date.now() / 1000);
    const row = db.query<{ value: string }, [string, number]>(
      "SELECT value FROM cache WHERE key = ? AND expires_at > ?"
    ).get(key, now);
    return row?.value ?? null;
  } catch { return null; }
}

export function cacheSet(key: string, value: string, ttlSeconds: number): void {
  try {
    const db = getDb();
    const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
    db.run(
      "INSERT OR REPLACE INTO cache (key, value, expires_at) VALUES (?, ?, ?)",
      [key, value, expires]
    );
  } catch { /* ignore cache write errors */ }
}

export function cacheInvalidate(prefix: string): void {
  try {
    const db = getDb();
    db.run("DELETE FROM cache WHERE key LIKE ?", [`${prefix}%`]);
  } catch {}
}

// ─── League config ────────────────────────────────────────────────────────────

export interface LeagueConfig {
  id: number;
  platform: "sleeper" | "espn";
  league_id: string;
  league_name: string;
  season: number;
  scoring_type: "ppr" | "half-ppr" | "standard";
  total_teams: number;
  roster_positions: string[];
  draft_id: string | null;
  my_pick_slot: number | null;
  settings_json: Record<string, unknown>;
}

// Resolves which platform the app should default to when a caller doesn't
// pass an explicit ?platform= — the most recently connected/synced league,
// so a user who just connected ESPN (even with a stale old Sleeper config
// lying around) gets routed to ESPN everywhere without every page having to
// know about platform selection.
export function getPrimaryPlatform(): "sleeper" | "espn" {
  const db = getDb();
  const row = db.query<{ platform: string }, []>(
    "SELECT platform FROM league_config ORDER BY updated_at DESC LIMIT 1"
  ).get();
  return (row?.platform as "sleeper" | "espn") ?? "sleeper";
}

export function getLeagueConfigs(): LeagueConfig[] {
  const db = getDb();
  const rows = db.query<{
    id: number; platform: string; league_id: string; league_name: string;
    season: number; scoring_type: string; total_teams: number;
    roster_positions: string; draft_id: string | null; my_pick_slot: number | null;
    settings_json: string;
  }, []>("SELECT * FROM league_config ORDER BY platform, season DESC").all();

  return rows.map(r => ({
    ...r,
    platform: r.platform as "sleeper" | "espn",
    scoring_type: r.scoring_type as "ppr" | "half-ppr" | "standard",
    roster_positions: JSON.parse(r.roster_positions ?? "[]"),
    settings_json: JSON.parse(r.settings_json ?? "{}"),
  }));
}

export function upsertLeagueConfig(config: Omit<LeagueConfig, "id">): void {
  const db = getDb();
  db.run(`INSERT INTO league_config
    (platform, league_id, league_name, season, scoring_type, total_teams,
     roster_positions, draft_id, my_pick_slot, settings_json, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch())
    ON CONFLICT(platform, league_id, season) DO UPDATE SET
      league_name = excluded.league_name,
      scoring_type = excluded.scoring_type,
      total_teams = excluded.total_teams,
      roster_positions = excluded.roster_positions,
      draft_id = excluded.draft_id,
      my_pick_slot = excluded.my_pick_slot,
      settings_json = excluded.settings_json,
      updated_at = unixepoch()`,
    [
      config.platform, config.league_id, config.league_name, config.season,
      config.scoring_type, config.total_teams,
      JSON.stringify(config.roster_positions), config.draft_id,
      config.my_pick_slot, JSON.stringify(config.settings_json),
    ]
  );
}

// ─── Watchlist ────────────────────────────────────────────────────────────────

export interface WatchlistEntry {
  player_id: string;
  platform: string;
  note: string;
  tier: number;
  added_at: number;
}

export function getWatchlist(): WatchlistEntry[] {
  const db = getDb();
  return db.query<WatchlistEntry, []>("SELECT * FROM watchlist ORDER BY tier, added_at").all();
}

export function addToWatchlist(playerId: string, platform: string, note = "", tier = 0): void {
  const db = getDb();
  db.run("INSERT OR IGNORE INTO watchlist (player_id, platform, note, tier) VALUES (?, ?, ?, ?)",
    [playerId, platform, note, tier]);
}

export function removeFromWatchlist(playerId: string, platform: string): void {
  const db = getDb();
  db.run("DELETE FROM watchlist WHERE player_id = ? AND platform = ?", [playerId, platform]);
}

// ─── Player notes ─────────────────────────────────────────────────────────────

export interface PlayerNote {
  player_id: string;
  custom_rank: number | null;
  do_not_draft: boolean;
  note: string;
}

export function getPlayerNotes(): Record<string, PlayerNote> {
  const db = getDb();
  const rows = db.query<{ player_id: string; custom_rank: number | null; do_not_draft: number; note: string }, []>(
    "SELECT * FROM player_notes"
  ).all();
  return Object.fromEntries(rows.map(r => [r.player_id, { ...r, do_not_draft: r.do_not_draft === 1 }]));
}

export function upsertPlayerNote(playerId: string, note: Partial<Omit<PlayerNote, "player_id">>): void {
  const db = getDb();
  db.run(`INSERT INTO player_notes (player_id, custom_rank, do_not_draft, note, updated_at)
    VALUES (?, ?, ?, ?, unixepoch())
    ON CONFLICT(player_id) DO UPDATE SET
      custom_rank = COALESCE(excluded.custom_rank, custom_rank),
      do_not_draft = COALESCE(excluded.do_not_draft, do_not_draft),
      note = COALESCE(excluded.note, note),
      updated_at = unixepoch()`,
    [playerId, note.custom_rank ?? null, note.do_not_draft ? 1 : 0, note.note ?? ""]
  );
}

// ─── Chat history ─────────────────────────────────────────────────────────────

export function getChatHistory(sessionId: string, limit = 20): Array<{ role: string; content: string }> {
  const db = getDb();
  return db.query<{ role: string; content: string }, [string, number]>(
    "SELECT role, content FROM chat_history WHERE session_id = ? ORDER BY id DESC LIMIT ?"
  ).all(sessionId, limit).reverse();
}

export function appendChatHistory(sessionId: string, role: string, content: string, context?: Record<string, unknown>): void {
  const db = getDb();
  db.run("INSERT INTO chat_history (session_id, role, content, context_json) VALUES (?, ?, ?, ?)",
    [sessionId, role, content, JSON.stringify(context ?? {})]
  );
}

// ─── Draft picks ──────────────────────────────────────────────────────────────

export interface DraftPickRecord {
  id?: number;
  draft_id: string;
  platform: string;
  pick_no: number;
  round: number;
  slot: number;
  player_id?: string;
  player_name?: string;
  position?: string;
  team_name?: string;
  roster_id?: number;
  is_my_pick?: boolean;
  is_keeper?: boolean;
}

export function saveDraftPick(pick: DraftPickRecord): void {
  const db = getDb();
  db.run(`INSERT OR REPLACE INTO draft_picks
    (draft_id, platform, pick_no, round, slot, player_id, player_name, position, team_name, roster_id, is_my_pick, is_keeper)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      pick.draft_id, pick.platform, pick.pick_no, pick.round, pick.slot,
      pick.player_id ?? null, pick.player_name ?? null, pick.position ?? null,
      pick.team_name ?? null, pick.roster_id ?? null,
      pick.is_my_pick ? 1 : 0, pick.is_keeper ? 1 : 0,
    ]
  );
}

interface DraftPickRow {
  id: number;
  draft_id: string;
  platform: string;
  pick_no: number;
  round: number;
  slot: number;
  player_id: string | null;
  player_name: string | null;
  position: string | null;
  team_name: string | null;
  roster_id: number | null;
  is_my_pick: number;
  is_keeper: number;
}

export function getDraftPicks(draftId: string, platform: string): DraftPickRecord[] {
  const db = getDb();
  return db.query<DraftPickRow, [string, string]>(
    "SELECT * FROM draft_picks WHERE draft_id = ? AND platform = ? ORDER BY pick_no"
  ).all(draftId, platform).map(r => ({
    id: r.id,
    draft_id: r.draft_id,
    platform: r.platform,
    pick_no: r.pick_no,
    round: r.round,
    slot: r.slot,
    player_id: r.player_id ?? undefined,
    player_name: r.player_name ?? undefined,
    position: r.position ?? undefined,
    team_name: r.team_name ?? undefined,
    roster_id: r.roster_id ?? undefined,
    is_my_pick: r.is_my_pick === 1,
    is_keeper: r.is_keeper === 1,
  }));
}

export function togglePickOwnership(draftId: string, platform: string, pickNo: number): boolean {
  const db = getDb();
  db.run(
    `UPDATE draft_picks SET is_my_pick = 1 - is_my_pick
     WHERE draft_id = ? AND platform = ? AND pick_no = ?`,
    [draftId, platform, pickNo]
  );
  const row = db.query<{ is_my_pick: number }, [string, string, number]>(
    `SELECT is_my_pick FROM draft_picks WHERE draft_id = ? AND platform = ? AND pick_no = ?`
  ).get(draftId, platform, pickNo);
  return row?.is_my_pick === 1;
}

// ─── Season manager: teams ─────────────────────────────────────────────────────

export interface TeamRecord {
  platform: string;
  league_id: string;
  season: number;
  team_ref: string;
  owner_name: string | null;
  team_name: string | null;
  is_my_team: boolean;
  wins: number;
  losses: number;
  ties: number;
  points_for: number;
  points_against: number;
}

interface TeamRow {
  platform: string; league_id: string; season: number; team_ref: string;
  owner_name: string | null; team_name: string | null; is_my_team: number;
  wins: number; losses: number; ties: number; points_for: number; points_against: number;
}

export function upsertTeam(t: TeamRecord): void {
  const db = getDb();
  db.run(`INSERT INTO teams
    (platform, league_id, season, team_ref, owner_name, team_name, is_my_team, wins, losses, ties, points_for, points_against, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch())
    ON CONFLICT(platform, league_id, season, team_ref) DO UPDATE SET
      owner_name = excluded.owner_name,
      team_name = excluded.team_name,
      is_my_team = excluded.is_my_team,
      wins = excluded.wins,
      losses = excluded.losses,
      ties = excluded.ties,
      points_for = excluded.points_for,
      points_against = excluded.points_against,
      updated_at = unixepoch()`,
    [
      t.platform, t.league_id, t.season, t.team_ref, t.owner_name, t.team_name,
      t.is_my_team ? 1 : 0, t.wins, t.losses, t.ties, t.points_for, t.points_against,
    ]
  );
}

export function getTeams(platform: string, leagueId: string, season: number): TeamRecord[] {
  const db = getDb();
  return db.query<TeamRow, [string, string, number]>(
    "SELECT * FROM teams WHERE platform = ? AND league_id = ? AND season = ? ORDER BY team_ref"
  ).all(platform, leagueId, season).map(r => ({ ...r, is_my_team: r.is_my_team === 1 }));
}

export function getMyTeam(platform: string, leagueId: string, season: number): TeamRecord | null {
  const db = getDb();
  const row = db.query<TeamRow, [string, string, number]>(
    "SELECT * FROM teams WHERE platform = ? AND league_id = ? AND season = ? AND is_my_team = 1"
  ).get(platform, leagueId, season);
  return row ? { ...row, is_my_team: row.is_my_team === 1 } : null;
}

// ─── Season manager: roster snapshots ──────────────────────────────────────────

export interface RosterPlayerRecord {
  platform: string;
  league_id: string;
  season: number;
  week: number;
  team_ref: string;
  player_id: string;
  position: string | null;
  is_starter: boolean;
}

export function upsertRosterPlayers(records: RosterPlayerRecord[]): void {
  if (!records.length) return;
  const db = getDb();
  const stmt = db.prepare(`INSERT OR REPLACE INTO roster_players
    (platform, league_id, season, week, team_ref, player_id, position, is_starter, snapshot_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, unixepoch())`);
  db.transaction((rows: RosterPlayerRecord[]) => {
    for (const r of rows) {
      stmt.run(r.platform, r.league_id, r.season, r.week, r.team_ref, r.player_id, r.position, r.is_starter ? 1 : 0);
    }
  })(records);
}

export function getLatestRosterWeek(platform: string, leagueId: string, season: number): number | null {
  const db = getDb();
  const row = db.query<{ w: number | null }, [string, string, number]>(
    "SELECT MAX(week) as w FROM roster_players WHERE platform = ? AND league_id = ? AND season = ?"
  ).get(platform, leagueId, season);
  return row?.w ?? null;
}

interface RosterPlayerRow {
  platform: string; league_id: string; season: number; week: number;
  team_ref: string; player_id: string; position: string | null; is_starter: number;
}

export function getRosterPlayers(
  platform: string, leagueId: string, season: number, week: number, teamRef?: string
): RosterPlayerRecord[] {
  const db = getDb();
  const rows = teamRef
    ? db.query<RosterPlayerRow, [string, string, number, number, string]>(
        "SELECT * FROM roster_players WHERE platform = ? AND league_id = ? AND season = ? AND week = ? AND team_ref = ?"
      ).all(platform, leagueId, season, week, teamRef)
    : db.query<RosterPlayerRow, [string, string, number, number]>(
        "SELECT * FROM roster_players WHERE platform = ? AND league_id = ? AND season = ? AND week = ?"
      ).all(platform, leagueId, season, week);
  return rows.map(r => ({ ...r, is_starter: r.is_starter === 1 }));
}

// ─── Season manager: transactions ──────────────────────────────────────────────

export interface TransactionRecord {
  platform: string;
  league_id: string;
  season: number;
  transaction_id: string;
  week: number | null;
  type: string;
  team_refs: string[];
  adds: Record<string, string>;
  drops: Record<string, string>;
  created_at: number | null;
}

export function logTransaction(t: TransactionRecord): void {
  const db = getDb();
  db.run(`INSERT OR IGNORE INTO transactions_log
    (platform, league_id, season, transaction_id, week, type, team_refs_json, adds_json, drops_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      t.platform, t.league_id, t.season, t.transaction_id, t.week, t.type,
      JSON.stringify(t.team_refs), JSON.stringify(t.adds), JSON.stringify(t.drops), t.created_at,
    ]
  );
}

export function getTransactions(
  platform: string, leagueId: string, season: number, week?: number
): TransactionRecord[] {
  const db = getDb();
  interface Row {
    platform: string; league_id: string; season: number; transaction_id: string;
    week: number | null; type: string; team_refs_json: string; adds_json: string;
    drops_json: string; created_at: number | null;
  }
  const rows = week != null
    ? db.query<Row, [string, string, number, number]>(
        "SELECT * FROM transactions_log WHERE platform = ? AND league_id = ? AND season = ? AND week = ? ORDER BY created_at DESC"
      ).all(platform, leagueId, season, week)
    : db.query<Row, [string, string, number]>(
        "SELECT * FROM transactions_log WHERE platform = ? AND league_id = ? AND season = ? ORDER BY created_at DESC"
      ).all(platform, leagueId, season);
  return rows.map(r => ({
    ...r,
    team_refs: JSON.parse(r.team_refs_json ?? "[]"),
    adds: JSON.parse(r.adds_json ?? "{}"),
    drops: JSON.parse(r.drops_json ?? "{}"),
  }));
}

// ─── Season manager: weekly reports ────────────────────────────────────────────

export interface WeeklyReportRecord {
  id?: number;
  platform: string;
  league_id: string;
  season: number;
  week: number;
  generated_at?: number;
  report_markdown: string;
  report_json: Record<string, unknown>;
  status: string;
}

export function upsertWeeklyReport(r: WeeklyReportRecord): void {
  const db = getDb();
  db.run(`INSERT INTO weekly_reports
    (platform, league_id, season, week, report_markdown, report_json, status, generated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, unixepoch())
    ON CONFLICT(platform, league_id, season, week) DO UPDATE SET
      report_markdown = excluded.report_markdown,
      report_json = excluded.report_json,
      status = excluded.status,
      generated_at = unixepoch()`,
    [r.platform, r.league_id, r.season, r.week, r.report_markdown, JSON.stringify(r.report_json), r.status]
  );
}

export function getWeeklyReport(
  platform: string, leagueId: string, season: number, week: number
): WeeklyReportRecord | null {
  const db = getDb();
  interface Row {
    id: number; platform: string; league_id: string; season: number; week: number;
    generated_at: number; report_markdown: string; report_json: string; status: string;
  }
  const row = db.query<Row, [string, string, number, number]>(
    "SELECT * FROM weekly_reports WHERE platform = ? AND league_id = ? AND season = ? AND week = ?"
  ).get(platform, leagueId, season, week);
  return row ? { ...row, report_json: JSON.parse(row.report_json ?? "{}") } : null;
}

export function getWeeklyReports(
  platform: string, leagueId: string, season: number, limit = 10
): WeeklyReportRecord[] {
  const db = getDb();
  interface Row {
    id: number; platform: string; league_id: string; season: number; week: number;
    generated_at: number; report_markdown: string; report_json: string; status: string;
  }
  const rows = db.query<Row, [string, string, number, number]>(
    "SELECT * FROM weekly_reports WHERE platform = ? AND league_id = ? AND season = ? ORDER BY week DESC LIMIT ?"
  ).all(platform, leagueId, season, limit);
  return rows.map(r => ({ ...r, report_json: JSON.parse(r.report_json ?? "{}") }));
}
