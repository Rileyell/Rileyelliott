import { useEffect, useState, useCallback } from "react";
import {
  Loader2, RefreshCw, TrendingDown, TrendingUp, AlertTriangle,
  Zap, ShieldAlert, Target, Users,
} from "lucide-react";
import { withPlatform } from "@/lib/platform";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DraftState {
  current_pick: number;
  current_round: number;
  total_picks: number;
  my_slot: number | null;
  my_next_pick: number | null;
  picks_until_mine: number | null;
  total_teams: number;
}

interface ValueSlide {
  player_id: string | null;
  name: string;
  position: string;
  team: string | null;
  rank: number;
  tier: number | null;
  ecr: number | null;
  adp: number | null;
  slide_picks: number;
  best: number | null;
  worst: number | null;
  std_dev: number | null;
}

interface ReachAlert {
  player_id: string | null;
  name: string;
  position: string;
  team: string | null;
  ecr: number | null;
  drafted_at: number | null;
  reach_by: number;
}

interface PositionRun {
  position: string;
  count: number;
  in_last: number;
}

interface TierBargain {
  tier: number;
  top_player: {
    player_id: string | null;
    name: string;
    position: string;
    team: string | null;
    rank: number;
    ecr: number | null;
    adp: number | null;
  } | null;
  remaining_count: number;
}

interface NextPickTarget {
  player_id: string | null;
  name: string;
  position: string;
  team: string | null;
  rank: number;
  tier: number | null;
  ecr: number | null;
  adp: number | null;
  likely_available: boolean;
}

interface PosScarcity {
  position: string;
  top12_drafted: number;
  top12_remaining: number;
  best_remaining: {
    name: string;
    rank: number;
    ecr: number | null;
    adp: number | null;
    tier: number | null;
  } | null;
  scarcity_pct: number;
}

interface InsightsData {
  draft_state: DraftState;
  value_slides: ValueSlide[];
  reach_alerts: ReachAlert[];
  position_runs: PositionRun[];
  tier_bargains: TierBargain[];
  next_pick_targets: NextPickTarget[];
  positional_scarcity: PosScarcity[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const POS_COLORS: Record<string, string> = {
  QB: "bg-rose-100 text-rose-700 border-rose-200",
  RB: "bg-emerald-100 text-emerald-700 border-emerald-200",
  WR: "bg-sky-100 text-sky-700 border-sky-200",
  TE: "bg-amber-100 text-amber-700 border-amber-200",
  K:  "bg-zinc-100 text-zinc-600 border-zinc-200",
  DST: "bg-purple-100 text-purple-700 border-purple-200",
};

function PosBadge({ pos }: { pos: string }) {
  const cls = POS_COLORS[pos] ?? "bg-zinc-100 text-zinc-600 border-zinc-200";
  return (
    <span className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded border ${cls}`}>
      {pos}
    </span>
  );
}

function scarcityColor(pct: number) {
  if (pct >= 75) return "text-rose-500";
  if (pct >= 50) return "text-amber-500";
  return "text-emerald-500";
}

// Compact radial progress ring — used for positional scarcity so magnitude
// reads instantly instead of requiring the numbers to be parsed.
function RadialGauge({
  pct,
  size = 44,
  stroke = 5,
  colorClass,
  children,
}: {
  pct: number;
  size?: number;
  stroke?: number;
  colorClass: string;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));
  const offset = c - (clamped / 100) * c;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="currentColor" strokeWidth={stroke} fill="none" className="text-zinc-100" />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          stroke="currentColor" strokeWidth={stroke} fill="none"
          strokeDasharray={c} strokeDashoffset={offset}
          strokeLinecap="round"
          className={`transition-all duration-500 ${colorClass}`}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}

function Card({ accent, children }: { accent: string; children: React.ReactNode }) {
  return (
    <div className={`rounded-xl border border-border border-l-4 ${accent} bg-card p-4`}>
      {children}
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  label,
  sub,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  sub?: string;
  accent: string;
}) {
  return (
    <div className="flex items-start gap-2.5 mb-3">
      <div className={`mt-0.5 size-7 rounded-lg flex items-center justify-center shrink-0 ${accent}`}>
        <Icon className="size-3.5" />
      </div>
      <div>
        <div className="text-sm font-semibold text-foreground">{label}</div>
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
      </div>
    </div>
  );
}

function EmptyState({ msg }: { msg: string }) {
  return (
    <p className="text-xs text-muted-foreground italic py-2">{msg}</p>
  );
}

function StatTile({
  label,
  value,
  sub,
  urgent,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  urgent?: boolean;
}) {
  return (
    <div className="px-4 py-3 min-w-0">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-xl font-bold tabular-nums mt-0.5 truncate ${urgent ? "text-amber-600" : "text-foreground"}`}>
        {value}
      </div>
      {sub && (
        <div className={`text-[11px] mt-0.5 ${urgent ? "text-amber-600 font-medium" : "text-muted-foreground"}`}>
          {sub}
        </div>
      )}
    </div>
  );
}

// ─── Section: Value Slides ───────────────────────────────────────────────────

function ValueSlides({ slides }: { slides: ValueSlide[] }) {
  return (
    <Card accent="border-l-emerald-400">
      <SectionHeader
        icon={TrendingDown}
        label="Value Slides"
        sub="Players whose ADP lags their ECR — being left on the board longer than experts expect"
        accent="bg-emerald-50 text-emerald-600"
      />
      {slides.length === 0 ? (
        <EmptyState msg="No significant value slides detected — draft hasn't started or ADP data unavailable." />
      ) : (
        <div className="space-y-2">
          {slides.map((p) => (
            <div
              key={p.player_id ?? p.name}
              className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2"
            >
              <div className="flex flex-col items-center justify-center shrink-0 rounded-lg bg-emerald-50 text-emerald-600 w-12 h-11">
                <span className="text-base font-bold leading-none tabular-nums">+{p.slide_picks}</span>
                <span className="text-[8px] uppercase tracking-wide mt-0.5">picks</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-foreground">{p.name}</span>
                  <PosBadge pos={p.position} />
                  {p.team && <span className="text-xs text-muted-foreground">{p.team}</span>}
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                  <span>ECR <strong className="text-foreground">#{p.ecr}</strong></span>
                  <span>ADP <strong className="text-foreground">#{p.adp}</strong></span>
                  {p.std_dev != null && <span>σ {p.std_dev.toFixed(1)}</span>}
                  {p.tier && <span>Tier {p.tier}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ─── Section: Next-Pick Targets ──────────────────────────────────────────────

function NextPickTargets({ targets, state }: { targets: NextPickTarget[]; state: DraftState }) {
  const likelyList = targets.filter(t => t.likely_available);
  const maybeList = targets.filter(t => !t.likely_available).slice(0, 4);

  return (
    <Card accent="border-l-sky-400">
      <SectionHeader
        icon={Target}
        label="Your Next Pick Window"
        sub={
          state.picks_until_mine != null
            ? `Pick #${state.my_next_pick} · ${state.picks_until_mine} picks away`
            : "Configure your draft slot in Setup"
        }
        accent="bg-sky-50 text-sky-600"
      />

      {state.my_next_pick == null ? (
        <EmptyState msg="Set your draft slot in Setup to see targeted windows." />
      ) : (
        <>
          {likelyList.length > 0 && (
            <>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                Likely available
              </div>
              <div className="space-y-1.5 mb-3">
                {likelyList.slice(0, 6).map((p) => (
                  <div
                    key={p.player_id ?? p.name}
                    className="flex items-center gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50/50 px-3 py-2"
                  >
                    <span className="text-sm font-bold tabular-nums text-emerald-700 w-7 shrink-0">#{p.rank}</span>
                    <PosBadge pos={p.position} />
                    <span className="text-sm font-medium text-foreground flex-1 truncate">{p.name}</span>
                    {p.team && <span className="text-xs text-muted-foreground shrink-0">{p.team}</span>}
                    {p.tier && (
                      <span className="text-[11px] font-medium text-emerald-700 bg-emerald-100 rounded-full px-1.5 py-0.5 shrink-0">
                        T{p.tier}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {maybeList.length > 0 && (
            <>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                Might get drafted before you
              </div>
              <div className="space-y-1.5">
                {maybeList.map((p) => (
                  <div
                    key={p.player_id ?? p.name}
                    className="flex items-center gap-2.5 rounded-lg border border-border bg-background px-3 py-2"
                  >
                    <span className="size-1.5 rounded-full bg-amber-400 shrink-0" />
                    <span className="text-sm font-bold tabular-nums text-muted-foreground w-7 shrink-0">#{p.rank}</span>
                    <PosBadge pos={p.position} />
                    <span className="text-sm font-medium text-foreground flex-1 truncate">{p.name}</span>
                    {p.team && <span className="text-xs text-muted-foreground shrink-0">{p.team}</span>}
                    <span className="text-[11px] font-medium text-amber-600 shrink-0">ADP #{p.adp}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </Card>
  );
}

// ─── Section: Tier Bargains ──────────────────────────────────────────────────

function TierBargains({ bargains }: { bargains: TierBargain[] }) {
  return (
    <Card accent="border-l-amber-400">
      <SectionHeader
        icon={Zap}
        label="Best Available by Tier"
        sub="Top undrafted player left in each tier"
        accent="bg-amber-50 text-amber-600"
      />
      {bargains.length === 0 ? (
        <EmptyState msg="No tier data available." />
      ) : (
        <div className="space-y-2">
          {bargains.map(({ tier, top_player, remaining_count }) => (
            <div
              key={tier}
              className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2"
            >
              <div className="shrink-0 flex items-center justify-center rounded-lg bg-amber-50 text-amber-700 w-9 h-9 text-xs font-bold">
                T{tier}
              </div>
              {top_player ? (
                <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-foreground">{top_player.name}</span>
                  <PosBadge pos={top_player.position} />
                  {top_player.team && <span className="text-xs text-muted-foreground">{top_player.team}</span>}
                  <span className="text-xs text-muted-foreground">#{top_player.rank}</span>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground flex-1">—</span>
              )}
              <span className="shrink-0 text-[11px] font-medium text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                {remaining_count} left
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ─── Section: Positional Scarcity ────────────────────────────────────────────

function PosScarcityPanel({ scarcity }: { scarcity: PosScarcity[] }) {
  return (
    <Card accent="border-l-violet-400">
      <SectionHeader
        icon={ShieldAlert}
        label="Positional Scarcity"
        sub="Share of the top-12 at each position already off the board"
        accent="bg-violet-50 text-violet-600"
      />
      <div className="space-y-1">
        {scarcity.map((s) => (
          <div key={s.position} className="flex items-center gap-3 rounded-lg px-1 py-1.5">
            <RadialGauge pct={s.scarcity_pct} colorClass={scarcityColor(s.scarcity_pct)}>
              <span className="text-[10px] font-bold tabular-nums text-foreground">{s.top12_drafted}/12</span>
            </RadialGauge>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <PosBadge pos={s.position} />
                <span className={`text-xs font-semibold tabular-nums ${scarcityColor(s.scarcity_pct)}`}>
                  {Math.round(s.scarcity_pct)}% gone
                </span>
              </div>
              {s.best_remaining && (
                <div className="text-xs text-muted-foreground mt-0.5 truncate">
                  Next: <span className="text-foreground font-medium">{s.best_remaining.name}</span>
                  {s.best_remaining.tier && <span className="ml-1">(T{s.best_remaining.tier})</span>}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── Section: Position Runs ──────────────────────────────────────────────────

function PositionRuns({ runs }: { runs: PositionRun[] }) {
  if (runs.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-300 bg-gradient-to-r from-amber-50 to-amber-50/40 p-4">
      <SectionHeader
        icon={AlertTriangle}
        label="Position Run Alert"
        sub="A rush is happening — consider striking before the board clears"
        accent="bg-amber-500 text-white"
      />
      <div className="flex flex-wrap gap-2">
        {runs.map((r) => (
          <div
            key={r.position}
            className="flex items-center gap-2 rounded-lg border border-amber-200 bg-white px-3 py-2 shadow-sm"
          >
            <PosBadge pos={r.position} />
            <span className="text-sm font-medium text-amber-800">
              {r.count} {r.position}s in last {r.in_last} picks
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Section: Reach Alerts ───────────────────────────────────────────────────

function ReachAlerts({ reaches }: { reaches: ReachAlert[] }) {
  if (reaches.length === 0) return null;

  return (
    <Card accent="border-l-rose-400">
      <SectionHeader
        icon={TrendingUp}
        label="Reaches Off the Board"
        sub="Players drafted significantly earlier than their ECR — potential value elsewhere"
        accent="bg-rose-50 text-rose-500"
      />
      <div className="space-y-2">
        {reaches.map((r) => (
          <div
            key={r.player_id ?? r.name}
            className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2"
          >
            <div className="flex flex-col items-center justify-center shrink-0 rounded-lg bg-rose-50 text-rose-600 w-12 h-11">
              <span className="text-base font-bold leading-none tabular-nums">−{r.reach_by}</span>
              <span className="text-[8px] uppercase tracking-wide mt-0.5">picks</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-foreground">{r.name}</span>
                <PosBadge pos={r.position} />
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Picked #{r.drafted_at} · ECR #{r.ecr}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Watchlist({ platform }: { platform?: string | null }) {
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(withPlatform("/api/insights", platform));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json() as InsightsData;
      setData(d);
      setLastUpdated(new Date());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [platform]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 30s during an active draft
  useEffect(() => {
    const interval = setInterval(() => {
      if (data?.draft_state && data.draft_state.total_picks > 0) load();
    }, 30_000);
    return () => clearInterval(interval);
  }, [data, load]);

  const ds = data?.draft_state;
  const draftActive = (ds?.total_picks ?? 0) > 0;
  const urgentPick = ds?.picks_until_mine != null && ds.picks_until_mine <= 3;

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <h1 className="text-lg font-semibold text-foreground">Draft Insights</h1>
            {draftActive && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 text-emerald-600 text-[11px] font-semibold px-2 py-0.5">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                LIVE
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {lastUpdated && (
              <span className="text-xs text-muted-foreground hidden sm:block">
                Updated {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:bg-muted transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
              Refresh
            </button>
          </div>
        </div>

        {/* KPI strip */}
        {ds && (
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 divide-x divide-border rounded-xl border border-border bg-background overflow-hidden max-w-2xl">
            <StatTile label="Round" value={ds.current_round} />
            <StatTile label="Pick" value={`#${ds.current_pick}`} />
            <StatTile label="My Slot" value={ds.my_slot != null ? `#${ds.my_slot}` : "—"} />
            <StatTile
              label="Next Pick"
              value={ds.my_next_pick != null ? `#${ds.my_next_pick}` : "—"}
              sub={ds.picks_until_mine != null ? `${ds.picks_until_mine} away` : undefined}
              urgent={urgentPick}
            />
          </div>
        )}
      </div>

      {/* Body */}
      <div className="px-6 py-5 max-w-4xl mx-auto">
        {loading && !data && (
          <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
            <Loader2 className="size-4 animate-spin" />
            <span className="text-sm">Loading insights…</span>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-sm px-4 py-3">
            Failed to load insights: {error}
          </div>
        )}

        {data && (
          <div className="space-y-4">
            {/* Position run alert — show first if active */}
            {data.position_runs.length > 0 && (
              <PositionRuns runs={data.position_runs} />
            )}

            {/* 2-column grid on wider screens */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ValueSlides slides={data.value_slides} />
              <NextPickTargets targets={data.next_pick_targets} state={data.draft_state} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TierBargains bargains={data.tier_bargains} />
              <PosScarcityPanel scarcity={data.positional_scarcity} />
            </div>

            {data.reach_alerts.length > 0 && (
              <ReachAlerts reaches={data.reach_alerts} />
            )}

            {!draftActive && (
              <div className="rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center">
                <Users className="size-6 text-muted-foreground mx-auto mb-2" />
                <div className="text-sm text-muted-foreground">
                  Draft hasn't started yet. Most insights will light up once picks are recorded.
                  <br />
                  Tier bargains and scarcity tracking are pre-loaded.
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
