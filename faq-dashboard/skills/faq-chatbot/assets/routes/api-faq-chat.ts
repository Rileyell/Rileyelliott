import type { Context } from "hono";
import * as fs from "fs";

// ── CONFIG ──────────────────────────────────────────────────────────────────
// Set REGISTRY_PATH to your event registry JSON file.
// The route reads everything else (program name, data file path, milestones)
// from that registry at request time — no hardcoding per event.

const REGISTRY_PATH = "/home/workspace/KITE_Scouting/faq-events.json";
const MINIMAX_API_URL = "https://api.concentrate.ai/v1/chat/completions";
const MINIMAX_MODEL = "minimax-m2-1-highspeed";
// ────────────────────────────────────────────────────────────────────────────

interface FaqEntry {
  id: string;
  question: string;
  answer: string;
  milestone?: string;
  status?: string;
}

interface EventRecord {
  slug: string;
  name: string;
  program?: string;
  dataFile?: string;
}

function loadFaqContext(slug: string): { programName: string; faqContext: string } | null {
  try {
    if (!fs.existsSync(REGISTRY_PATH)) return null;
    const registry: EventRecord[] = JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf-8"));
    const event = registry.find((e) => e.slug === slug);
    if (!event) return null;

    const programName = event.program || event.name;

    if (!event.dataFile || !fs.existsSync(event.dataFile)) {
      return { programName, faqContext: "" };
    }

    const entries: FaqEntry[] = JSON.parse(fs.readFileSync(event.dataFile, "utf-8"));
    const published = entries.filter((e) => !e.status || e.status === "published");

    // Group by milestone so the context is logically organized for the model
    const byMilestone: Record<string, FaqEntry[]> = {};
    for (const entry of published) {
      const key = entry.milestone || "General";
      if (!byMilestone[key]) byMilestone[key] = [];
      byMilestone[key].push(entry);
    }

    const sections = Object.entries(byMilestone).map(([milestone, items]) => {
      const qas = items
        .map((e) => `Q: ${e.question}\nA: ${e.answer || "No answer yet."}`)
        .join("\n\n");
      return `## ${milestone}\n${qas}`;
    });

    return { programName, faqContext: sections.join("\n\n") };
  } catch (err) {
    console.error("[faq-chat] Failed to load FAQ context:", err);
    return null;
  }
}

export default async (c: Context) => {
  try {
    const body = await c.req.json();
    const question: string = (body.question || body.message || "").trim();
    const slug: string = (body.slug || c.req.query("slug") || "").trim();
    const history: { role: "user" | "assistant"; content: string }[] = body.history || [];

    if (!question) return c.json({ error: "question is required" }, 400);
    if (!slug) return c.json({ error: "slug is required — pass the event slug from faq-events.json" }, 400);

    const apiKey = process.env.MINIMAX_API_KEY;
    if (!apiKey) return c.json({ error: "MINIMAX_API_KEY is not set. Add it in Settings > Advanced under Secrets." }, 500);

    const ctx = loadFaqContext(slug);
    if (!ctx) return c.json({ error: `No event found for slug: ${slug}` }, 404);

    const { programName, faqContext } = ctx;

    const systemPrompt = faqContext
      ? `You are a helpful FAQ assistant for the ${programName} program, powered by KITE Scouting.
Answer questions about the program using the FAQ knowledge base below.
Be concise (max 200 words). If a question is outside the FAQ scope, say so and suggest contacting the KITE Scouting team at hello@kitescouting.com.
Maintain a professional and friendly tone.

--- FAQ KNOWLEDGE BASE ---
${faqContext}
--- END FAQ KNOWLEDGE BASE ---`
      : `You are a helpful assistant for the ${programName} program, powered by KITE Scouting.
The FAQ knowledge base is still being populated. Politely let the user know and suggest contacting hello@kitescouting.com for now.`;

    const messages = [
      { role: "system" as const, content: systemPrompt },
      ...history.slice(-6), // last 3 turns of context
      { role: "user" as const, content: question },
    ];

    const response = await fetch(MINIMAX_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: MINIMAX_MODEL, messages, temperature: 0.5, max_tokens: 500 }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("[faq-chat] Minimax error:", err);
      return c.json({ error: "AI model request failed", detail: err.slice(0, 300) }, 502);
    }

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content || "I couldn't generate a response. Please try again.";

    return c.json({ response: answer, success: true, programName });
  } catch (err) {
    console.error("[faq-chat] error:", err);
    return c.json({ error: "Internal server error" }, 500);
  }
};
