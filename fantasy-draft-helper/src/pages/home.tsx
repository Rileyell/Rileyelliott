import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Zap, List, Lightbulb, Settings, Newspaper, ChevronRight, Trophy, Loader2 } from "lucide-react";

interface League {
  platform: string;
  league_name: string;
  season: number;
  scoring_type: string;
  total_teams: number;
  draft_id: string | null;
  my_pick_slot: number | null;
  settings_json?: { demo?: boolean };
}

function LeagueSkeleton() {
  return (
    <div className="space-y-2">
      {[0, 1].map(i => (
        <div key={i} className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3.5 animate-pulse">
          <div className="h-3.5 w-44 rounded bg-zinc-100 dark:bg-zinc-800 mb-2" />
          <div className="h-3 w-60 rounded bg-zinc-100 dark:bg-zinc-800" />
        </div>
      ))}
    </div>
  );
}

const PLATFORM_COLORS: Record<string, { dot: string; label: string }> = {
  sleeper: { dot: "bg-violet-500", label: "Sleeper" },
  espn:    { dot: "bg-red-500",    label: "ESPN"    },
  yahoo:   { dot: "bg-purple-600", label: "Yahoo"   },
  cbs:     { dot: "bg-blue-700",   label: "CBS"     },
};

export default function Home() {
  const navigate = useNavigate();
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [simMsg, setSimMsg] = useState<string | null>(null);
  const [draftComplete, setDraftComplete] = useState<Record<string, boolean>>({});

  const isDemoLeague = leagues.some(l => l.settings_json?.demo);

  const handleSimulate = useCallback(async () => {
    setSimulating(true);
    setSimMsg(null);
    try {
      const r = await fetch("/api/draft/simulate", { method: "POST" });
      const d = await r.json();
      if (r.ok && d.ok) {
        navigate("/draft");
      } else {
        setSimMsg(d.error ?? "Simulation failed — try again.");
        setSimulating(false);
      }
    } catch {
      setSimMsg("Something went wrong.");
      setSimulating(false);
    }
  }, [navigate]);

  useEffect(() => {
    fetch("/api/leagues")
      .then(r => r.json())
      .then(async (d) => {
        const list: League[] = d.leagues ?? [];
        setLeagues(list);
        setLoading(false);
        // Per-league draft status, so each row can say "Manage" once that
        // specific league's draft is done, not just the globally active one.
        const entries = await Promise.all(list.map(async (l) => {
          try {
            const r = await fetch(`/api/draft/state?platform=${encodeURIComponent(l.platform)}`);
            const state = await r.json();
            return [l.platform, !!state.is_complete] as const;
          } catch {
            return [l.platform, false] as const;
          }
        }));
        setDraftComplete(Object.fromEntries(entries));
      })
      .catch(() => setLoading(false));
  }, []);

  const links = [
    { to: "/draft",     label: "Draft Room",    desc: "Live big board + pick recorder",              icon: Zap,       accent: "bg-zinc-900 dark:bg-white", iconColor: "text-white dark:text-zinc-900", primary: true  },
    { to: "/players",   label: "Player Board",  desc: "Browse 500+ players by position",             icon: List,      accent: "bg-sky-50 dark:bg-sky-900/20",    iconColor: "text-sky-600 dark:text-sky-400",    primary: false },
    { to: "/watchlist", label: "Insights",      desc: "Value slides, tier targets, scarcity alerts", icon: Lightbulb, accent: "bg-amber-50 dark:bg-amber-900/20", iconColor: "text-amber-600 dark:text-amber-400", primary: false },
    { to: "/reports",   label: "Reports",       desc: "Post-draft roster analysis",                  icon: Newspaper, accent: "bg-violet-50 dark:bg-violet-900/20",iconColor: "text-violet-600 dark:text-violet-400",primary: false },
  ];

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-2xl px-5 py-8">

        {/* Hero */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Trophy className="size-4 text-amber-500" />
              <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">2026 Season</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white leading-tight">Draft Helper</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">Rankings · Sync · AI chat · Multi-platform</p>
          </div>
          <Link
            to="/draft"
            className="shrink-0 flex items-center gap-1.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-bold px-4 py-2.5 hover:opacity-85 transition-opacity"
          >
            <Zap className="size-3.5" />
            Draft Room
          </Link>
        </div>

        {/* Leagues */}
        <section className="mb-7">
          <div className="flex items-center justify-between mb-2.5">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
              Your Leagues
            </h2>
            <Link
              to="/setup"
              className="text-[11px] font-semibold text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
            >
              Manage →
            </Link>
          </div>

          {loading && <LeagueSkeleton />}

          {!loading && leagues.length > 0 && (
            <div className="space-y-1.5">
              {leagues.map((l, i) => {
                const plt = PLATFORM_COLORS[l.platform];
                return (
                  <div
                    key={i}
                    className="flex items-center gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3 hover:border-zinc-300 dark:hover:border-zinc-600 hover:shadow-sm transition-all"
                  >
                    <div className={`size-2 rounded-full shrink-0 ${plt?.dot ?? "bg-zinc-400"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-zinc-900 dark:text-white truncate">{l.league_name}</p>
                      <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5 capitalize">
                        {plt?.label ?? l.platform} · {l.total_teams} teams · {l.scoring_type}
                        {l.my_pick_slot != null ? ` · Pick #${l.my_pick_slot}` : ""}
                        {l.draft_id ? " · Draft linked" : ""}
                      </p>
                    </div>
                    <Link
                      to={`/draft?platform=${encodeURIComponent(l.platform)}`}
                      className="shrink-0 flex items-center gap-0.5 text-xs font-semibold text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
                    >
                      {draftComplete[l.platform] ? "Manage" : "Draft"} <ChevronRight className="size-3.5" />
                    </Link>
                  </div>
                );
              })}
            </div>
          )}

          {!loading && leagues.length === 0 && (
            <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 px-6 py-9 text-center bg-white dark:bg-zinc-900">
              <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1">No leagues synced yet</p>
              <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-5">
                Add your Sleeper username or ESPN league ID in Setup to get started.
              </p>
              <Link
                to="/setup"
                className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-bold px-4 py-2 hover:opacity-80 transition-opacity"
              >
                <Settings className="size-3.5" />
                Go to Setup
              </Link>
            </div>
          )}

          {/* Demo CTA — simulate a full draft instantly */}
          {!loading && isDemoLeague && (
            <div className="mt-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-4 py-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-widest mb-0.5">Demo Mode</p>
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    Simulate all 12 teams drafting from live FantasyPros rankings — takes ~10 seconds.
                  </p>
                  {simMsg && <p className="text-xs text-red-600 mt-1">{simMsg}</p>}
                </div>
                <button
                  onClick={handleSimulate}
                  disabled={simulating}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold px-4 py-2.5 transition-all disabled:opacity-50 active:scale-[0.97]"
                >
                  {simulating ? <Loader2 className="size-3.5 animate-spin" /> : <Zap className="size-3.5" />}
                  {simulating ? "Simulating…" : "Simulate Draft"}
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Quick-nav */}
        <section>
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-2.5">
            Quick Nav
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {/* Primary — full width */}
            {links.filter(l => l.primary).map(({ to, label, desc, icon: Icon, accent, iconColor }) => (
              <Link
                key={to}
                to={to}
                className="col-span-2 group flex items-center gap-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3.5 hover:border-zinc-400 dark:hover:border-zinc-500 hover:shadow-sm transition-all"
              >
                <span className={`shrink-0 size-9 rounded-xl ${accent} flex items-center justify-center`}>
                  <Icon className={`size-4.5 ${iconColor}`} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-zinc-900 dark:text-white">{label}</p>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">{desc}</p>
                </div>
                <ChevronRight className="shrink-0 size-4 text-zinc-300 group-hover:text-zinc-700 dark:group-hover:text-zinc-200 transition-colors" />
              </Link>
            ))}

            {/* Secondary — 2-col grid */}
            {links.filter(l => !l.primary).map(({ to, label, desc, icon: Icon, accent, iconColor }) => (
              <Link
                key={to}
                to={to}
                className="group flex flex-col gap-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3.5 hover:border-zinc-300 dark:hover:border-zinc-600 hover:shadow-sm transition-all"
              >
                <span className={`shrink-0 size-8 rounded-lg ${accent} flex items-center justify-center`}>
                  <Icon className={`size-3.5 ${iconColor}`} />
                </span>
                <div>
                  <p className="text-sm font-bold text-zinc-800 dark:text-zinc-100">{label}</p>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5 leading-snug">{desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

      </div>
    </main>
  );
}
