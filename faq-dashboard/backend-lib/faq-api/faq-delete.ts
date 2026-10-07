import type { Context } from "hono";
import * as fs from "fs";
import { REGISTRY_PATH, resolveDataFile } from "./paths";

function getDataFile(program: string, slug?: string): string | null {
  if (!fs.existsSync(REGISTRY_PATH)) return null;
  const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf-8"));
  const event = registry.find(
    (e: any) => (slug ? e.slug === slug : e.program === program)
  );
  return event ? resolveDataFile(event) : null;
}

export default async (c: Context) => {
  try {
    const { id, program, slug } = await c.req.json();
    if (!id) return c.json({ error: "Missing field: id" }, 400);

    const dataFile = getDataFile(program || "", slug);
    if (!dataFile) return c.json({ error: "Event not found in registry" }, 404);
    if (!fs.existsSync(dataFile)) return c.json({ error: "Data file not found" }, 404);

    const entries: any[] = JSON.parse(fs.readFileSync(dataFile, "utf-8"));
    const filtered = entries.filter((e) => e.id !== id);
    if (filtered.length === entries.length) return c.json({ error: "Entry not found" }, 404);

    fs.writeFileSync(dataFile, JSON.stringify(filtered, null, 2));
    return c.json({ success: true });
  } catch (err) {
    console.error("faq/delete error:", err);
    return c.json({ error: "Failed to delete entry" }, 500);
  }
};
