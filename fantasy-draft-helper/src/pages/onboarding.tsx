import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Loader2, CheckCircle2, XCircle, ArrowLeft, ChevronRight,
  ChevronDown, Lock, ExternalLink,
} from "lucide-react";

type ActivePlatform = "sleeper" | "espn";
type Step = "pick" | "connect" | "syncing" | "done";

interface PlatformDef {
  id: string;
  label: string;
  tagline: string;
  status: "live" | "soon";
  color: string;
  abbr: string;
  logo: string;
}

const PLATFORMS: PlatformDef[] = [
  {
    id: "sleeper",
    label: "Sleeper",
    tagline: "Username only — no password",
    status: "live",
    color: "#7C3AED",
    abbr: "SL",
    logo: "https://www.google.com/s2/favicons?domain=sleeper.com&sz=128",
  },
  {
    id: "espn",
    label: "ESPN Fantasy",
    tagline: "League ID + session cookies",
    status: "live",
    color: "#C8102E",
    abbr: "ES",
    logo: "https://www.google.com/s2/favicons?domain=espn.com&sz=128",
  },
  {
    id: "yahoo",
    label: "Yahoo! Fantasy",
    tagline: "Coming soon",
    status: "soon",
    color: "#6001D2",
    abbr: "YH",
    logo: "https://www.google.com/s2/favicons?domain=yahoo.com&sz=128",
  },
  {
    id: "cbs",
    label: "CBS Sports",
    tagline: "Coming soon",
    status: "soon",
    color: "#004C97",
    abbr: "CB",
    logo: "https://www.google.com/s2/favicons?domain=cbssports.com&sz=128",
  },
  {
    id: "mfl",
    label: "MyFantasyLeague",
    tagline: "Coming soon",
    status: "soon",
    color: "#1E1E1E",
    abbr: "MF",
    logo: "https://www.google.com/s2/favicons?domain=myfantasyleague.com&sz=128",
  },
  {
    id: "ffpc",
    label: "FFPC",
    tagline: "Coming soon",
    status: "soon",
    color: "#D4AF37",
    abbr: "FP",
    logo: "https://www.google.com/s2/favicons?domain=ffpc.com&sz=128",
  },
  {
    id: "underdog",
    label: "Underdog Fantasy",
    tagline: "Coming soon",
    status: "soon",
    color: "#FF5722",
    abbr: "UD",
    logo: "https://www.google.com/s2/favicons?domain=underdogfantasy.com&sz=128",
  },
  {
    id: "fantrax",
    label: "Fantrax",
    tagline: "Coming soon",
    status: "soon",
    color: "#0066CC",
    abbr: "FX",
    logo: "https://www.google.com/s2/favicons?domain=fantrax.com&sz=128",
  },
  {
    id: "fleaflicker",
    label: "Fleaflicker",
    tagline: "Coming soon",
    status: "soon",
    color: "#1A7F4B",
    abbr: "FF",
    logo: "https://www.google.com/s2/favicons?domain=fleaflicker.com&sz=128",
  },
  {
    id: "rtfantasy",
    label: "RealTime Fantasy",
    tagline: "Coming soon",
    status: "soon",
    color: "#E63946",
    abbr: "RT",
    logo: "https://www.google.com/s2/favicons?domain=rtsports.com&sz=128",
  },
];

const livePlatforms = PLATFORMS.filter(p => p.status === "live");
const soonPlatforms = PLATFORMS.filter(p => p.status === "soon");

const inputCls =
  "w-full rounded-xl border border-zinc-200 bg-white px-4 py-3.5 text-base outline-none focus:ring-2 focus:ring-zinc-900 placeholder:text-zinc-400 transition-shadow";

function PlatformLogo({ p, size = 40 }: { p: PlatformDef; size?: number }) {
  const [imgOk, setImgOk] = useState(true);
  if (imgOk) {
    return (
      <img
        src={p.logo}
        alt={p.label}
        width={size}
        height={size}
        className="rounded-lg object-contain"
        onError={() => setImgOk(false)}
      />
    );
  }
  return (
    <span
      className="rounded-lg flex items-center justify-center text-white font-black flex-shrink-0"
      style={{ width: size, height: size, backgroundColor: p.color, fontSize: size * 0.3 }}
    >
      {p.abbr}
    </span>
  );
}

function EspnCookieGuide() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 transition-colors"
      >
        <span className="flex items-center gap-2">
          <ExternalLink className="size-3.5 text-zinc-400" />
          How do I find my ESPN cookies?
        </span>
        <ChevronDown
          className={`size-4 text-zinc-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 text-sm text-zinc-600 leading-relaxed border-t border-zinc-200 pt-3">
          <p className="font-semibold text-zinc-800">Chrome / Edge / Brave:</p>
          <ol className="list-decimal list-inside space-y-1.5 pl-1">
            <li>
              Go to{" "}
              <a
                href="https://fantasy.espn.com"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 text-zinc-900 hover:text-zinc-600"
              >
                fantasy.espn.com
              </a>{" "}
              and make sure you're signed in.
            </li>
            <li>Open DevTools with <kbd className="rounded bg-zinc-200 px-1.5 py-0.5 text-xs font-mono">F12</kbd> (Windows) or <kbd className="rounded bg-zinc-200 px-1.5 py-0.5 text-xs font-mono">⌘ Opt I</kbd> (Mac)</li>
            <li>Click the <strong>Application</strong> tab → expand <strong>Cookies</strong> → click <strong>https://fantasy.espn.com</strong></li>
            <li>Find <code className="bg-zinc-200 rounded px-1 font-mono text-xs">espn_s2</code> — copy its full value (starts with "AEA…")</li>
            <li>Find <code className="bg-zinc-200 rounded px-1 font-mono text-xs">SWID</code> — copy its value (looks like <span className="font-mono text-xs">{"{XXXXXXXX-XXXX-XXXX}"}</span>)</li>
          </ol>
          <div className="flex items-start gap-2.5 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 mt-2">
            <Lock className="size-3.5 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-800 leading-snug">
              Your cookies are stored locally in your browser session only — they're never sent anywhere except ESPN's own API. Treat them like a password.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("pick");
  const [platform, setPlatform] = useState<ActivePlatform | null>(null);

  const [sleeperUser, setSleeperUser] = useState("");
  const [espnLeagueId, setEspnLeagueId] = useState("");
  const [espnS2, setEspnS2] = useState("");
  const [espnSwid, setEspnSwid] = useState("");

  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seeded, setSeeded] = useState<number | null>(null);

  async function handleDemo() {
    setDemoLoading(true);
    setError(null);
    setStep("syncing");
    try {
      const r = await fetch("/api/leagues/demo", { method: "POST" });
      const d = await r.json();
      if (r.ok && d.ok) {
        setSeeded(1);
        setStep("done");
      } else {
        setError(d.error ?? "Could not seed demo league.");
        setStep("pick");
      }
    } catch {
      setError("Something went wrong.");
      setStep("pick");
    } finally {
      setDemoLoading(false);
    }
  }

  function selectPlatform(id: string) {
    setPlatform(id as ActivePlatform);
    setError(null);
    setStep("connect");
  }

  async function handleConnect() {
    if (!platform) return;
    setLoading(true);
    setError(null);
    setStep("syncing");

    try {
      const body =
        platform === "sleeper"
          ? { platform: "sleeper", username: sleeperUser.trim() }
          : {
              platform: "espn",
              league_id: espnLeagueId.trim(),
              espn_s2: espnS2.trim(),
              swid: espnSwid.trim(),
            };

      const r = await fetch("/api/leagues/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();

      if (r.ok && d.ok) {
        setSeeded(d.seeded ?? 1);
        setStep("done");
      } else {
        setError(d.error ?? "Could not connect your league. Check your credentials and try again.");
        setStep("connect");
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setStep("connect");
    } finally {
      setLoading(false);
    }
  }

  const canSubmit =
    platform === "sleeper"
      ? sleeperUser.trim().length > 0
      : espnLeagueId.trim().length > 0 &&
        espnS2.trim().length > 0 &&
        espnSwid.trim().length > 0;

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col text-zinc-900">

      {/* ── Top bar ── */}
      <header className="flex items-center px-8 py-5 border-b border-zinc-200 bg-white">
        <div className="flex items-center gap-3">
          <span className="size-8 rounded-lg bg-zinc-900 flex items-center justify-center">
            <span className="text-white font-black text-sm tracking-tight">D</span>
          </span>
          <span className="font-bold text-zinc-900 text-[15px] tracking-tight">Draft Helper</span>
        </div>
        <span className="ml-auto text-xs font-semibold uppercase tracking-widest text-zinc-400">
          2026 Season
        </span>
      </header>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-16">

        {/* ── STEP: Pick platform ── */}
        {step === "pick" && (
          <div className="w-full max-w-3xl">
            <div className="text-center mb-10">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-400 mb-3">
                Choose your commissioner service
              </p>
              <h1 className="text-4xl font-black text-zinc-900 tracking-tight leading-none">
                Where does your league live?
              </h1>
              <p className="mt-4 text-base text-zinc-500 max-w-md mx-auto leading-relaxed">
                Connect your platform to import rosters, settings, and live draft data.
              </p>
            </div>

            {/* All platforms — uniform white card grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {/* Live platforms — clickable */}
              {livePlatforms.map(p => (
                <button
                  key={p.id}
                  onClick={() => selectPlatform(p.id)}
                  className="group relative flex flex-col items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-6 text-center shadow-sm hover:border-zinc-400 hover:shadow-md transition-all duration-150 active:scale-[0.97] cursor-pointer"
                >
                  <div className="size-14 rounded-xl bg-zinc-50 border border-zinc-100 flex items-center justify-center flex-shrink-0 group-hover:border-zinc-200 transition-colors">
                    <PlatformLogo p={p} size={36} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-zinc-900 leading-tight">{p.label}</p>
                    <p className="text-[11px] text-zinc-400 mt-0.5 leading-tight">{p.tagline}</p>
                  </div>
                  {/* Live badge */}
                  <span className="absolute top-2.5 right-2.5 size-2 rounded-full bg-emerald-400 ring-2 ring-white" title="Live" />
                </button>
              ))}

              {/* Coming-soon — greyed out, same card shape */}
              {soonPlatforms.map(p => (
                <div
                  key={p.id}
                  title={`${p.label} — Coming soon`}
                  className="flex flex-col items-center gap-3 rounded-2xl border border-zinc-100 bg-white px-4 py-6 text-center opacity-40 select-none cursor-not-allowed"
                >
                  <div className="size-14 rounded-xl bg-zinc-50 border border-zinc-100 flex items-center justify-center flex-shrink-0">
                    <PlatformLogo p={p} size={36} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-zinc-900 leading-tight">{p.label}</p>
                    <p className="text-[11px] text-zinc-400 mt-0.5">Coming soon</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Try Demo */}
            <div className="mt-8 text-center">
              <p className="text-xs text-zinc-400 mb-3">Don't have a league handy?</p>
              <button
                onClick={handleDemo}
                disabled={demoLoading}
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-6 py-2.5 text-sm font-bold text-zinc-700 shadow-sm hover:border-zinc-400 hover:shadow-md transition-all active:scale-[0.97] disabled:opacity-50"
              >
                {demoLoading ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <span>⚡</span>
                )}
                Try Demo League
              </button>
            </div>
          </div>
        )}

        {/* ── STEP: Credential form ── */}
        {step === "connect" && platform && (() => {
          const p = PLATFORMS.find(x => x.id === platform)!;
          return (
            <div className="w-full max-w-md">
              <button
                onClick={() => { setStep("pick"); setError(null); }}
                className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-900 transition-colors mb-10"
              >
                <ArrowLeft className="size-4" />
                All platforms
              </button>

              <div className="flex items-center gap-5 mb-8">
                <div className="size-16 rounded-2xl bg-white border border-zinc-200 flex items-center justify-center flex-shrink-0 shadow-sm">
                  <PlatformLogo p={p} size={44} />
                </div>
                <div>
                  <p className="text-3xl font-black text-zinc-900 tracking-tight leading-none">{p.label}</p>
                  <p className="text-sm text-zinc-400 mt-1.5">{p.tagline}</p>
                </div>
              </div>

              <div className="space-y-5">
                {platform === "sleeper" && (
                  <>
                    <label className="block">
                      <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">
                        Sleeper Username
                      </span>
                      <input
                        className={`${inputCls} mt-2`}
                        placeholder="e.g. john_doe22"
                        value={sleeperUser}
                        autoFocus
                        onChange={e => setSleeperUser(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && canSubmit && handleConnect()}
                      />
                    </label>
                    <div className="flex items-start gap-2.5 rounded-xl bg-zinc-50 border border-zinc-200 px-4 py-3">
                      <Lock className="size-3.5 text-zinc-400 mt-0.5 shrink-0" />
                      <p className="text-xs text-zinc-500 leading-snug">
                        Sleeper's public API only requires your username. No password or token needed.
                      </p>
                    </div>
                  </>
                )}

                {platform === "espn" && (
                  <>
                    <label className="block">
                      <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">League ID</span>
                      <input
                        className={`${inputCls} mt-2`}
                        placeholder="e.g. 1753827453"
                        value={espnLeagueId}
                        autoFocus
                        onChange={e => setEspnLeagueId(e.target.value)}
                      />
                      <p className="mt-1.5 text-xs text-zinc-400">
                        Found in your ESPN league URL: <code className="font-mono bg-zinc-100 px-1 rounded">leagueId=XXXXXXXX</code>
                      </p>
                    </label>
                    <label className="block">
                      <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">ESPN_S2 Cookie</span>
                      <input
                        className={`${inputCls} mt-2 font-mono text-sm`}
                        placeholder="AEA..."
                        value={espnS2}
                        onChange={e => setEspnS2(e.target.value)}
                      />
                    </label>
                    <label className="block">
                      <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">SWID Cookie</span>
                      <input
                        className={`${inputCls} mt-2 font-mono text-sm`}
                        placeholder="{XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX}"
                        value={espnSwid}
                        onChange={e => setEspnSwid(e.target.value)}
                      />
                    </label>
                    <EspnCookieGuide />
                  </>
                )}
              </div>

              {error && (
                <div className="mt-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3.5">
                  <XCircle className="size-4 text-red-500 mt-0.5 shrink-0" />
                  <p className="text-sm text-red-700 leading-snug">{error}</p>
                </div>
              )}

              <button
                onClick={handleConnect}
                disabled={!canSubmit || loading}
                className="mt-7 w-full rounded-xl bg-zinc-900 text-white text-base font-bold py-4 transition-all disabled:opacity-25 flex items-center justify-center gap-2 hover:bg-zinc-800 active:scale-[0.99]"
              >
                {loading && <Loader2 className="size-4 animate-spin" />}
                Connect {platform === "sleeper" ? "Sleeper" : "ESPN"}
              </button>
            </div>
          );
        })()}

        {/* ── STEP: Syncing ── */}
        {step === "syncing" && (
          <div className="text-center py-20 space-y-7">
            <div className="size-16 mx-auto rounded-full border-2 border-zinc-200 border-t-zinc-900 animate-spin" />
            <div>
              <p className="text-2xl font-bold text-zinc-900">Syncing your league…</p>
              <p className="text-base text-zinc-500 mt-3 leading-relaxed">
                Pulling rosters, players, and rankings.<br />This takes about 10 seconds.
              </p>
            </div>
          </div>
        )}

        {/* ── STEP: Done ── */}
        {step === "done" && (
          <div className="text-center py-16 space-y-8 max-w-sm">
            <div className="inline-flex items-center justify-center size-20 rounded-full bg-emerald-50 border border-emerald-200">
              <CheckCircle2 className="size-10 text-emerald-500" />
            </div>
            <div>
              <p className="text-4xl font-black text-zinc-900 tracking-tight">You're in.</p>
              <p className="text-base text-zinc-500 mt-3">
                {seeded ?? 1} league{(seeded ?? 1) !== 1 ? "s" : ""} synced and ready.
              </p>
            </div>
            <button
              onClick={() => { window.location.href = "/"; }}
              className="w-full rounded-xl bg-zinc-900 text-white text-base font-bold py-4 hover:bg-zinc-800 transition-all active:scale-[0.99] flex items-center justify-center gap-2"
            >
              Open Draft Board <ChevronRight className="size-4" />
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
