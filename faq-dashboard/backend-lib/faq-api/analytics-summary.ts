import type { Context } from "hono";
import * as fs from "fs";

const LOG_FILE = "/home/workspace/faq-dashboard/data/analytics.jsonl";

interface RawEvent {
  ts: string;
  type: string;
  slug: string;
  session: string;
  data: Record<string, unknown>;
}

interface SlugSummary {
  page_views: number;
  unique_sessions: Set<string>;
  search_queries: number;
  chatbot_queries: number;
  chatbot_unmatched: number;
  questions_submitted: number;
  first_seen: string;
  last_seen: string;
}

function normalise(term: string): string {
  return term.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

function topN(map: Map<string, number>, n = 15): { term: string; count: number }[] {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([term, count]) => ({ term, count }));
}

export default async (c: Context) => {
  try {
    const daysParam = Number(c.req.query("days") || "30");
    const days = Math.min(Math.max(daysParam, 1), 365);
    const since = new Date(Date.now() - days * 86400 * 1000);

    if (!fs.existsSync(LOG_FILE)) {
      return c.json({
        period_days: days,
        since: since.toISOString(),
        summary: {},
        topSearches: [],
        topChatbotQueries: [],
        topUnmatched: [],
        submittedQuestions: [],
        dailyViews: {},
      });
    }

    const raw = fs.readFileSync(LOG_FILE, "utf-8");
    const lines = raw.trim().split("\n").filter(Boolean);
    const events: RawEvent[] = [];
    for (const line of lines) {
      try {
        const e = JSON.parse(line) as RawEvent;
        if (new Date(e.ts) >= since) events.push(e);
      } catch { /* skip malformed */ }
    }

    const slugMap = new Map<string, SlugSummary>();
    const searchTerms = new Map<string, number>();
    const chatbotTerms = new Map<string, number>();
    const unmatchedTerms = new Map<string, number>();
    const submittedQuestions: { question: string; slug: string; ts: string }[] = [];
    const dailyViews = new Map<string, number>();

    for (const e of events) {
      if (!slugMap.has(e.slug)) {
        slugMap.set(e.slug, {
          page_views: 0,
          unique_sessions: new Set(),
          search_queries: 0,
          chatbot_queries: 0,
          chatbot_unmatched: 0,
          questions_submitted: 0,
          first_seen: e.ts,
          last_seen: e.ts,
        });
      }
      const s = slugMap.get(e.slug)!;

      if (e.session) s.unique_sessions.add(e.session);
      if (e.ts < s.first_seen) s.first_seen = e.ts;
      if (e.ts > s.last_seen) s.last_seen = e.ts;

      if (e.type === "page_view") {
        s.page_views++;
        const day = e.ts.slice(0, 10);
        dailyViews.set(day, (dailyViews.get(day) || 0) + 1);
      } else if (e.type === "search") {
        s.search_queries++;
        const term = normalise(String(e.data.term || ""));
        if (term) searchTerms.set(term, (searchTerms.get(term) || 0) + 1);
      } else if (e.type === "chatbot_query") {
        s.chatbot_queries++;
        const q = normalise(String(e.data.question || ""));
        if (q) chatbotTerms.set(q, (chatbotTerms.get(q) || 0) + 1);
        const matched = e.data.matched !== false;
        if (!matched) {
          s.chatbot_unmatched++;
          if (q) unmatchedTerms.set(q, (unmatchedTerms.get(q) || 0) + 1);
        }
      } else if (e.type === "question_submitted") {
        s.questions_submitted++;
        const question = String(e.data.question || "").slice(0, 300);
        if (question) submittedQuestions.push({ question, slug: e.slug, ts: e.ts });
      }
    }

    const summary: Record<string, {
      page_views: number;
      unique_sessions: number;
      search_queries: number;
      chatbot_queries: number;
      chatbot_unmatched: number;
      chatbot_unmatched_rate: number;
      questions_submitted: number;
      first_seen: string;
      last_seen: string;
    }> = {};

    for (const [slug, s] of slugMap.entries()) {
      summary[slug] = {
        page_views: s.page_views,
        unique_sessions: s.unique_sessions.size,
        search_queries: s.search_queries,
        chatbot_queries: s.chatbot_queries,
        chatbot_unmatched: s.chatbot_unmatched,
        chatbot_unmatched_rate: s.chatbot_queries > 0
          ? Math.round((s.chatbot_unmatched / s.chatbot_queries) * 100)
          : 0,
        questions_submitted: s.questions_submitted,
        first_seen: s.first_seen,
        last_seen: s.last_seen,
      };
    }

    submittedQuestions.sort((a, b) => b.ts.localeCompare(a.ts));

    return c.json({
      period_days: days,
      since: since.toISOString(),
      summary,
      topSearches: topN(searchTerms),
      topChatbotQueries: topN(chatbotTerms),
      topUnmatched: topN(unmatchedTerms),
      submittedQuestions: submittedQuestions.slice(0, 50),
      dailyViews: Object.fromEntries([...dailyViews.entries()].sort()),
    });
  } catch (err) {
    console.error("[analytics/summary] error:", err);
    return c.json({ error: "Internal server error" }, 500);
  }
};
