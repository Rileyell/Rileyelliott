import type { Context } from "hono";
import * as fs from "fs";
import * as path from "path";

const LOG_FILE = "/home/workspace/faq-dashboard/data/analytics.jsonl";

function ensureDir(p: string) {
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export default async (c: Context) => {
  try {
    const sessionId = c.req.header("x-session-id") || "";
    const body = await c.req.json() as {
      type: string;
      slug: string;
      data?: Record<string, unknown>;
    };

    if (!body.type || !body.slug) {
      return c.json({ error: "Missing type or slug" }, 400);
    }

    const allowedTypes = new Set([
      "page_view",
      "search",
      "faq_expand",
      "chatbot_query",
      "question_submitted",
    ]);

    if (!allowedTypes.has(body.type)) {
      return c.json({ error: "Unknown event type" }, 400);
    }

    const event = {
      ts: new Date().toISOString(),
      type: body.type,
      slug: body.slug,
      session: sessionId.slice(0, 32),
      data: body.data || {},
    };

    ensureDir(LOG_FILE);
    fs.appendFileSync(LOG_FILE, JSON.stringify(event) + "\n", "utf-8");

    return c.json({ ok: true });
  } catch (err) {
    console.error("[analytics/track] error:", err);
    return c.json({ error: "Internal server error" }, 500);
  }
};
