// Tracks which connected league (Sleeper or ESPN) the user is currently
// "in" — set when they pick a specific league from Home, persisted across
// nav-bar clicks and page refreshes within the browser session. When unset,
// callers omit the platform param entirely and let the server fall back to
// its own default (most recently connected/synced league).

const STORAGE_KEY = "activePlatform";

export function getActivePlatform(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setActivePlatform(platform: string): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, platform);
  } catch { /* ignore */ }
}

export function withPlatform(url: string, platform?: string | null): string {
  if (!platform) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}platform=${encodeURIComponent(platform)}`;
}
