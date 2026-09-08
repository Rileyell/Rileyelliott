import { useEffect, useState, useRef } from "react";
import { Loader2, Star, Pencil, Check, X } from "lucide-react";
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
  positionRank: number | null;
  best: number | null;
  worst: number | null;
  adp: number | null;
  is_drafted: boolean;
  is_my_pick: boolean;
  injury_status: string | null;
  injury_body_part: string | null;
  do_not_draft: boolean;
  note: string;
}

const POS_COLORS: Record<string, string> = {
  QB:  "bg-rose-50 text-rose-600 border border-rose-200 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800",
  RB:  "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800",
  WR:  "bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-900/20 dark:text-sky-400 dark:border-sky-800",
  TE:  "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800",
  K:   "bg-zinc-100 text-zinc-500 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700",
  DST: "bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800",
};

const POSITIONS = ["ALL", "QB", "RB", "WR", "TE", "K", "DST"];

export default function Players({ platform }: { platform?: string | null }) {
  const [players, setPlayers]       = useState<Player[]>([]);
  const [loading, setLoading]       = useState(true);
  const [pos, setPos]               = useState("ALL");
  const [query, setQuery]           = useState("");
  const [showDrafted, setShowDrafted] = useState(true);
  const [watchlist, setWatchlist]   = useState<Set<string>>(new Set());
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteValue, setNoteValue]   = useState("");
  const noteInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLoading(true);
    fetch(withPlatform("/api/players?limit=600&drafted=true", platform))
      .then(r => r.json())
      .then(d => { setPlayers(d.players ?? []); setLoading(false); });
    fetch("/api/watchlist")
      .then(r => r.json())
      .then(d => {
        const ids = new Set<string>((d.watchlist ?? []).map((w: { player_id: string }) => w.player_id));
        setWatchlist(ids);
      });
  }, [platform]);

  useEffect(() => {
    if (editingNote !== null) noteInputRef.current?.focus();
  }, [editingNote]);

  const toggleWatchlist = async (p: Player) => {
    if (!p.player_id) return;
    const inList = watchlist.has(p.player_id);
    setWatchlist(prev => {
      const next = new Set(prev);
      inList ? next.delete(p.player_id!) : next.add(p.player_id!);
      return next;
    });
    await fetch("/api/watchlist", {
      method: inList ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ player_id: p.player_id }),
    });
  };

  const startEditNote = (p: Player) => { setEditingNote(p.player_id); setNoteValue(p.note ?? ""); };
  const saveNote = async (p: Player) => {
    if (!p.player_id) return;
    setPlayers(prev => prev.map(pl => pl.player_id === p.player_id ? { ...pl, note: noteValue } : pl));
    setEditingNote(null);
    await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ player_id: p.player_id, note: noteValue }),
    });
  };
  const cancelEdit = () => { setEditingNote(null); setNoteValue(""); };

  const filtered = players.filter(p => {
    if (pos !== "ALL" && p.position !== pos) return false;
    if (!showDrafted && p.is_drafted) return false;
    if (query && !p.name.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <div className="mx-auto max-w-6xl px-6 py-8">

        {/* Header */}
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="text-3xl font-black tracking-tight">Player Board</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">{filtered.length} players</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 mb-6 flex-wrap">
          <div className="flex gap-0.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-1">
            {POSITIONS.map(p => (
              <button
                key={p}
                onClick={() => setPos(p)}
                className={`rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${
                  pos === p
                    ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900"
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
            placeholder="Search player…"
            className="h-9 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 text-sm outline-none focus:ring-2 ring-zinc-400 w-44 placeholder:text-zinc-400"
          />
          <label className="flex items-center gap-2 text-sm text-zinc-500 cursor-pointer ml-auto">
            <input
              type="checkbox"
              checked={showDrafted}
              onChange={e => setShowDrafted(e.target.checked)}
              className="rounded"
            />
            Show drafted
          </label>
        </div>

        {loading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="size-6 animate-spin text-zinc-400" />
          </div>
        ) : (
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm bg-white dark:bg-zinc-900">
            <table className="w-full">
              <thead className="bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-700">
                <tr className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                  <th className="px-3 py-3 w-8"></th>
                  <th className="px-4 py-3 text-left w-12">#</th>
                  <th className="px-4 py-3 text-left">Player</th>
                  <th className="px-4 py-3 text-center w-16">POS</th>
                  <th className="px-4 py-3 text-center w-16">TEAM</th>
                  <th className="px-4 py-3 text-center w-14">BYE</th>
                  <th className="px-4 py-3 text-center w-16">TIER</th>
                  <th className="px-4 py-3 text-center w-18">ECR</th>
                  <th className="px-4 py-3 text-center w-18">ADP</th>
                  <th className="px-4 py-3 text-right w-24">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.reduce<{ rows: React.ReactNode[]; lastTier: number | null }>((acc, p) => {
                  const isNewTier = p.tier !== null && p.tier !== acc.lastTier && !p.is_drafted;
                  if (isNewTier && acc.lastTier !== null) {
                    acc.rows.push(
                      <tr key={`tier-div-${p.tier}`}>
                        <td colSpan={10} className="px-4 py-1 bg-zinc-50 dark:bg-zinc-800/60 border-t-2 border-zinc-200 dark:border-zinc-700 text-[10px] font-black tracking-widest text-zinc-400 dark:text-zinc-500 uppercase">
                          — Tier {p.tier}
                        </td>
                      </tr>
                    );
                  }
                  const starred   = p.player_id ? watchlist.has(p.player_id) : false;
                  const isEditing = editingNote === p.player_id;
                  acc.rows.push(
                    <tr
                      key={p.player_id ?? p.name}
                      className={`border-t border-zinc-100 dark:border-zinc-800 transition-colors ${
                        p.is_drafted ? "opacity-30" : "hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
                      } ${p.is_my_pick ? "bg-emerald-50/70 dark:bg-emerald-900/10" : ""}`}
                    >
                      {/* Star */}
                      <td className="px-3 py-3 text-center">
                        <button
                          onClick={() => toggleWatchlist(p)}
                          className={`transition-colors ${starred ? "text-amber-400" : "text-zinc-200 dark:text-zinc-700 hover:text-amber-400"}`}
                        >
                          <Star className="size-4" fill={starred ? "currentColor" : "none"} />
                        </button>
                      </td>

                      {/* Rank */}
                      <td className="px-4 py-3 tabular-nums text-sm text-zinc-400 dark:text-zinc-500 font-mono">{p.rank}</td>

                      {/* Name + note */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">{p.name}</span>
                          {p.do_not_draft && (
                            <span className="rounded px-1.5 py-0.5 text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-200 leading-none">DND</span>
                          )}
                          {p.injury_status && (
                            <span
                              title={`${p.injury_status}${p.injury_body_part ? " — " + p.injury_body_part : ""}`}
                              className={`inline-flex size-2.5 rounded-full shrink-0 ${
                                p.injury_status === "Out" || p.injury_status === "IR" || p.injury_status === "PUP"
                                  ? "bg-rose-500"
                                  : p.injury_status === "Doubtful"
                                  ? "bg-orange-500"
                                  : "bg-amber-400"
                              }`}
                            />
                          )}
                          {isEditing ? (
                            <span className="flex items-center gap-1.5 ml-1">
                              <input
                                ref={noteInputRef}
                                value={noteValue}
                                onChange={e => setNoteValue(e.target.value)}
                                onKeyDown={e => { if (e.key === "Enter") saveNote(p); if (e.key === "Escape") cancelEdit(); }}
                                className="h-6 w-40 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2 text-sm outline-none focus:ring-2 ring-zinc-400"
                                placeholder="Add note…"
                              />
                              <button onClick={() => saveNote(p)} className="text-emerald-500 hover:text-emerald-600"><Check className="size-4" /></button>
                              <button onClick={cancelEdit} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"><X className="size-4" /></button>
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5 ml-1 group/note">
                              {p.note && <span className="text-sm text-zinc-400 italic truncate max-w-[140px]">{p.note}</span>}
                              <button
                                onClick={() => startEditNote(p)}
                                className="opacity-0 group-hover/note:opacity-100 text-zinc-300 hover:text-zinc-700 dark:hover:text-zinc-200 transition-opacity"
                              >
                                <Pencil className="size-3.5" />
                              </button>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* POS badge */}
                      <td className="px-4 py-3 text-center">
                        <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold ${POS_COLORS[p.position] ?? ""}`}>
                          {p.position}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-center text-sm text-zinc-400 dark:text-zinc-500">{p.team ?? "–"}</td>
                      <td className="px-4 py-3 text-center text-sm text-zinc-400 dark:text-zinc-500">{p.bye ?? "–"}</td>
                      <td className="px-4 py-3 text-center text-sm font-bold text-zinc-700 dark:text-zinc-300">{p.tier ?? "–"}</td>
                      <td className="px-4 py-3 text-center text-sm tabular-nums text-zinc-500">{p.ecr != null ? p.ecr.toFixed(1) : "–"}</td>
                      <td className="px-4 py-3 text-center text-sm tabular-nums text-zinc-500">{p.adp != null ? p.adp.toFixed(1) : "–"}</td>
                      <td className="px-4 py-3 text-right text-sm">
                        {p.is_drafted
                          ? <span className={p.is_my_pick ? "text-emerald-600 font-bold" : "text-zinc-400"}>{p.is_my_pick ? "✓ Mine" : "Drafted"}</span>
                          : <span className="text-emerald-600 font-semibold">Available</span>}
                      </td>
                    </tr>
                  );
                  acc.lastTier = p.tier ?? acc.lastTier;
                  return acc;
                }, { rows: [], lastTier: null }).rows}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
