import type { Context } from "hono";
import * as fs from "fs";

const REGISTRY_PATH = "/home/workspace/faq-dashboard/data/faq-events.json";

function getDataFile(program: string, slug?: string): string | null {
  if (!fs.existsSync(REGISTRY_PATH)) return null;
  const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf-8"));
  const event = registry.find(
    (e: any) => (slug ? e.slug === slug : e.program === program)
  );
  return event?.dataFile || null;
}

export default async (c: Context) => {
  try {
    const body = await c.req.json();
    const { id, program, slug, ...updates } = body;

    if (!id) return c.json({ error: "Missing field: id" }, 400);

    const dataFile = getDataFile(program || "", slug);
    if (!dataFile) return c.json({ error: "Event not found in registry" }, 404);
    if (!fs.existsSync(dataFile)) return c.json({ error: "Data file not found" }, 404);

    const entries: any[] = JSON.parse(fs.readFileSync(dataFile, "utf-8"));
    const idx = entries.findIndex((e) => e.id === id);
    if (idx === -1) return c.json({ error: "Entry not found" }, 404);

    entries[idx] = { ...entries[idx], ...updates, updated_at: new Date().toISOString() };
    fs.writeFileSync(dataFile, JSON.stringify(entries, null, 2));

    return c.json({ success: true, entry: entries[idx] });
  } catch (err) {
    console.error("faq/update error:", err);
    return c.json({ error: "Failed to update entry" }, 500);
  }
};
