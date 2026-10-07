import * as fs from "fs";
import * as path from "path";

// ── Filesystem locations ────────────────────────────────────────────────────
// Everything is resolved from this project's own folder so the app works no
// matter which account or directory it's deployed to. Override with
// FAQ_DASHBOARD_ROOT if the data needs to live somewhere else.
export const SITE_ROOT = process.env.FAQ_DASHBOARD_ROOT || path.resolve(import.meta.dir, "../..");
export const DATA_DIR = path.join(SITE_ROOT, "data");
export const REGISTRY_PATH = path.join(DATA_DIR, "faq-events.json");
export const LOGOS_DIR = path.join(DATA_DIR, "logos");
export const ANALYTICS_LOG = path.join(DATA_DIR, "analytics.jsonl");
export const LEGACY_SUBMITTED = path.join(DATA_DIR, "submitted_questions.json");

// The web-scraper Skill is installed into the account's Skills/ folder, not
// this project, so it gets its own override.
export const SCRAPER_SCRIPT =
  process.env.FAQ_SCRAPER_SCRIPT || "/home/workspace/Skills/web-scraper/scripts/faq_extract.py";

export function defaultDataFile(slug: string): string {
  return path.join(DATA_DIR, slug, "faq_data.json");
}

export function submittedPath(slug: string): string {
  return path.join(DATA_DIR, slug, "submitted_questions.json");
}

// Paths stored in the registry are relative to DATA_DIR. Absolute paths left
// over from an older deployment are honored if they still exist; otherwise
// fall back to the conventional data/<slug>/ location.
export function resolveDataFile(event: { slug: string; dataFile?: string }): string {
  return resolveStored(event.dataFile, defaultDataFile(event.slug));
}

export function resolveLogoFile(logoFile: string): string {
  return resolveStored(logoFile, path.join(LOGOS_DIR, path.basename(logoFile)));
}

function resolveStored(stored: string | undefined, fallback: string): string {
  if (!stored) return fallback;
  if (!path.isAbsolute(stored)) return path.join(DATA_DIR, stored);
  return fs.existsSync(stored) ? stored : fallback;
}

export function toStoredPath(absPath: string): string {
  return path.relative(DATA_DIR, absPath);
}
