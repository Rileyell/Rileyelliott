import type { Context } from "hono";
import * as fs from "fs";
import * as path from "path";
import { REGISTRY_PATH, LOGOS_DIR, toStoredPath } from "./paths";

export default async (c: Context) => {
  try {
    const contentType = c.req.header("content-type") || "";

    let slug: string | undefined;
    let name: string | undefined;
    let client: string | undefined;
    let accent: string | undefined;
    let eventUrl: string | undefined;
    let milestones: string[] | undefined;
    let audiences: string[] | undefined;
    let logoFile: string | undefined;
    let enableChatbot: boolean | undefined;

    if (contentType.includes("multipart/form-data")) {
      // Logo-only upload via FormData
      const formData = await c.req.formData();
      slug = formData.get("slug") as string | undefined;
      const logoBlob = formData.get("logo") as File | null;

      if (!slug) return c.json({ error: "slug is required" }, 400);
      if (!logoBlob) return c.json({ error: "logo file is required" }, 400);

      const MAX_SIZE = 2 * 1024 * 1024; // 2 MB
      if (logoBlob.size > MAX_SIZE) return c.json({ error: "Logo must be under 2 MB" }, 400);

      const ext = path.extname(logoBlob.name || ".png").toLowerCase();
      const allowed = [".png", ".jpg", ".jpeg", ".webp", ".svg", ".gif"];
      if (!allowed.includes(ext)) return c.json({ error: "Unsupported image format" }, 400);

      if (!fs.existsSync(LOGOS_DIR)) fs.mkdirSync(LOGOS_DIR, { recursive: true });
      const destPath = path.join(LOGOS_DIR, `${slug}${ext}`);

      const buf = Buffer.from(await logoBlob.arrayBuffer());
      fs.writeFileSync(destPath, buf);
      logoFile = toStoredPath(destPath);

    } else {
      // JSON body update
      const body = await c.req.json();
      ({ slug, name, client, accent, eventUrl, milestones, audiences } = body);
      if (body.enableChatbot !== undefined) enableChatbot = Boolean(body.enableChatbot);
    }

    if (!slug) return c.json({ error: "slug is required" }, 400);

    if (!fs.existsSync(REGISTRY_PATH)) {
      return c.json({ error: "Event registry not found" }, 404);
    }

    const events = JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf-8"));
    const idx = events.findIndex((e: any) => e.slug === slug);

    if (idx === -1) return c.json({ error: `Event '${slug}' not found` }, 404);

    if (name !== undefined) events[idx].name = name;
    if (name !== undefined) events[idx].program = name;
    if (client !== undefined) events[idx].client = client;
    if (accent !== undefined) events[idx].accent = accent;
    if (eventUrl !== undefined) events[idx].eventUrl = eventUrl;
    if (milestones !== undefined) events[idx].milestones = milestones;
    if (audiences !== undefined) events[idx].audiences = audiences;
    if (logoFile !== undefined) events[idx].logoFile = logoFile;
    if (typeof enableChatbot === "boolean") events[idx].enableChatbot = enableChatbot;

    fs.writeFileSync(REGISTRY_PATH, JSON.stringify(events, null, 2));

    return c.json({ ok: true, event: events[idx] });
  } catch (err) {
    console.error("Error updating event:", err);
    return c.json({ error: "Failed to update event" }, 500);
  }
};
