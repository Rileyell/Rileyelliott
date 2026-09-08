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
    const slug = c.req.query("slug");
    const program = c.req.query("program") || "";
    const statusFilter = c.req.query("status"); // "published" | "draft" | "" (all)

    const dataFile = getDataFile(program, slug);
    if (!dataFile) return c.json({ error: "Event not found in registry" }, 404);
    if (!fs.existsSync(dataFile)) return c.json({ entries: [] });

    let entries: any[] = JSON.parse(fs.readFileSync(dataFile, "utf-8"));

    if (statusFilter) {
      entries = entries.filter((e) => e.status === statusFilter);
    }

    return c.json({ entries, total: entries.length });
  } catch (err) {
    console.error("faq/list error:", err);
    return c.json({ error: "Failed to load entries" }, 500);
  }
};
