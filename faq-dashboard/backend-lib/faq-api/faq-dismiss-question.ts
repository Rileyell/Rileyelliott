import type { Context } from "hono";
import * as fs from "fs";
import * as path from "path";

const EVENTS_DIR = "/home/workspace/KITE_Scouting/events";

function getSubmittedPath(slug: string): string {
  return path.join(EVENTS_DIR, slug, "submitted_questions.json");
}

export default async (c: Context) => {
  try {
    const body = await c.req.json();
    const { id, slug, action } = body;

    if (!id || !slug) return c.json({ error: "id and slug required" }, 400);

    const submittedPath = getSubmittedPath(slug);
    if (!fs.existsSync(submittedPath)) return c.json({ error: "No questions for this slug" }, 404);

    const questions: any[] = JSON.parse(fs.readFileSync(submittedPath, "utf-8"));
    const idx = questions.findIndex((q) => q.id === id);
    if (idx === -1) return c.json({ error: "Question not found" }, 404);

    const newStatus = action === "resolved" ? "resolved" : "dismissed";
    questions[idx].status = newStatus;
    questions[idx].resolved_at = new Date().toISOString();

    fs.writeFileSync(submittedPath, JSON.stringify(questions, null, 2));

    return c.json({ ok: true, status: newStatus });
  } catch (err) {
    console.error("dismiss-question error:", err);
    return c.json({ error: "Failed to dismiss question" }, 500);
  }
};
