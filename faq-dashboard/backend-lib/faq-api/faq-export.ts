import type { Context } from "hono";
import * as fs from "fs";
import { REGISTRY_PATH, resolveDataFile } from "./paths";

export default async (c: Context) => {
  try {
    const slug = c.req.query("slug");
    if (!slug) return c.json({ error: "slug is required" }, 400);

    if (!fs.existsSync(REGISTRY_PATH)) return c.json({ error: "Event registry not found" }, 404);

    const events = JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf-8"));
    const event = events.find((e: any) => e.slug === slug);
    if (!event) return c.json({ error: `Event '${slug}' not found` }, 404);

    const dataPath = resolveDataFile(event);
    if (!fs.existsSync(dataPath)) return c.json({ error: "No FAQ data file found for this event" }, 404);

    const entries: any[] = JSON.parse(fs.readFileSync(dataPath, "utf-8"));

    // Filter to published only
    const published = entries.filter(e => (e.status || "published") === "published");
    const drafts = entries.filter(e => e.status === "draft");

    // Group by milestone
    const milestones: string[] = event.milestones || [];
    const grouped = new Map<string, any[]>();
    for (const m of milestones) grouped.set(m, []);
    for (const entry of published) {
      const m = entry.milestone || "General";
      if (!grouped.has(m)) grouped.set(m, []);
      grouped.get(m)!.push(entry);
    }

    const today = new Date().toISOString().slice(0, 10);
    const lines: string[] = [
      `# ${event.name} — FAQ Export`,
      `**Client:** ${event.client}  `,
      `**Slug:** \`${slug}\`  `,
      `**Exported:** ${today}  `,
      `**Published:** ${published.length}  |  **Drafts:** ${drafts.length}`,
      "",
      "---",
      "",
    ];

    for (const [milestone, items] of grouped.entries()) {
      lines.push(`## ${milestone}`, "");
      if (items.length === 0) {
        lines.push("_No entries yet._", "");
        continue;
      }
      for (const faq of items) {
        lines.push(`### ${faq.question}`, "");
        if (faq.answer?.trim()) {
          lines.push(faq.answer.trim(), "");
        } else {
          lines.push("_No answer yet._", "");
        }
        const meta: string[] = [];
        if (faq.audience && faq.audience !== "General") meta.push(`**Audience:** ${faq.audience}`);
        if (faq.source) meta.push(`**Source:** ${faq.source}`);
        if (meta.length) lines.push(`> ${meta.join("  |  ")}`, "");
      }
    }

    // Append any entries not in a named milestone
    const namedMilestones = new Set(milestones);
    const ungrouped = published.filter(e => !namedMilestones.has(e.milestone || ""));
    if (ungrouped.length > 0) {
      lines.push("## Other", "");
      for (const faq of ungrouped) {
        lines.push(`### ${faq.question}`, "");
        lines.push(faq.answer?.trim() || "_No answer yet._", "");
      }
    }

    const markdown = lines.join("\n");
    const filename = `${slug}-faq-export.md`;

    return new Response(markdown, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("[faq/export] error:", err);
    return new Response(JSON.stringify({ error: "Export failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
