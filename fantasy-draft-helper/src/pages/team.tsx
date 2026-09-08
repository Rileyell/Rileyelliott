import { useEffect, useState, useCallback } from "react";
import { Loader2, RefreshCw, ShieldAlert, Sparkles } from "lucide-react";
import { withPlatform } from "@/lib/platform";

interface RosterPlayer {
  player_id: string;
  name: string;
  position: string;
  team: string | null;
  is_starter: boolean;
  ecr: number | null;
  tier: number | null;
  injury_status: string | null;
  injury_body_part: string | null;
  bye: number | null;
  projected_points: number | null;
  insight: string;
}

interface TeamSummary {
  league: { platform: string; league_id: string; league_name: string };
  week: number;
  projection_week: number | "draft";
  roster_slots: string[];
  team: { team_name: string | null; owner_name: string | null; wins: number; losses: number; ties: number };
  starters: RosterPlayer[];
  bench: RosterPlayer[];
}

const POS_BG: Record<string, string> = {
  QB: "bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300",
  RB: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300",
  WR: "bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-300",
  TE: "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300",
  K: "bg-zinc-100 dark:bg-zinc-800 text-zinc-500",
  DST: "bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300",
  DEF: "bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300",
};

function injuryDot(status: string) {
  if (["Out", "IR", "PUP"].includes(status)) return "bg-rose-500";
  if (status === "Doubtful") return "bg-orange-500";
  return "bg-amber-400";
}

// Assign starters to display slots (QB/RB/RB/WR/WR/TE/FLEX/FLEX/K/DEF) using
// an exact-match pass then a FLEX-eligible pass — mirrors draft.tsx's fillRoster.
function fillSlots(slots: string[], starters: RosterPlayer[]): (RosterPlayer | null)[] {
  const filled: (RosterPlayer | null)[] = Array(slots.length).fill(null);
  const used = new Set<string>();
  for (const pass of ["exact", "flex"] as const) {
    slots.forEach((slot, si) => {
      if (filled[si]) return;
      for (const p of starters) {
        if (used.has(p.player_id)) continue;
        const exact = slot === p.position || (slot === "DEF" && p.position === "DST");
        const flex = slot === "FLEX" && ["RB", "WR", "TE"].includes(p.position);
        if ((pass === "exact" && exact) || (pass === "flex" && flex && !exact)) {
          filled[si] = p;
          used.add(p.player_id);
          return;
        }
      }
    });
  }
  return filled;
}

function PlayerRow({ player, slotLabel }: { player: RosterPlayer; slotLabel?: string }) {
  return (
    <div className="flex items-start gap-3 px-3 py-2.5 border-t border-zinc-100 dark:border-zinc-800/60 first:border-t-0">
      {slotLabel && (
        <span className="text-[9px] font-black w-7 pt-0.5 text-zinc-400 dark:text-zinc-500 shrink-0 uppercase tracking-wide">{slotLabel}</span>
      )}
      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 mt-0.5 ${POS_BG[player.position] ?? "bg-zinc-100 text-zinc-500"}`}>
        {player.position}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">{player.name}</span>
          {player.injury_status && (
            <span
              title={`${player.injury_status}${player.injury_body_part ? " — " + player.injury_body_part : ""}`}
              className={`inline-flex size-1.5 rounded-full shrink-0 ${injuryDot(player.injury_status)}`}
            />
          )}
          <span className="text-[11px] text-zinc-400 dark:text-zinc-500">{player.team ?? "FA"}</span>
          {player.bye != null && (
            <span className="text-[10px] text-zinc-300 dark:text-zinc-600">Bye {player.bye}</span>
          )}
        </div>
        <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mt-0.5 leading-snug">{player.insight}</p>
      </div>
      <div className="text-right shrink-0 pt-0.5">
        {player.projected_points != null ? (
          <>
            <div className="text-sm font-black text-zinc-900 dark:text-zinc-100 tabular-nums">{player.projected_points.toFixed(1)}</div>
            <div className="text-[9px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">pts</div>
          </>
        ) : (
          <div className="text-[11px] text-zinc-300 dark:text-zinc-600">—</div>
        )}
      </div>
    </div>
  );
}

export default function Team({ platform }: { platform?: string | null }) {
  const [data, setData] = useState<TeamSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [notSynced, setNotSynced] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setNotSynced(false);
    try {
      const res = await fetch(withPlatform("/api/team/summary", platform));
      if (res.status === 404) {
        setNotSynced(true);
        setData(null);
      } else if (res.ok) {
        setData(await res.json());
      } else {
        setError("Failed to load your team.");
      }
    } catch {
      setError("Failed to load your team.");
    } finally {
      setLoading(false);
    }
  }, [platform]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  async function syncNow() {
    setSyncing(true);
    try {
      await fetch("/api/season/sync", { method: "POST" });
      await load();
    } finally {
      setSyncing(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col items-center justify-center gap-2">
        <Loader2 className="size-5 animate-spin text-zinc-400" />
        <p className="text-xs text-zinc-400 dark:text-zinc-500">Analyzing your roster — this can take up to a minute…</p>
      </main>
    );
  }

  if (notSynced) {
    return (
      <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center px-4">
        <div className="max-w-sm text-center">
          <ShieldAlert className="size-8 text-zinc-300 dark:text-zinc-700 mx-auto mb-3" />
          <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-1">Your draft is done — now sync your team</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
            Pull your finished roster from Sleeper to see your starting lineup, bench, and weekly outlook here.
          </p>
          <button
            onClick={syncNow}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500 hover:bg-emerald-400 text-white text-sm px-4 py-2 font-bold transition-colors disabled:opacity-50"
          >
            {syncing ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
            Sync with Sleeper
          </button>
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <p className="text-sm text-rose-500">{error ?? "Something went wrong."}</p>
      </main>
    );
  }

  const filled = fillSlots(data.roster_slots, data.starters);
  const projLabel = data.projection_week === "draft" ? "Season" : `Week ${data.projection_week}`;

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <header className="flex items-center gap-3 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-4 py-3">
        <div>
          <h1 className="text-sm font-black text-zinc-900 dark:text-white">{data.team.team_name ?? "My Team"}</h1>
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
            {data.league.league_name} · {data.team.wins}-{data.team.losses}{data.team.ties ? `-${data.team.ties}` : ""} · {projLabel} projections
          </p>
        </div>
        <button
          onClick={syncNow}
          disabled={syncing}
          title="Re-sync with Sleeper"
          className="ml-auto flex items-center gap-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2.5 py-1 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:border-zinc-400 transition-colors disabled:opacity-40"
        >
          <RefreshCw className={`size-3 ${syncing ? "animate-spin" : ""}`} />
          Sync
        </button>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
          <div className="px-3 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 flex items-center gap-1.5">
            <Sparkles className="size-3 text-emerald-500" />
            <h2 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Starting Lineup</h2>
          </div>
          {filled.map((p, i) => p ? (
            <PlayerRow key={p.player_id} player={p} slotLabel={data.roster_slots[i]} />
          ) : (
            <div key={`empty-${i}`} className="flex items-center gap-3 px-3 py-2.5 border-t border-zinc-100 dark:border-zinc-800/60 first:border-t-0 opacity-30">
              <span className="text-[9px] font-black w-7 text-zinc-400 uppercase tracking-wide">{data.roster_slots[i]}</span>
              <span className="text-[11px] text-zinc-300 dark:text-zinc-700">Empty slot</span>
            </div>
          ))}
        </section>

        {data.bench.length > 0 && (
          <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
            <div className="px-3 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
              <h2 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Bench</h2>
            </div>
            {data.bench.map(p => <PlayerRow key={p.player_id} player={p} />)}
          </section>
        )}
      </div>
    </main>
  );
}
