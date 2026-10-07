import type { Context } from "hono";
import * as fs from "fs";
import { spawn } from "child_process";
import { REGISTRY_PATH, SCRAPER_SCRIPT, SITE_ROOT, resolveDataFile } from "./paths";

const LOG_DIR = "/dev/shm";

export default async (c: Context) => {
  try {
    const body = await c.req.json();
    const { slug, url: overrideUrl } = body;
    if (!slug) return c.json({ error: "Missing slug" }, 400);

    if (!fs.existsSync(REGISTRY_PATH)) return c.json({ error: "Event registry not found" }, 500);
    const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf-8"));
    const event = registry.find((e: any) => e.slug === slug);
    if (!event) return c.json({ error: `Event '${slug}' not found in registry` }, 404);

    const scrapeUrl = overrideUrl?.trim() || event.eventUrl;
    if (!scrapeUrl) return c.json({ error: "No URL provided and no eventUrl configured for this event" }, 400);

    const logFile = `${LOG_DIR}/faq-scrape-${slug}.log`;
    fs.appendFileSync(logFile, `\n--- Scrape triggered at ${new Date().toISOString()} ---\nURL: ${scrapeUrl}\n`);
    const logFd = fs.openSync(logFile, "a");

    const args = [
      SCRAPER_SCRIPT,
      scrapeUrl,
      "--slug", slug,
      "--program", event.program || event.name,
      "--data-file", resolveDataFile(event),
      "--auto-categories",
    ];

    const child = spawn("python3", args, {
      detached: true,
      stdio: ["ignore", logFd, logFd],
      env: { ...process.env, FAQ_DASHBOARD_ROOT: SITE_ROOT },
    });
    child.on("error", (err) => console.error("Scrape spawn error:", err));
    child.unref();

    fs.closeSync(logFd);

    return c.json({
      success: true,
      message: `Scrape started for '${event.name}'. Drafts will appear in the AI Drafts tab within 2–3 minutes.`,
      slug,
      scrapeUrl,
      logFile,
    });
  } catch (err) {
    console.error("events/scrape error:", err);
    return c.json({ error: "Failed to start scrape", detail: String(err) }, 500);
  }
};
