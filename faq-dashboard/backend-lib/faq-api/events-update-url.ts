import type { Context } from "hono";
import * as fs from "fs";
import { REGISTRY_PATH } from "./paths";

export default async (c: Context) => {
  try {
    const { slug, eventUrl } = await c.req.json();

    if (!slug) return c.json({ error: "Missing slug" }, 400);
    if (!eventUrl) return c.json({ error: "Missing eventUrl" }, 400);

    if (!fs.existsSync(REGISTRY_PATH)) {
      return c.json({ error: "Event registry not found" }, 500);
    }

    const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf-8"));
    const event = registry.find((e: any) => e.slug === slug);

    if (!event) {
      return c.json({ error: `Event '${slug}' not found in registry` }, 404);
    }

    // Update the URL and set scrapeStatus to pending
    event.eventUrl = eventUrl;
    event.scrapeStatus = "pending";
    event.lastScraped = null;

    fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2));

    return c.json({
      success: true,
      message: `Event URL updated for '${event.name}'.`,
      slug,
      eventUrl,
    });
  } catch (err) {
    console.error("events/update-url error:", err);
    return c.json({ error: "Failed to update URL" }, 500);
  }
};
