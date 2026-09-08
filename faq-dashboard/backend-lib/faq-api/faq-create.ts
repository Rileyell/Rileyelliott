import type { Context } from "hono";
import * as fs from "fs";
import { randomUUID } from "crypto";

const REGISTRY_PATH = "/home/workspace/faq-dashboard/data/faq-events.json";

function getDataFile(program: string, slug?: string): string | null {
  if (!fs.existsSync(REGISTRY_PATH)) return null;
  const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf-8"));
  const event = registry.find(
    (e: any) => (slug ? e.slug === slug : e.program === program)
  );
  return event?.dataFile || null;
}

export default async (c: Context) => {
  try {
    const body = await c.req.json();
    const { program, slug, question, answer, milestone, audience, status, source } = body;

    if (!question?.trim()) {
      return c.json({ error: "Missing required field: question" }, 400);
    }

    const dataFile = getDataFile(program || "", slug);
    if (!dataFile) return c.json({ error: "Event not found in registry" }, 404);
    if (!fs.existsSync(dataFile)) return c.json({ error: "Data file not found" }, 404);

    const data: any[] = JSON.parse(fs.readFileSync(dataFile, "utf-8"));

    const newEntry = {
      id: randomUUID(),
      program: program || "",
      question: question.trim(),
      answer: answer?.trim() || "",
      milestone: milestone || "General",
      audience: audience || "General",
      status: status || "published",
      source: source || "manual",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    data.push(newEntry);
    fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));

    return c.json({ success: true, entry: newEntry });
  } catch (err) {
    console.error("faq/create error:", err);
    return c.json({ error: "Failed to create entry" }, 500);
  }
};
