import type { Context } from "hono";
import * as fs from "fs";
import { REGISTRY_PATH, resolveLogoFile } from "./paths";

const EXT_MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".gif": "image/gif",
};

export default async (c: Context) => {
  try {
    const slug = c.req.query("slug");
    if (!slug) return c.json({ error: "slug required" }, 400);

    if (!fs.existsSync(REGISTRY_PATH)) return c.json({ error: "Registry not found" }, 404);

    const registry: any[] = JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf-8"));
    const event = registry.find((e) => e.slug === slug);
    if (!event) return c.json({ error: "Event not found" }, 404);
    if (!event.logoFile) return c.json({ error: "No logo set for this event" }, 404);
    const logoFile = resolveLogoFile(event.logoFile);
    if (!fs.existsSync(logoFile)) return c.json({ error: "Logo file not found on disk" }, 404);

    const ext = logoFile.match(/(\.[^.]+)$/)?.[1]?.toLowerCase() || ".png";
    const mime = EXT_MIME[ext] || "image/png";
    const buffer = fs.readFileSync(logoFile);

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": mime,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    console.error("events/logo error:", err);
    return c.json({ error: "Failed to serve logo" }, 500);
  }
};
