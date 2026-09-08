import type { Context } from "hono";
import * as fs from "fs";
import * as path from "path";

const REGISTRY_PATH = "/home/workspace/faq-dashboard/data/faq-events.json";
const EVENTS_DIR = "/home/workspace/KITE_Scouting/events";
const LEGACY_SUBMITTED = "/home/workspace/KITE_Scouting/submitted_questions.json";

function getSubmittedPath(slug: string): string {
  return path.join(EVENTS_DIR, slug, "submitted_questions.json");
}

export default async (c: Context) => {
  try {
    const body = await c.req.json();
    const { question, email, program, slug, timestamp } = body;

    if (!question || !question.trim()) {
      return c.json({ error: "Question is required" }, 400);
    }

    const ts = timestamp || new Date().toISOString();

    // ── Per-slug storage ─────────────────────────────────────────
    const effectiveSlug = slug || null;
    if (effectiveSlug) {
      const submittedPath = getSubmittedPath(effectiveSlug);
      const dir = path.dirname(submittedPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const existing: any[] = fs.existsSync(submittedPath)
        ? JSON.parse(fs.readFileSync(submittedPath, "utf-8"))
        : [];
      existing.push({
        id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        question: question.trim(),
        email: email?.trim() || null,
        slug: effectiveSlug,
        program: program || null,
        submitted_at: ts,
        status: "pending",
      });
      fs.writeFileSync(submittedPath, JSON.stringify(existing, null, 2));
    } else {
      // Legacy fallback: write to shared file
      const existing: any[] = fs.existsSync(LEGACY_SUBMITTED)
        ? JSON.parse(fs.readFileSync(LEGACY_SUBMITTED, "utf-8"))
        : [];
      existing.push({
        id: `q-${Date.now()}`,
        question: question.trim(),
        email: email?.trim() || null,
        program: program || null,
        submitted_at: ts,
        status: "pending",
      });
      fs.writeFileSync(LEGACY_SUBMITTED, JSON.stringify(existing, null, 2));
    }

    // ── Slack notification ───────────────────────────────────────
    const slackWebhookUrl = process.env.SLACK_FAQ_WEBHOOK_URL;
    if (slackWebhookUrl) {
      const slackMessage = {
        text: `New FAQ Question from ${program || effectiveSlug || "unknown"}`,
        blocks: [
          {
            type: "header",
            text: { type: "plain_text", text: `New Question: ${program || effectiveSlug || "FAQ"}`, emoji: true },
          },
          {
            type: "section",
            fields: [
              { type: "mrkdwn", text: `*Question:*\n${question.trim()}` },
              { type: "mrkdwn", text: `*Email:*\n${email?.trim() || "Not provided"}` },
            ],
          },
          {
            type: "section",
            fields: [
              { type: "mrkdwn", text: `*Slug:*\n${effectiveSlug || "n/a"}` },
              { type: "mrkdwn", text: `*Time:*\n${ts}` },
            ],
          },
        ],
      };
      await fetch(slackWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(slackMessage),
      }).catch(() => {});
    }

    return c.json({ success: true, message: "Question submitted successfully" });
  } catch (error) {
    console.error("submit-question error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
};
