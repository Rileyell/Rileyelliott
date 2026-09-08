import { useEffect, useState, useCallback } from "react";
import { Loader2, RefreshCw, TrendingUp, TrendingDown, ArrowLeftRight, ShieldCheck, ArrowDown, ArrowUp, Minus } from "lucide-react";
import { withPlatform } from "@/lib/platform";

interface ComparablePlayer {
  player_id: string;
  name: string;
  position: string;
  ecr: number | null;
  adp: number | null;
  positionRank: number | null;
  injury_status: string | null;
}

interface WaiverPickup {
  player_id: string;
  name: string;
  position: string;
  ecr: number | null;
  adp: number | null;
  positionRank: number | null;
  injury_status: string | null;
  need_position: boolean;
  drop_candidate: ComparablePlayer | null;
  reason: string;
}

interface TradePlayer {
  player_id: string;
  name: string;
  position: string;
  ecr: number | null;
}

interface TradeCandidate {
  id: string;
  other_team_ref: string;
  other_team_name: string;
  give_player: TradePlayer;
  get_player: TradePlayer;
  fairness_diff: number;
  confidence: "Low" | "Medium" | "High";
  reason_mine: string;
  reason_theirs: string;
}

interface ReportData {
  platform: string;
  week: number;
  my_team: { team_ref: string; team_name: string | null };
  needs: string[];
  surplus: string[];
  waiver_pickups: WaiverPickup[];
  trades: TradeCandidate[];
}

const POS_COLORS: Record<string, string> = {
  QB: "bg-rose-100 text-rose-700 border-rose-200",
  RB: "bg-emerald-100 text-emerald-700 border-emerald-200",
  WR: "bg-sky-100 text-sky-700 border-sky-200",
  TE: "bg-amber-100 text-amber-700 border-amber-200",
  K: "bg-zinc-100 text-zinc-600 border-zinc-200",
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

const CONFIDENCE_COLORS: Record<TradeCandidate["confidence"], string> = {
  High: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Medium: "bg-amber-100 text-amber-700 border-amber-200",
  Low: "bg-rose-100 text-rose-700 border-rose-200",
};

function ConfidenceBadge({ confidence }: { confidence: TradeCandidate["confidence"] }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${CONFIDENCE_COLORS[confidence]}`}>
      <ShieldCheck className="size-3" />
      {confidence} confidence
    </span>
  );
}

function PlayerCompareCol({
  player,
  label,
  labelColor,
  dropCandidate,
}: {
  player: ComparablePlayer;
  label: string;
  labelColor: string;
  dropCandidate?: ComparablePlayer | null;
}) {
  const ecrDelta = dropCandidate && player.ecr != null && dropCandidate.ecr != null
    ? dropCandidate.ecr - player.ecr  // positive = pickup is better (lower ECR = higher rank)
    : null;

  return (
    <div className="flex-1 min-w-0">
      <div className={`text-[10px] font-bold uppercase tracking-wider mb-1.5 ${labelColor}`}>{label}</div>
      <div className="flex items-center gap-1.5 flex-wrap mb-2">
        <span className="font-semibold text-foreground text-sm truncate">{player.name}</span>
        <PosBadge pos={player.position} />
        {player.injury_status && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border bg-red-50 text-red-600 border-red-200">
            {player.injury_status}
          </span>
        )}
      </div>
      <div className="space-y-1">
        <StatRow label="ECR" value={player.ecr != null ? `#${player.ecr}` : "—"} delta={ecrDelta} invertDelta />
        <StatRow label="ADP" value={player.adp != null ? `#${player.adp}` : "—"} />
        <StatRow label="Pos Rank" value={player.positionRank != null ? `${player.position}${player.positionRank}` : "—"} />
      </div>
    </div>
  );
}

function StatRow({ label, value, delta, invertDelta }: { label: string; value: string; delta?: number | null; invertDelta?: boolean }) {
  const showDelta = delta != null && delta !== 0;
  // For ECR/ADP: positive delta means drop candidate's rank is higher number (worse), so pickup is better → green
  const isPositive = invertDelta ? (delta ?? 0) > 0 : (delta ?? 0) < 0;
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1">
        <span className="font-medium text-foreground">{value}</span>
        {showDelta && (
          <span className={`flex items-center gap-0.5 text-[10px] font-semibold ${isPositive ? "text-emerald-600" : "text-rose-500"}`}>
            {isPositive ? <ArrowUp className="size-2.5" /> : <ArrowDown className="size-2.5" />}
            {Math.abs(delta!)}
          </span>
        )}
      </div>
    </div>
  );
}

export default function Reports({ platform }: { platform?: string | null }) {
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(withPlatform("/api/season/report", platform));
      if (res.ok) {
        const data = await res.json();
        setReport(data.report);
      } else {
        setReport(null);
      }
    } catch {
      setError("Failed to load report.");
    } finally {
      setLoading(false);
    }
  }, [platform]);

  const generate = useCallback(async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(withPlatform("/api/season/report", platform), { method: "POST" });
      const data = await res.json();
      if (res.ok) setReport(data.report);
      else setError(data.error ?? "Failed to generate report.");
    } catch {
      setError("Failed to generate report.");
    } finally {
      setGenerating(false);
    }
  }, [platform]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Weekly Report</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Waiver pickups and trade recommendations for {report?.my_team?.team_name ?? "your team"}
            {report ? ` — Week ${report.week}` : ""}
          </p>
        </div>
        <button
          onClick={generate}
          disabled={generating}
          className="flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-foreground/5 transition-colors disabled:opacity-50 shrink-0"
        >
          {generating ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
          {generating ? "Generating..." : "Regenerate"}
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="size-5 animate-spin mr-2" /> Loading report...
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-sm px-4 py-3 mb-4">
          {error}
        </div>
      )}

      {!loading && !report && !error && (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground mb-3">No report generated yet for this week.</p>
          <button
            onClick={generate}
            disabled={generating}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {generating ? "Generating..." : "Generate this week's report"}
          </button>
        </div>
      )}

      {report && (
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <TrendingDown className="size-4 text-rose-500" />
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Needs</span>
                <div className="flex gap-1">
                  {report.needs.length ? report.needs.map(p => <PosBadge key={p} pos={p} />) : <span className="text-xs text-muted-foreground">none</span>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp className="size-4 text-emerald-500" />
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Surplus</span>
                <div className="flex gap-1">
                  {report.surplus.length ? report.surplus.map(p => <PosBadge key={p} pos={p} />) : <span className="text-xs text-muted-foreground">none</span>}
                </div>
              </div>
            </div>
          </div>

          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">Waiver Pickups</h2>
            <div className="space-y-3">
              {report.waiver_pickups.map(w => (
                <div key={w.player_id} className="rounded-xl border border-border bg-card p-4">
                  {/* Header row */}
                  <div className="flex items-center gap-2 mb-3">
                    {w.need_position && (
                      <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Fills Need
                      </span>
                    )}
                  </div>

                  {/* Side-by-side comparison */}
                  {w.drop_candidate ? (
                    <div className="flex items-stretch gap-0 mb-3">
                      {/* Pickup side */}
                      <div className="flex-1 rounded-l-lg border border-r-0 border-emerald-200 bg-emerald-50/40 px-3 py-2.5">
                        <PlayerCompareCol
                          player={{ player_id: w.player_id, name: w.name, position: w.position, ecr: w.ecr, adp: w.adp, positionRank: w.positionRank, injury_status: w.injury_status }}
                          label="Add"
                          labelColor="text-emerald-700"
                          dropCandidate={w.drop_candidate}
                        />
                      </div>

                      {/* Divider arrow */}
                      <div className="flex items-center justify-center bg-background border-y border-border px-2 z-10">
                        <div className="flex flex-col items-center gap-0.5">
                          <ArrowLeftRight className="size-3.5 text-muted-foreground" />
                          <span className="text-[9px] text-muted-foreground font-medium">for</span>
                        </div>
                      </div>

                      {/* Drop side */}
                      <div className="flex-1 rounded-r-lg border border-l-0 border-rose-200 bg-rose-50/40 px-3 py-2.5">
                        <PlayerCompareCol
                          player={w.drop_candidate}
                          label="Drop"
                          labelColor="text-rose-600"
                        />
                      </div>
                    </div>
                  ) : (
                    /* No drop candidate — just show the pickup */
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 px-3 py-2.5 mb-3">
                      <PlayerCompareCol
                        player={{ player_id: w.player_id, name: w.name, position: w.position, ecr: w.ecr, adp: w.adp, positionRank: w.positionRank, injury_status: w.injury_status }}
                        label="Add (no drop needed)"
                        labelColor="text-emerald-700"
                      />
                    </div>
                  )}

                  {/* Reasoning */}
                  {w.reason && <p className="text-xs text-muted-foreground leading-relaxed border-t border-border pt-2.5 mt-1">{w.reason}</p>}
                </div>
              ))}
              {report.waiver_pickups.length === 0 && (
                <p className="text-sm text-muted-foreground">No waiver targets identified this week.</p>
              )}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">Trade Proposals</h2>
            <div className="space-y-3">
              {report.trades.map(t => (
                <div key={t.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                    <span className="text-sm font-semibold text-foreground">vs. {t.other_team_name}</span>
                    <ConfidenceBadge confidence={t.confidence} />
                  </div>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex-1 rounded-lg border border-rose-200 bg-rose-50/50 px-3 py-2">
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-rose-600 mb-0.5">You give</div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-foreground">{t.give_player.name}</span>
                        <PosBadge pos={t.give_player.position} />
                      </div>
                    </div>
                    <ArrowLeftRight className="size-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 rounded-lg border border-emerald-200 bg-emerald-50/50 px-3 py-2">
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600 mb-0.5">You get</div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-foreground">{t.get_player.name}</span>
                        <PosBadge pos={t.get_player.position} />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1.5 text-sm">
                    <p className="text-muted-foreground"><span className="font-medium text-foreground">Why it helps you: </span>{t.reason_mine}</p>
                    <p className="text-muted-foreground"><span className="font-medium text-foreground">Why they should accept: </span>{t.reason_theirs}</p>
                  </div>
                </div>
              ))}
              {report.trades.length === 0 && (
                <p className="text-sm text-muted-foreground">No trades that clearly improve your team were found this week.</p>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
