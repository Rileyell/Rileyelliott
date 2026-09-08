import type { Context } from "hono";
import * as fs from "fs";
import * as path from "path";

const REGISTRY_PATH = "/home/workspace/faq-dashboard/data/faq-events.json";
const WORKSPACE = "/home/workspace";

function slugToDataPath(slug: string): string {
  return path.join(WORKSPACE, "faq-dashboard", "data", slug, "faq_data.json");
}

function getMostRecentlyBuiltEvent(registry: any[]): any | null {
  const candidates = registry
    .filter((e) => {
      const dataFile = e.dataFile;
      if (!dataFile || !fs.existsSync(dataFile)) return false;
      const entries: any[] = JSON.parse(fs.readFileSync(dataFile, "utf-8"));
      return entries.filter((x) => (x.status || "published") === "published").length > 0;
    })
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  return candidates[0] || null;
}

function cloneEntries(sourceEntries: any[], targetSlug: string, targetProgram: string): any[] {
  return sourceEntries
    .filter((e) => (e.status || "published") === "published")
    .map((e) => ({
      ...e,
      id: crypto.randomUUID(),
      program: targetProgram,
      status: "published",
      created_at: new Date().toISOString(),
      _cloned_from: e.program || "unknown",
    }));
}

export default async (c: Context) => {
  try {
    const body = await c.req.json();
    const { slug, name, client, accent, eventUrl, milestones, audiences } = body;

    if (!slug || !name || !client) {
      return c.json({ error: "slug, name, and client are required" }, 400);
    }

    if (!/^[a-z0-9-]+$/.test(slug)) {
      return c.json({ error: "slug must be lowercase letters, numbers, and hyphens only" }, 400);
    }

    const registry: any[] = fs.existsSync(REGISTRY_PATH)
      ? JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf-8"))
      : [];

    if (registry.find((e) => e.slug === slug)) {
      return c.json({ error: `Event with slug "${slug}" already exists` }, 409);
    }

    const dataFile = slugToDataPath(slug);
    const dataDir = path.dirname(dataFile);
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    if (!fs.existsSync(dataFile)) fs.writeFileSync(dataFile, "[]");

    // If no eventUrl, clone FAQs from most recent event that has entries
    let clonedFrom: string | null = null;
    if (!eventUrl) {
      const sorted = [...registry].sort((a, b) =>
        new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      );
      for (const src of sorted) {
        if (src.dataFile && fs.existsSync(src.dataFile)) {
          const srcEntries: any[] = JSON.parse(fs.readFileSync(src.dataFile, "utf-8"));
          const published = srcEntries.filter((e) => (e.status || "published") === "published");
          if (published.length > 0) {
            // Clone with new IDs, program set to new event name, mark provenance
            const cloned = published.map((e) => ({
              ...e,
              id: crypto.randomUUID(),
              program: name,
              created_at: new Date().toISOString(),
              _cloned_from: src.slug,
            }));
            fs.writeFileSync(dataFile, JSON.stringify(cloned, null, 2));
            clonedFrom = src.slug;
            break;
          }
        }
      }
    } else {
      fs.writeFileSync(dataFile, "[]");
    }

    const adminPath = `/admin?slug=${slug}`;
    const clientPath = `/faq/${slug}`;

    const eventEntry = {
      slug,
      name,
      program: name,
      client,
      accent: accent || "#d8a657",
      adminPath,
      clientPath,
      dataFile,
      eventUrl: eventUrl || "",
      milestones: milestones || ["Application", "Down-Select", "Program Structure", "Event Day", "Winners & Awards"],
      audiences: audiences || ["Applicants", "Finalists", "General"],
      active: true,
      created_at: new Date().toISOString(),
    };

    registry.push(eventEntry);
    fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2));

    return c.json({
      success: true,
      event: eventEntry,
      clonedFrom,
      message: clonedFrom
        ? `Event "${name}" created with ${JSON.parse(fs.readFileSync(dataFile, "utf-8")).length} placeholder FAQs cloned from "${clonedFrom}". Admin at ${adminPath}, client at ${clientPath}.`
        : `Event "${name}" created. Admin at ${adminPath}, client at ${clientPath}.`,
    });
  } catch (err) {
    console.error("events/create error:", err);
    return c.json({ error: "Failed to create event" }, 500);
  }
};
