import { useEffect, useState, useCallback } from "react";
import { RotateCcw, Loader2, RefreshCw, ArrowLeftRight, Sparkles, Radio } from "lucide-react";
import { withPlatform } from "@/lib/platform";

interface Player {
  rank: number;
  player_id: string | null;
  name: string;
  position: string;
  team: string | null;
  bye: number | null;
  ecr: number | null;
  tier: number | null;
  positionRank: string | null;
  adp: number | null;
  is_drafted: boolean;
  is_my_pick: boolean;
  drafted_at_pick: number | null;
  injury_status: string | null;
  injury_body_part: string | null;
  do_not_draft: boolean;
}

interface Pick {
  pick_no: number;
  player_name: string;
  position: string;
  is_my_pick: boolean;
  round: number;
  slot: number;
}

interface DraftState {
  picks: Pick[];
  total_picks: number;
  current_round: number;
  next_pick_no: number;
  total_teams: number;
  my_slot: number | null;
  rounds: number;
  is_offline: boolean;
  is_complete: boolean;
}

const POS_TEXT: Record<string, string> = {
  QB: "text-rose-600 dark:text-rose-400",
  RB: "text-emerald-600 dark:text-emerald-400",
  WR: "text-sky-600 dark:text-sky-400",
  TE: "text-amber-600 dark:text-amber-400",
  K: "text-zinc-500",
  DST: "text-purple-600 dark:text-purple-400",
  DEF: "text-purple-600 dark:text-purple-400",
};

const POS_BG: Record<string, string> = {
  QB: "bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300",
  RB: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300",
  WR: "bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-300",
  TE: "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300",
  K: "bg-zinc-100 dark:bg-zinc-800 text-zinc-500",
  DST: "bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300",
  DEF: "bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300",
};

const STARTER_SLOTS = ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "FLEX", "K", "DEF"];
const POSITIONS = ["ALL", "QB", "RB", "WR", "TE", "K", "DST"];

function rowKey(p: Player): string {
  return p.player_id ?? p.name;
}

function isRowPicking(pickingId: string | null, p: Player): boolean {
  return pickingId !== null && pickingId === rowKey(p);
}

function fitsSlot(slot: string, pos: string): boolean {
  if (slot === pos) return true;
  if (slot === "FLEX" && ["RB", "WR", "TE"].includes(pos)) return true;
  if (slot === "DEF" && pos === "DST") return true;
  return false;
}

function fillRoster(slots: string[], myTeam: Pick[]): (Pick | null)[] {
  const filled: (Pick | null)[] = Array(slots.length).fill(null);
  const used = new Set<number>();
  for (const pass of ["exact", "flex"] as const) {
    slots.forEach((slot, si) => {
      if (filled[si]) return;
      for (const pick of myTeam) {
        if (used.has(pick.pick_no)) continue;
        const exact = slot === pick.position || (slot === "DEF" && pick.position === "DST");
        const flex = slot === "FLEX" && ["RB", "WR", "TE"].includes(pick.position);
        if ((pass === "exact" && exact) || (pass === "flex" && flex && !exact)) {
          filled[si] = pick;
          used.add(pick.pick_no);
          return;
        }
      }
    });
  }
  return filled;
}

function injuryDot(status: string) {
  if (["Out", "IR", "PUP"].includes(status)) return "bg-rose-500";
  if (status === "Doubtful") return "bg-orange-500";
  return "bg-amber-400";
}

export default function Draft({ platform }: { platform?: string | null }) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [loading, setLoading] = useState(true);
  const [pos, setPos] = useState("ALL");
  const [query, setQuery] = useState("");
  const [pickingId, setPickingId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [liveMode, setLiveMode] = useState(() => sessionStorage.getItem("liveDraftMode") === "1");
  const [autopicking, setAutopicking] = useState(false);
  const [toggling, setToggling] = useState<number | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [secondsAgoTick, setSecondsAgoTick] = useState(0);

  const loadAll = useCallback(async () => {
    const [pRes, dRes] = await Promise.all([
      fetch(withPlatform("/api/players?limit=600&drafted=true", platform)).then(r => r.json()),
      fetch(withPlatform("/api/draft/state", platform)).then(r => r.json()),
    ]);
    setPlayers(pRes.players ?? []);
    setDraft(dRes);
    setLoading(false);
  }, [platform]);

  useEffect(() => { setLoading(true); loadAll(); }, [loadAll]);

  useEffect(() => {
    sessionStorage.setItem("liveDraftMode", liveMode ? "1" : "0");
  }, [liveMode]);

  // While a real (non-offline) Sleeper draft hasn't finished, keep pulling
  // live picks in the background — this is also what triggers the automatic
  // team/roster sync the moment Sleeper reports the draft complete. Fires
  // immediately on mount (rather than waiting a full interval) so opening
  // the page never shows a stale board, then every 3s.
  //
  // ESPN is intentionally excluded: their public read API lags their own
  // draft room by minutes during a live draft (confirmed directly against
  // ESPN's API showing 0 picks while picks had actually been made), so
  // auto-polling it just produces a confidently-wrong "synced" board.
  // Manual pick recording is the reliable path for ESPN — see the banner
  // below.
  const isEspn = platform === "espn";
  useEffect(() => {
    if (!draft || draft.is_offline || draft.is_complete || liveMode || isEspn) return;
    let cancelled = false;
    const runSync = () => {
      fetch(withPlatform("/api/draft/sync", platform), { method: "POST" })
        .then(() => loadAll())
        .then(() => { if (!cancelled) setLastSyncedAt(Date.now()); });
    };
    runSync();
    const id = setInterval(runSync, 3000);
    return () => { cancelled = true; clearInterval(id); };
  }, [draft?.is_offline, draft?.is_complete, liveMode, loadAll, platform, isEspn]);

  // Ticks once a second purely to keep the "synced Xs ago" label fresh —
  // only runs under the same conditions as the poll above.
  useEffect(() => {
    if (!draft || draft.is_offline || draft.is_complete || liveMode || isEspn) return;
    const id = setInterval(() => setSecondsAgoTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [draft?.is_offline, draft?.is_complete, liveMode, isEspn]);

  const filtered = players.filter(p => {
    if (pos !== "ALL" && p.position !== pos) return false;
    if (query && !p.name.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  const myTeam = draft?.picks.filter(p => p.is_my_pick) ?? [];
  const rosterFilled = fillRoster(STARTER_SLOTS, myTeam);
  const benchPicks = myTeam.filter(
    pick => !STARTER_SLOTS.some((_, si) => rosterFilled[si]?.pick_no === pick.pick_no)
  );

  async function recordPick(player: Player, isMyPick: boolean) {
    setPickingId(rowKey(player));
    await fetch("/api/draft/pick", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platform,
        player_id: player.player_id,
        player_name: player.name,
        position: player.position,
        team_name: player.team,
        is_my_pick: isMyPick,
      }),
    });
    if (liveMode && isMyPick) {
      setAutopicking(true);
      await fetch(withPlatform("/api/draft/autopick-opponents", platform), { method: "POST" });
      setAutopicking(false);
    }
    await loadAll();
    setPickingId(null);
  }

  async function startLiveDraft() {
    if (!confirm("Start a live draft? This resets any existing picks. You'll draft your own team pick by pick — other teams auto-pick instantly between your turns.")) return;
    setSimulating(true);
    await fetch(withPlatform("/api/draft/reset", platform), { method: "POST" });
    setLiveMode(true);
    await fetch(withPlatform("/api/draft/autopick-opponents", platform), { method: "POST" });
    await loadAll();
    setSimulating(false);
  }

  async function undoPick() {
    await fetch(withPlatform("/api/draft/undo", platform), { method: "POST" });
    await loadAll();
  }

  async function syncDraft() {
    setSyncing(true);
    await fetch(withPlatform("/api/draft/sync", platform), { method: "POST" });
    await loadAll();
    setLastSyncedAt(Date.now());
    setSyncing(false);
  }

  async function simulateFullDraft() {
    if (!confirm("Simulate a full 15-round draft for all 12 teams? This resets any existing picks.")) return;
    setSimulating(true);
    setLiveMode(false);
    await fetch(withPlatform("/api/draft/simulate", platform), { method: "POST" });
    await loadAll();
    setSimulating(false);
  }

  async function toggleOwnership(pickNo: number) {
    setToggling(pickNo);
    await fetch("/api/draft/pick", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pick_no: pickNo, platform }),
    });
    await loadAll();
    setToggling(null);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <Loader2 className="size-5 animate-spin text-zinc-400" />
      </main>
    );
  }

  const pickNo = draft?.next_pick_no ?? 1;
  const round = draft?.current_round ?? 1;
  const totalTeams = draft?.total_teams ?? 12;
  const mySlot = draft?.my_slot;
  const isMyPick = mySlot != null && (
    round % 2 === 1
      ? ((pickNo - 1) % totalTeams) + 1 === mySlot
      : totalTeams - ((pickNo - 1) % totalTeams) === mySlot
  );

  return (
    <main className="h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col overflow-hidden">

      {/* ── Top bar ──────────────────────────────────────────────── */}
      <header className="flex items-center gap-3 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-4 py-2 shrink-0">

        {/* Pick context */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-md px-2.5 py-1">
            <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Rd</span>
            <span className="text-sm font-black text-zinc-900 dark:text-white tabular-nums">{round}</span>
            <span className="text-zinc-300 dark:text-zinc-600 text-xs">·</span>
            <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Pk</span>
            <span className="text-sm font-black text-zinc-900 dark:text-white tabular-nums">{pickNo}</span>
          </div>

          {/* MY PICK indicator */}
          {mySlot && (
            isMyPick ? (
              <div className="flex items-center gap-1.5 rounded-md bg-emerald-500 px-2.5 py-1">
                <span className="size-1.5 rounded-full bg-white animate-pulse" />
                <span className="text-[11px] font-black text-white tracking-wide uppercase">
                  {autopicking ? "Waiting…" : "Your Pick"}
                </span>
              </div>
            ) : (
              <span className="text-[11px] text-zinc-400 dark:text-zinc-500 font-medium">Slot #{mySlot}</span>
            )
          )}

          {liveMode && (
            <div className="flex items-center gap-1 rounded-full border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5">
              <Radio className="size-3 text-emerald-500" />
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 tracking-wide">LIVE</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          <button
            onClick={startLiveDraft}
            disabled={simulating || autopicking}
            title="Draft your team live, pick by pick"
            className="flex items-center gap-1.5 rounded-md border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors disabled:opacity-40"
          >
            {simulating ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
            Live Draft
          </button>
          <button
            onClick={simulateFullDraft}
            disabled={simulating}
            title="Simulate a full 15-round draft"
            className="flex items-center gap-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2.5 py-1 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:border-zinc-400 transition-colors disabled:opacity-40"
          >
            {simulating ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
            Simulate
          </button>
          <button
            onClick={syncDraft}
            disabled={syncing}
            title={isEspn ? "Check ESPN for picks (their feed lags — record manually below instead)" : "Sync live draft picks"}
            className="flex items-center gap-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2.5 py-1 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:border-zinc-400 transition-colors disabled:opacity-40"
          >
            <RefreshCw className={`size-3 ${syncing ? "animate-spin" : ""}`} />
            Sync
          </button>
          {draft && !draft.is_offline && !draft.is_complete && !liveMode && isEspn && (
            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
              ESPN doesn't live-update — click a player to record picks
            </span>
          )}
          {draft && !draft.is_offline && !draft.is_complete && !liveMode && !isEspn && lastSyncedAt && (
            <span key={secondsAgoTick} className="text-[10px] text-zinc-400 dark:text-zinc-500 tabular-nums">
              synced {Math.max(0, Math.round((Date.now() - lastSyncedAt) / 1000))}s ago
            </span>
          )}
          <button
            onClick={undoPick}
            className="flex items-center gap-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2.5 py-1 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:border-zinc-400 transition-colors"
          >
            <RotateCcw className="size-3" /> Undo
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">

        {/* ── Big Board ───────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Filters */}
          <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
            <div className="flex gap-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-md p-0.5">
              {POSITIONS.map(p => (
                <button
                  key={p}
                  onClick={() => setPos(p)}
                  className={`rounded-sm px-2 py-1 text-[11px] font-bold transition-colors ${
                    pos === p
                      ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm"
                      : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search…"
              className="ml-auto h-7 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2.5 text-xs outline-none focus:ring-1 ring-zinc-400 w-32 placeholder:text-zinc-400"
            />
          </div>

          {/* Table */}
          <div className="flex-1 overflow-y-auto bg-white dark:bg-zinc-900">
            <div className="min-w-[520px]">
              <table className="w-full">
                <thead className="sticky top-0 bg-zinc-50 dark:bg-zinc-800/80 backdrop-blur-sm border-b border-zinc-200 dark:border-zinc-700 z-10">
                  <tr className="text-[10px] text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-wider">
                    <th className="px-3 py-2 text-left w-9">#</th>
                    <th className="px-3 py-2 text-left">Player</th>
                    <th className="px-3 py-2 text-center w-14">POS</th>
                    <th className="px-3 py-2 text-center w-10">BYE</th>
                    <th className="px-3 py-2 text-center w-10">T</th>
                    <th className="px-3 py-2 text-right pr-3 w-28">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.reduce<{ rows: React.ReactNode[]; lastTier: number | null }>(
                    ({ rows, lastTier }, p, i) => {
                      const tier = p.tier ?? 99;
                      const showDivider = !p.is_drafted && tier !== lastTier && lastTier !== null;

                      const divider = showDivider ? (
                        <tr key={`tier-${tier}-${i}`} className="bg-zinc-50 dark:bg-zinc-800/60">
                          <td colSpan={6} className="px-3 py-1 text-[9px] font-black uppercase tracking-widest text-zinc-300 dark:text-zinc-600">
                            ── Tier {tier}
                          </td>
                        </tr>
                      ) : null;

                      const row = (
                        <tr
                          key={p.player_id ?? p.name}
                          className={`border-t border-zinc-100 dark:border-zinc-800/60 transition-colors ${
                            p.is_drafted
                              ? "opacity-20"
                              : isMyPick
                                ? "hover:bg-emerald-50 dark:hover:bg-emerald-900/10"
                                : "hover:bg-zinc-50 dark:hover:bg-zinc-800/30"
                          } ${p.is_my_pick ? "bg-emerald-50/40 dark:bg-emerald-900/10" : ""}`}
                        >
                          <td className="px-3 py-2 tabular-nums text-[11px] font-mono text-zinc-300 dark:text-zinc-600">{p.rank}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">{p.name}</span>
                              {p.do_not_draft && (
                                <span className="rounded px-1 py-0.5 text-[9px] font-black bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 leading-none">DND</span>
                              )}
                              {p.injury_status && (
                                <span
                                  title={`${p.injury_status}${p.injury_body_part ? " — " + p.injury_body_part : ""}`}
                                  className={`inline-flex size-1.5 rounded-full shrink-0 ${injuryDot(p.injury_status)}`}
                                />
                              )}
                            </div>
                            <div className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                              {p.team ?? "FA"}
                              {p.is_drafted && p.drafted_at_pick ? <span className="ml-1">· Pk {p.drafted_at_pick}</span> : null}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${POS_BG[p.position] ?? "bg-zinc-100 text-zinc-500"}`}>
                              {p.position}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center text-[11px] text-zinc-400 dark:text-zinc-500 tabular-nums">{p.bye ?? "–"}</td>
                          <td className="px-3 py-2 text-center text-[11px] font-bold text-zinc-500 dark:text-zinc-400 tabular-nums">{p.tier ?? "–"}</td>
                          <td className="px-3 py-2 text-right">
                            {!p.is_drafted && (
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => recordPick(p, true)}
                                  disabled={isRowPicking(pickingId, p) || autopicking || (liveMode && !isMyPick)}
                                  title={liveMode && !isMyPick ? "Waiting for your turn" : "Record as my pick"}
                                  className="rounded-md bg-emerald-500 hover:bg-emerald-400 text-white text-[11px] px-2.5 py-1 font-bold transition-colors disabled:opacity-40"
                                >
                                  {isRowPicking(pickingId, p) ? "…" : "Mine"}
                                </button>
                                {!liveMode && (
                                  <button
                                    onClick={() => recordPick(p, false)}
                                    disabled={isRowPicking(pickingId, p)}
                                    className="rounded-md border border-zinc-200 dark:border-zinc-700 text-[11px] px-2.5 py-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:border-zinc-400 transition-colors disabled:opacity-40"
                                    title="Record as another team's pick"
                                  >
                                    Them
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                      return { rows: [...rows, divider, row], lastTier: p.is_drafted ? lastTier : tier };
                    },
                    { rows: [], lastTier: null }
                  ).rows}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── Right panel: My Team + Recent Picks ─────────────────── */}
        <aside className="hidden lg:flex w-64 bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 flex-col overflow-hidden shrink-0">

          {/* Roster header */}
          <div className="px-3 py-2 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/50 shrink-0">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">My Roster</h2>
            {myTeam.length > 0 && (
              <span className="text-[10px] font-bold text-zinc-400 bg-zinc-100 dark:bg-zinc-800 rounded-full px-1.5 py-0.5">{myTeam.length}</span>
            )}
          </div>

          {/* Roster slots */}
          <div className="flex-1 overflow-y-auto">

            {/* Starters */}
            <div className="py-1">
              {STARTER_SLOTS.map((slot, si) => {
                const pick = rosterFilled[si];
                return (
                  <div
                    key={`${slot}-${si}`}
                    className={`flex items-center gap-2 px-3 py-1.5 ${!pick ? "opacity-30" : ""}`}
                  >
                    <span className="text-[9px] font-black w-7 text-zinc-400 dark:text-zinc-500 shrink-0 uppercase tracking-wide">{slot}</span>
                    {pick ? (
                      <>
                        <span className={`text-[10px] font-bold w-7 shrink-0 ${POS_TEXT[pick.position] ?? ""}`}>{pick.position}</span>
                        <span className="text-xs flex-1 truncate text-zinc-800 dark:text-zinc-200 font-medium">{pick.player_name}</span>
                        <button
                          onClick={() => toggleOwnership(pick.pick_no)}
                          disabled={toggling === pick.pick_no}
                          title="Reassign pick"
                          className="ml-auto shrink-0 text-zinc-200 dark:text-zinc-700 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors disabled:opacity-40"
                        >
                          {toggling === pick.pick_no
                            ? <Loader2 className="size-3 animate-spin" />
                            : <ArrowLeftRight className="size-3" />}
                        </button>
                      </>
                    ) : (
                      <span className="text-[11px] text-zinc-200 dark:text-zinc-700">—</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Bench */}
            {benchPicks.length > 0 && (
              <div className="border-t border-zinc-100 dark:border-zinc-800 pt-1">
                <div className="px-3 py-1 text-[9px] font-black text-zinc-300 dark:text-zinc-600 uppercase tracking-widest">Bench</div>
                {benchPicks.map(pick => (
                  <div key={pick.pick_no} className="flex items-center gap-2 px-3 py-1.5">
                    <span className="text-[9px] font-black w-7 text-zinc-300 dark:text-zinc-600 uppercase tracking-wide shrink-0">BN</span>
                    <span className={`text-[10px] font-bold w-7 shrink-0 ${POS_TEXT[pick.position] ?? ""}`}>{pick.position}</span>
                    <span className="text-xs flex-1 truncate text-zinc-800 dark:text-zinc-200 font-medium">{pick.player_name}</span>
                    <button
                      onClick={() => toggleOwnership(pick.pick_no)}
                      disabled={toggling === pick.pick_no}
                      title="Reassign pick"
                      className="ml-auto shrink-0 text-zinc-200 dark:text-zinc-700 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors disabled:opacity-40"
                    >
                      {toggling === pick.pick_no
                        ? <Loader2 className="size-3 animate-spin" />
                        : <ArrowLeftRight className="size-3" />}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {myTeam.length === 0 && (
              <p className="px-3 py-5 text-[11px] text-zinc-400 dark:text-zinc-600 italic">No picks yet. Click "Mine" to record your picks.</p>
            )}
          </div>

          {/* Recent picks */}
          <div className="border-t border-zinc-200 dark:border-zinc-800 shrink-0">
            <div className="px-3 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-between">
              <h2 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Recent Picks</h2>
              {(draft?.picks.length ?? 0) > 0 && (
                <span className="text-[10px] font-bold text-zinc-400 bg-zinc-100 dark:bg-zinc-800 rounded-full px-1.5 py-0.5">{draft?.picks.length}</span>
              )}
            </div>
            <div className="max-h-40 overflow-y-auto">
              {[...(draft?.picks ?? [])].reverse().slice(0, 12).map(pick => (
                <div
                  key={pick.pick_no}
                  className={`flex items-center gap-2 px-3 py-1.5 border-b border-zinc-100 dark:border-zinc-800/60 last:border-0 group ${pick.is_my_pick ? "bg-emerald-50/40 dark:bg-emerald-900/10" : ""}`}
                >
                  <span className="text-[10px] text-zinc-400 tabular-nums font-mono w-5 shrink-0">{pick.pick_no}</span>
                  <span className={`text-[10px] font-bold w-7 shrink-0 ${POS_TEXT[pick.position] ?? ""}`}>{pick.position}</span>
                  <span className="text-xs flex-1 truncate text-zinc-800 dark:text-zinc-200">{pick.player_name}</span>
                  {pick.is_my_pick && (
                    <span className="text-[9px] font-black text-emerald-500 shrink-0">✓</span>
                  )}
                  <button
                    onClick={() => toggleOwnership(pick.pick_no)}
                    disabled={toggling === pick.pick_no}
                    title={pick.is_my_pick ? "Move to others" : "Claim as mine"}
                    className="shrink-0 opacity-0 group-hover:opacity-100 text-zinc-300 dark:text-zinc-600 hover:text-zinc-700 dark:hover:text-zinc-300 transition-all disabled:opacity-40"
                  >
                    {toggling === pick.pick_no
                      ? <Loader2 className="size-3 animate-spin" />
                      : <ArrowLeftRight className="size-3" />}
                  </button>
                </div>
              ))}
              {(draft?.picks.length ?? 0) === 0 && (
                <p className="px-3 py-3 text-[11px] text-zinc-400 dark:text-zinc-600 italic">No picks recorded yet.</p>
              )}
            </div>
          </div>

        </aside>
      </div>
    </main>
  );
}
