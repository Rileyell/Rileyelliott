import type { Context } from "hono";
import * as fs from "fs";
import * as path from "path";

const EVENTS_DIR = "/home/workspace/KITE_Scouting/events";
const LEGACY_SUBMITTED = "/home/workspace/KITE_Scouting/submitted_questions.json";

function getSubmittedPath(slug: string): string {
  return path.join(EVENTS_DIR, slug, "submitted_questions.json");
}

export default async (c: Context) => {
  try {
    const slug = c.req.query("slug");
    if (!slug) return c.json({ error: "slug required" }, 400);

    const submittedPath = getSubmittedPath(slug);
    const questions: any[] = fs.existsSync(submittedPath)
      ? JSON.parse(fs.readFileSync(submittedPath, "utf-8"))
      : [];

    // Sort newest first
    questions.sort(
      (a, b) =>
        new Date(b.submitted_at || 0).getTime() -
        new Date(a.submitted_at || 0).getTime()
    );

    return c.json({ questions, total: questions.length });
  } catch (err) {
    console.error("list-submitted error:", err);
    return c.json({ error: "Failed to list submitted questions" }, 500);
  }
};
