import { useEffect, useState } from "react";
import { BrowserRouter, Route, Routes, NavLink, Navigate, useLocation } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import { useTheme } from "@/components/theme-provider";
import Home from "./pages/home";
import Draft from "./pages/draft";
import Team from "./pages/team";
import Players from "./pages/players";
import Watchlist from "./pages/watchlist";
import Setup from "./pages/setup";
import Reports from "./pages/reports";
import Onboarding from "./pages/onboarding";
import DesignKitDemo from "./pages/_design";
import ChatWidget from "./components/chat-widget";
import { getActivePlatform, setActivePlatform, withPlatform } from "./lib/platform";
import { Sun, Moon, Home as HomeIcon, Zap, Users, List, Lightbulb, Newspaper, Settings } from "lucide-react";

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isDark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="size-7 rounded border border-zinc-200 dark:border-zinc-700 bg-transparent flex items-center justify-center text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:border-zinc-400 dark:hover:border-zinc-500 transition-all"
      aria-label="Toggle theme"
    >
      {isDark ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
    </button>
  );
}

function Nav({ draftComplete }: { draftComplete: boolean }) {
  const links = [
    { to: "/",          label: "Home",    icon: HomeIcon,  end: true  },
    { to: "/draft",     label: draftComplete ? "Team" : "Draft", icon: draftComplete ? Users : Zap, end: false },
    { to: "/players",   label: "Players", icon: List,      end: false },
    { to: "/watchlist", label: "Insights",icon: Lightbulb, end: false },
    { to: "/reports",   label: "Reports", icon: Newspaper, end: false },
    { to: "/setup",     label: "Setup",   icon: Settings,  end: false },
  ];

  return (
    <nav className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 sticky top-0 z-40">
      <div className="flex h-11 items-stretch px-4 gap-0">
        {/* Wordmark */}
        <div className="flex items-center gap-2 mr-6 shrink-0">
          <div className="size-6 rounded-lg bg-zinc-900 dark:bg-white flex items-center justify-center">
            <Zap className="size-3.5 text-white dark:text-zinc-900" />
          </div>
          <span className="text-[13px] font-black text-zinc-900 dark:text-zinc-100 tracking-tight hidden sm:block">
            Draft Helper
          </span>
        </div>

        {/* Nav links */}
        {links.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-1.5 px-3 text-[12px] font-semibold border-b-2 transition-colors ${
                isActive
                  ? "border-zinc-900 dark:border-white text-zinc-900 dark:text-white"
                  : "border-transparent text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={`size-3.5 ${isActive ? "" : "opacity-60"}`} />
                <span className="hidden sm:block">{label}</span>
              </>
            )}
          </NavLink>
        ))}

        <div className="ml-auto flex items-center">
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
}

// Reads ?platform= from the URL (set when the user picks a specific league
// from Home) and remembers it in sessionStorage so it sticks across nav-bar
// clicks and refreshes, even once the URL no longer carries the param.
// Returns null (server picks its own default) until a league is explicitly
// selected.
function useActivePlatform(): string | null {
  const location = useLocation();
  const [platform, setPlatform] = useState<string | null>(() => getActivePlatform());

  useEffect(() => {
    const fromUrl = new URLSearchParams(location.search).get("platform");
    if (fromUrl && fromUrl !== platform) {
      setActivePlatform(fromUrl);
      setPlatform(fromUrl);
    }
  }, [location.search]);

  return platform;
}

// Polls draft completion so the Draft tab can transform into the Team tab
// automatically — including mid-session, once a real draft wraps up. Tracks
// whichever league is currently active (see useActivePlatform); each league
// flips independently once its own draft is done.
function useDraftStatus(platform: string | null) {
  const [ready, setReady] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    async function poll() {
      try {
        const res = await fetch(withPlatform("/api/draft/state", platform));
        const d = await res.json();
        if (!cancelled) setIsComplete(!!d.is_complete);
      } catch { /* keep last known state */ }
      finally { if (!cancelled) setReady(true); }
    }
    poll();
    const id = setInterval(poll, 20000);
    return () => { cancelled = true; clearInterval(id); };
  }, [platform]);

  return { ready, isComplete };
}

function useLeagueGate() {
  const [ready, setReady] = useState(false);
  const [hasLeague, setHasLeague] = useState(false);

  useEffect(() => {
    fetch("/api/leagues")
      .then(r => r.json())
      .then(d => {
        setHasLeague(Array.isArray(d.leagues) && d.leagues.length > 0);
        setReady(true);
      })
      .catch(() => { setHasLeague(false); setReady(true); });
  }, []);

  return { ready, hasLeague };
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </ThemeProvider>
  );
}

function AppRoutes() {
  const { ready, hasLeague } = useLeagueGate();
  const platform = useActivePlatform();
  const { ready: draftReady, isComplete: draftComplete } = useDraftStatus(platform);

  if (!ready) {
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-950 flex items-center justify-center">
        <div className="size-4 border-2 border-zinc-200 dark:border-zinc-700 border-t-zinc-900 dark:border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/_design" element={<DesignKitDemo />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route
        path="/*"
        element={
          !hasLeague ? (
            <Navigate to="/onboarding" replace />
          ) : (
            <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950">
              <Nav draftComplete={draftReady && draftComplete} />
              <div className="flex-1">
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/draft" element={draftReady && draftComplete ? <Team platform={platform} /> : <Draft platform={platform} />} />
                  <Route path="/players" element={<Players platform={platform} />} />
                  <Route path="/watchlist" element={<Watchlist platform={platform} />} />
                  <Route path="/reports" element={<Reports platform={platform} />} />
                  <Route path="/setup" element={<Setup />} />
                </Routes>
              </div>
              <ChatWidget platform={platform} />
            </div>
          )
        }
      />
    </Routes>
  );
}
