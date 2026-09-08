import type { Context } from "hono";
import * as fs from "fs";
import * as path from "path";

const REGISTRY_PATH = "/home/workspace/faq-dashboard/data/faq-events.json";
const LOGOS_DIR = "/home/workspace/faq-dashboard/data/logos";
const MAX_SIZE = 2 * 1024 * 1024; // 2 MB

const ALLOWED_MIME: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/webp": ".webp",
  "image/svg+xml": ".svg",
  "image/gif": ".gif",
};

export default async (c: Context) => {
  try {
    const contentType = c.req.header("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return c.json({ error: "Expected multipart/form-data" }, 400);
    }

    const formData = await c.req.formData();

    // slug comes as a FormData field from the hub; fall back to query param for direct calls
    const slug = (formData.get("slug") as string | null)?.trim() || c.req.query("slug");
    if (!slug) return c.json({ error: "slug required" }, 400);

    if (!fs.existsSync(REGISTRY_PATH)) return c.json({ error: "Event registry not found" }, 404);

    const registry: any[] = JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf-8"));
    const idx = registry.findIndex((e) => e.slug === slug);
    if (idx === -1) return c.json({ error: `Event '${slug}' not found` }, 404);

    const file = formData.get("logo");

    if (!file || typeof file === "string") {
      return c.json({ error: "No logo file provided" }, 400);
    }

    if (file.size > MAX_SIZE) {
      return c.json({ error: "File too large (max 2 MB)" }, 413);
    }

    const mime = file.type || "application/octet-stream";
    const ext = ALLOWED_MIME[mime];
    if (!ext) {
      return c.json({ error: `Unsupported file type: ${mime}. Allowed: PNG, JPEG, WebP, SVG, GIF` }, 415);
    }

    if (!fs.existsSync(LOGOS_DIR)) fs.mkdirSync(LOGOS_DIR, { recursive: true });

    const logoPath = path.join(LOGOS_DIR, `${slug}${ext}`);
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(logoPath, buffer);

    // Update registry with logoFile path
    registry[idx].logoFile = logoPath;
    fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2));

    return c.json({ ok: true, logoFile: logoPath, mime, size: file.size });
  } catch (err) {
    console.error("upload-logo error:", err);
    return c.json({ error: "Failed to upload logo" }, 500);
  }
};
