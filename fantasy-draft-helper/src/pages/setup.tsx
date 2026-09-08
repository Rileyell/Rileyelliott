import { useState } from "react";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

type Status = "idle" | "loading" | "ok" | "error";

export default function Setup() {
  const [sleeperUser, setSleeperUser] = useState("");
  const [espnLeagueId, setEspnLeagueId] = useState("");
  const [espnS2, setEspnS2] = useState("");
  const [espnSwid, setEspnSwid] = useState("");
  const [pickSlot, setPickSlot] = useState("");
  const [pickSlotStatus, setPickSlotStatus] = useState<Status>("idle");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [platform, setPlatform] = useState<"sleeper" | "espn">("sleeper");

  async function handleSync() {
    setStatus("loading");
    setMessage("");
    try {
      const body = platform === "sleeper"
        ? { platform: "sleeper", username: sleeperUser }
        : { platform: "espn", league_id: espnLeagueId, espn_s2: espnS2, swid: espnSwid };

      const r = await fetch("/api/leagues/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (r.ok && d.ok) {
        if (pickSlot && parseInt(pickSlot) > 0) {
          await fetch("/api/leagues/pick-slot", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ platform, my_pick_slot: parseInt(pickSlot) }),
          }).catch(() => {});
        }
        setStatus("ok");
        setMessage(`Synced ${d.seeded} league(s) for ${platform}.`);
      } else {
        setStatus("error");
        setMessage(d.error ?? "Sync failed.");
      }
    } catch (e) {
      setStatus("error");
      setMessage(String(e));
    }
  }

  async function handleClearCache() {
    setStatus("loading");
    setMessage("");
    try {
      const r = await fetch("/api/players/invalidate", { method: "POST" });
      const d = await r.json();
      setStatus(d.ok ? "ok" : "error");
      setMessage(d.ok ? "Player cache cleared. Next load will re-fetch from FantasyPros." : (d.error ?? "Error"));
    } catch (e) {
      setStatus("error");
      setMessage(String(e));
    }
  }

  const inputCls = "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 ring-zinc-300 placeholder:text-zinc-400 transition-shadow shadow-sm";

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-900">
      <div className="mx-auto max-w-xl px-6 py-10">

        <div className="mb-8">
          <h1 className="text-2xl font-black tracking-tight text-zinc-900">Setup</h1>
          <p className="text-sm text-zinc-400 mt-1">Connect your league and configure your draft settings.</p>
        </div>

        {/* Card: Sync League */}
        <div className="rounded-xl border border-zinc-200 bg-white shadow-sm p-6 mb-4">
          <h2 className="text-sm font-bold text-zinc-900 mb-4">Sync League</h2>

          {/* Platform toggle */}
          <div className="flex gap-2 mb-5">
            {(["sleeper", "espn"] as const).map(p => (
              <button
                key={p}
                onClick={() => setPlatform(p)}
                className={`rounded-lg border px-5 py-2 text-sm font-semibold capitalize transition-all ${
                  platform === p
                    ? "border-zinc-900 bg-zinc-900 text-white shadow-sm"
                    : "border-zinc-200 bg-white text-zinc-500 hover:text-zinc-900 hover:border-zinc-300"
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          <div className="space-y-4 mb-5">
            {platform === "sleeper" ? (
              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1.5 uppercase tracking-wide">Sleeper Username</label>
                <input
                  value={sleeperUser}
                  onChange={e => setSleeperUser(e.target.value)}
                  placeholder="your_sleeper_username"
                  className={inputCls}
                />
                <p className="text-xs text-zinc-400 mt-1.5">Fetches all active leagues for the given user.</p>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 mb-1.5 uppercase tracking-wide">ESPN League ID</label>
                  <input value={espnLeagueId} onChange={e => setEspnLeagueId(e.target.value)} placeholder="123456789" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 mb-1.5 uppercase tracking-wide">espn_s2 Cookie</label>
                  <input value={espnS2} onChange={e => setEspnS2(e.target.value)} placeholder="AEB3..." className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 mb-1.5 uppercase tracking-wide">SWID Cookie</label>
                  <input value={espnSwid} onChange={e => setEspnSwid(e.target.value)} placeholder="{XXXXXXXX-...}" className={inputCls} />
                </div>
                <p className="text-xs text-zinc-400">
                  Get these from browser cookies at fantasy.espn.com (Application → Cookies).
                </p>
              </>
            )}
          </div>

          <button
            onClick={handleSync}
            disabled={status === "loading"}
            className="w-full rounded-lg bg-zinc-900 text-white py-2.5 text-sm font-bold hover:bg-zinc-800 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {status === "loading" ? <Loader2 className="size-4 animate-spin" /> : null}
            Sync League
          </button>

          {status === "ok" && (
            <div className="flex items-center gap-2 mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              <CheckCircle2 className="size-4 shrink-0" />
              {message}
            </div>
          )}
          {status === "error" && (
            <div className="flex items-center gap-2 mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <XCircle className="size-4 shrink-0" />
              {message}
            </div>
          )}
        </div>

        {/* Card: My Pick Slot */}
        <div className="rounded-xl border border-zinc-200 bg-white shadow-sm p-6 mb-4">
          <h2 className="text-sm font-bold text-zinc-900 mb-1">My Pick Slot</h2>
          <p className="text-xs text-zinc-400 mb-4">Manually override your draft pick slot so it shows on the home page and highlights your picks in the draft room.</p>
          <div className="flex gap-2">
            <input
              type="number"
              min={1}
              max={20}
              value={pickSlot}
              onChange={e => setPickSlot(e.target.value)}
              placeholder="e.g. 4"
              className={inputCls + " max-w-[110px]"}
            />
            <button
              onClick={async () => {
                const slot = parseInt(pickSlot);
                if (!slot || slot < 1) return;
                setPickSlotStatus("loading");
                try {
                  const r = await fetch("/api/leagues/pick-slot", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ my_pick_slot: slot }),
                  });
                  const d = await r.json();
                  setPickSlotStatus(d.ok ? "ok" : "error");
                } catch { setPickSlotStatus("error"); }
              }}
              disabled={pickSlotStatus === "loading"}
              className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-600 hover:text-zinc-900 hover:border-zinc-300 transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
            >
              {pickSlotStatus === "loading" ? <Loader2 className="size-3.5 animate-spin" /> : null}
              {pickSlotStatus === "ok" ? <CheckCircle2 className="size-3.5 text-emerald-600" /> : null}
              Save
            </button>
          </div>
        </div>

        {/* Card: Cache */}
        <div className="rounded-xl border border-zinc-200 bg-white shadow-sm p-6">
          <h2 className="text-sm font-bold text-zinc-900 mb-1">Player Cache</h2>
          <p className="text-xs text-zinc-400 mb-4">Rankings are cached for 1 hour. Clear to force a fresh FantasyPros fetch on next load.</p>
          <button
            onClick={handleClearCache}
            className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-600 hover:text-zinc-900 hover:border-zinc-300 transition-colors shadow-sm"
          >
            Clear Player Cache
          </button>
        </div>

      </div>
    </main>
  );
}
