import { useState, useEffect, useCallback } from "react";
import { Trash2, Plus, Edit2, Save, X, RefreshCw, ExternalLink, Sparkles, Check, Inbox, BarChart2, Download } from "lucide-react";


const K = {
  bg: "#ffffff",
  bgLight: "#f9fafb",
  card: "rgba(16, 16, 15, 0.88)",
  cardBorder: "#e5e7eb",
  text: "#10100f",
  textLight: "#f5f1e8",
  textMuted: "#6b7280",
  textMutedLight: "#aaa39a",
};

interface FAQEntry {
  id: string;
  program: string;
  question: string;
  answer: string;
  milestone: string;
  audience?: string;
  status?: string;
  source?: string;
}

interface EventConfig {
  slug: string;
  name: string;
  program: string;
  client: string;
  accent: string;
  adminPath: string;
  clientPath: string;
  eventUrl?: string;
  milestones: string[];
  audiences: string[];
  active: boolean;
}

interface SubmittedQuestion {
  id: string;
  question: string;
  email?: string | null;
  slug: string;
  program?: string | null;
  submitted_at: string;
  status: "pending" | "resolved" | "dismissed";
}

interface AnalyticsSummary {
  period_days: number;
  since: string;
  summary: Record<string, {
    page_views: number;
    unique_sessions: number;
    search_queries: number;
    chatbot_queries: number;
    chatbot_unmatched: number;
    chatbot_unmatched_rate: number;
    questions_submitted: number;
    first_seen: string;
    last_seen: string;
  }>;
  topSearches: { term: string; count: number }[];
  topChatbotQueries: { term: string; count: number }[];
  topUnmatched: { term: string; count: number }[];
  submittedQuestions: { question: string; slug: string; ts: string }[];
  dailyViews: Record<string, number>;
}

function EventAnalyticsPanel({ analytics, loading, slug, eventName, days, onDaysChange, accent }: {
  analytics: AnalyticsSummary | null;
  loading: boolean;
  slug: string;
  eventName: string;
  days: number;
  onDaysChange: (d: number) => void;
  accent: string;
}) {
  const Kp = { bg: "#ffffff", bgLight: "#f9fafb", cardBorder: "#e5e7eb", text: "#10100f", textMuted: "#6b7280" };

  if (loading) return <div style={{ textAlign: "center", padding: "64px", color: Kp.textMuted }}>Loading analytics…</div>;

  const slugData = analytics?.summary?.[slug];

  const kpiTile = (label: string, value: number | string, sub?: string) => (
    <div style={{ flex: 1, minWidth: "130px", padding: "18px 20px", borderRadius: "14px", border: `1px solid ${Kp.cardBorder}`, backgroundColor: Kp.bgLight }}>
      <div style={{ fontSize: "1.8rem", fontWeight: 800, color: Kp.text, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: "0.72rem", fontWeight: 700, color: Kp.textMuted, marginTop: "6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
      {sub && <div style={{ fontSize: "0.68rem", color: Kp.textMuted, marginTop: "3px" }}>{sub}</div>}
    </div>
  );

  const termTable = (title: string, items: { term: string; count: number }[], note?: string) => (
    <div style={{ borderRadius: "14px", border: `1px solid ${Kp.cardBorder}`, overflow: "hidden", marginBottom: "16px" }}>
      <div style={{ padding: "12px 16px", borderBottom: `1px solid ${Kp.cardBorder}`, backgroundColor: Kp.bgLight, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "0.82rem", fontWeight: 700, color: Kp.text }}>{title}</span>
        {note && <span style={{ fontSize: "0.7rem", color: Kp.textMuted }}>{note}</span>}
      </div>
      {items.length === 0 ? (
        <div style={{ padding: "18px 16px", color: Kp.textMuted, fontSize: "0.82rem" }}>No data yet.</div>
      ) : (
        items.slice(0, 10).map((item, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 16px", borderBottom: i < items.length - 1 ? `1px solid ${Kp.cardBorder}` : "none" }}>
            <span style={{ fontSize: "0.85rem", color: Kp.text, flex: 1 }}>{item.term}</span>
            <span style={{ fontSize: "0.78rem", fontWeight: 700, color: Kp.textMuted, marginLeft: "12px" }}>×{item.count}</span>
          </div>
        ))
      )}
    </div>
  );

  // Filter signal tables to this slug only
  const slugSearches = (analytics?.topSearches || []);
  const slugChatbot = (analytics?.topChatbotQueries || []);
  const slugUnmatched = (analytics?.topUnmatched || []);
  const slugSubmitted = (analytics?.submittedQuestions || []).filter(q => q.slug === slug);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <h2 style={{ fontSize: "1rem", fontWeight: 800, color: Kp.text, margin: "0 0 3px" }}>Analytics — {eventName}</h2>
          <p style={{ fontSize: "0.78rem", color: Kp.textMuted, margin: 0 }}>Event-level engagement data</p>
        </div>
        <div style={{ display: "flex", gap: "6px" }}>
          {[7, 30, 90].map(d => (
            <button key={d} onClick={() => onDaysChange(d)}
              style={{ padding: "5px 12px", borderRadius: "8px", border: `1px solid ${days === d ? Kp.text : Kp.cardBorder}`, backgroundColor: days === d ? Kp.text : "#fff", color: days === d ? "#fff" : Kp.textMuted, fontSize: "0.78rem", fontWeight: 700, cursor: "pointer" }}>
              {d}d
            </button>
          ))}
        </div>
      </div>

      {!slugData ? (
        <div style={{ textAlign: "center", padding: "64px 32px", borderRadius: "16px", border: `2px dashed ${Kp.cardBorder}`, color: Kp.textMuted }}>
          <BarChart2 size={32} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
          <p style={{ fontWeight: 600, marginBottom: "6px" }}>No data yet for this event</p>
          <p style={{ fontSize: "0.82rem", margin: 0 }}>Analytics start tracking once clients visit the FAQ page.</p>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "28px" }}>
            {kpiTile("Page Views", slugData.page_views, `last ${days} days`)}
            {kpiTile("Unique Sessions", slugData.unique_sessions)}
            {kpiTile("AI Chatbot Queries", slugData.chatbot_queries)}
            {kpiTile("Unmatched Rate", `${slugData.chatbot_unmatched_rate}%`, "AI couldn't answer")}
            {kpiTile("Questions Submitted", slugData.questions_submitted)}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
            <div>{termTable("Top Searches", slugSearches, "what attendees search")}</div>
            <div>{termTable("Top AI Queries", slugChatbot, "questions asked to chatbot")}</div>
          </div>

          {termTable("AI Gaps — Unmatched Queries", slugUnmatched, "add FAQs to cover these")}

          {slugSubmitted.length > 0 && (
            <div style={{ borderRadius: "14px", border: `1px solid ${Kp.cardBorder}`, overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", borderBottom: `1px solid ${Kp.cardBorder}`, backgroundColor: Kp.bgLight }}>
                <span style={{ fontSize: "0.82rem", fontWeight: 700, color: Kp.text }}>Submitted Questions</span>
              </div>
              {slugSubmitted.map((q, i) => (
                <div key={i} style={{ padding: "11px 16px", borderBottom: i < slugSubmitted.length - 1 ? `1px solid ${Kp.cardBorder}` : "none" }}>
                  <div style={{ fontSize: "0.85rem", color: Kp.text, marginBottom: "2px" }}>{q.question}</div>
                  <div style={{ fontSize: "0.7rem", color: Kp.textMuted }}>{new Date(q.ts).toLocaleDateString()}</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function FAQEventAdmin() {
  const [eventConfig, setEventConfig] = useState<EventConfig | null>(null);
  const [faqs, setFaqs] = useState<FAQEntry[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<FAQEntry>>({});
  const [newEntry, setNewEntry] = useState({ question: "", answer: "", milestone: "", audience: "General" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [activeTab, setActiveTab] = useState<"published" | "drafts" | "analytics">("published");
  const [scraping, setScraping] = useState(false);
  const [scrapeMsg, setScrapeMsg] = useState("");
  const [scrapeUrl, setScrapeUrl] = useState("");
  const [submitted, setSubmitted] = useState<SubmittedQuestion[]>([]);
  const [loadingSubmitted, setLoadingSubmitted] = useState(false);
  const [inboxMsg, setInboxMsg] = useState("");
  const [analytics, setAnalytics] = useState<any | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsDays, setAnalyticsDays] = useState(30);
  const [exporting, setExporting] = useState(false);

  const slug = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "").get("slug") || "";
  const ACCENT = eventConfig?.accent || "#d8a657";

  useEffect(() => {
    if (!slug) return;
    fetch("/api/events/list", { headers: { Accept: "application/json" } })
      .then(r => r.json())
      .then(d => {
        const ev = (d.events || []).find((e: EventConfig) => e.slug === slug);
        if (ev) {
          setEventConfig(ev);
          setNewEntry(prev => ({ ...prev, milestone: ev.milestones?.[0] || "General", audience: ev.audiences?.[0] || "General" }));
        }
      });
  }, [slug]);

  const fetchEventConfig = useCallback(async () => {
    if (!slug) return;
    const d = await fetch("/api/events/list", { headers: { Accept: "application/json" } }).then(r => r.json()).catch(() => ({}));
    const ev = (d.events || []).find((e: EventConfig) => e.slug === slug);
    if (ev) {
      setEventConfig(ev);
      setNewEntry(prev => ({ ...prev, milestone: ev.milestones?.[0] || "General", audience: ev.audiences?.[0] || "General" }));
    }
  }, [slug]);

  const fetchFAQs = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/faq/list?slug=${slug}`, { headers: { Accept: "application/json" } });
      const d = await r.json();
      setFaqs(d.entries || []);
    } catch (e) {
      console.error("Failed to load FAQs:", e);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  const fetchSubmitted = useCallback(async () => {
    if (!slug) return;
    setLoadingSubmitted(true);
    try {
      const r = await fetch(`/api/faq/list-submitted?slug=${slug}`, { headers: { Accept: "application/json" } });
      const d = await r.json();
      setSubmitted((d.questions || []).filter((q: any) => q.status === "pending"));
    } catch (e) {
      console.error("Failed to load submitted questions:", e);
    } finally {
      setLoadingSubmitted(false);
    }
  }, [slug]);

  useEffect(() => {
    if (!slug) return;
    fetchFAQs();
    fetchSubmitted();
  }, [slug, fetchFAQs, fetchSubmitted]);

  const loadAnalytics = useCallback(async (days: number) => {
    if (!slug) return;
    setAnalyticsLoading(true);
    try {
      const r = await fetch(`/api/analytics/summary?days=${days}&slug=${slug}`, { headers: { Accept: "application/json" } });
      const d = await r.json();
      setAnalytics(d);
    } catch { } finally { setAnalyticsLoading(false); }
  }, [slug]);

  const fetchAnalytics = useCallback(async (days: number) => {
    if (!slug) return;
    setAnalyticsLoading(true);
    try {
      const r = await fetch(`/api/analytics/summary?days=${days}`, { headers: { Accept: "application/json" } });
      const d = await r.json();
      setAnalytics(d);
    } catch (e) { console.error("Failed to load analytics:", e); }
    finally { setAnalyticsLoading(false); }
  }, [slug]);

  useEffect(() => {
    if (activeTab === "analytics" && slug) {
      loadAnalytics(analyticsDays);
    }
  }, [activeTab, slug, analyticsDays, loadAnalytics]);

  const dismissQuestion = async (id: string) => {
    try {
      await fetch("/api/faq/dismiss-question", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ id, slug }),
      });
      setSubmitted(prev => prev.filter(q => q.id !== id));
    } catch (e) { console.error(e); }
  };

  const promoteToFAQ = async (q: any) => {
    setSaving(true);
    try {
      const res = await fetch("/api/faq/create", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          slug,
          program: eventConfig?.program,
          question: q.question,
          answer: "",
          milestone: eventConfig?.milestones?.[0] || "General",
          audience: eventConfig?.audiences?.[0] || "General",
          status: "draft",
          source: "submitted",
        }),
      });
      if (res.ok) {
        await fetch("/api/faq/dismiss-question", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ id: q.id, slug, action: "resolved" }),
        });
        setInboxMsg("✓ Moved to AI Drafts tab — add an answer and approve to publish");
        setTimeout(() => setInboxMsg(""), 4000);
        fetchSubmitted();
        fetchFAQs();
      } else {
        setInboxMsg("✗ Failed to create draft");
        setTimeout(() => setInboxMsg(""), 3000);
      }
    } catch { setInboxMsg("✗ Error"); } finally { setSaving(false); }
  };

  const showMsg = (text: string) => {
    setMsg(text);
    setTimeout(() => setMsg(""), 3000);
  };

  const handleCreate = async () => {
    if (!newEntry.question.trim()) { alert("Question is required"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/faq/create", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ slug, program: eventConfig?.program, ...newEntry, status: "published", source: "manual" }),
      });
      if (res.ok) {
        showMsg("✓ FAQ added");
        setNewEntry(prev => ({ ...prev, question: "", answer: "" }));
        fetchFAQs();
      } else { showMsg("✗ Failed to add"); }
    } catch { showMsg("✗ Error"); } finally { setSaving(false); }
  };

  const handleUpdate = async (id: string, updates: Partial<FAQEntry>) => {
    setSaving(true);
    try {
      const res = await fetch("/api/faq/update", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ id, slug, program: eventConfig?.program, ...updates }),
      });
      if (res.ok) { showMsg("✓ Saved"); setEditingId(null); fetchFAQs(); }
      else { showMsg("✗ Failed to save"); }
    } catch { showMsg("✗ Error"); } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this FAQ?")) return;
    try {
      const res = await fetch("/api/faq/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ id, slug, program: eventConfig?.program }),
      });
      if (res.ok) fetchFAQs();
    } catch (e) { console.error(e); }
  };

  const approveDraft = (faq: FAQEntry) => handleUpdate(faq.id, { status: "published" });
  const rejectDraft = (id: string) => handleDelete(id);

  const triggerScrape = async () => {
    const url = scrapeUrl.trim() || eventConfig?.eventUrl || "";
    if (!url) { setScrapeMsg("Enter a URL to scrape."); return; }
    setScraping(true); setScrapeMsg("");
    try {
      const res = await fetch("/api/events/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ slug, url }),
      });
      const d = await res.json();
      if (res.ok) {
        setScrapeMsg("✓ " + d.message);
        setTimeout(() => { setScrapeMsg(""); fetchFAQs(); fetchEventConfig(); }, 180000);
      } else { setScrapeMsg("✗ " + (d.error || "Scrape failed")); }
    } catch { setScrapeMsg("✗ Network error"); } finally { setScraping(false); }
  };

  const handleExport = async () => {
    if (!slug) return;
    setExporting(true);
    try {
      const res = await fetch(`/api/faq/export?slug=${slug}`, { headers: { Accept: "text/markdown" } });
      if (!res.ok) { showMsg("✗ Export failed"); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${slug}-faq-export.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch { showMsg("✗ Export error"); }
    finally { setExporting(false); }
  };

  const published = faqs.filter(f => (f.status || "published") === "published");
  const drafts = faqs.filter(f => f.status === "draft");
  const pendingQs = submitted.filter(q => q.status === "pending");
  const milestones: string[] = eventConfig?.milestones || [];
  const audiences: string[] = eventConfig?.audiences || ["General"];

  const groupedPublished = milestones.map(m => ({ milestone: m, entries: published.filter(f => f.milestone === m) }));
  const otherPublished = published.filter(f => !milestones.includes(f.milestone));
  if (!slug) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: K.textMuted }}>
      No slug provided — <a href="/" style={{ color: ACCENT, marginLeft: "4px" }}>go to hub</a>
    </div>
  );

  return (
    <div style={{ backgroundColor: K.bg, minHeight: "100vh" }}>
      <header style={{ borderBottom: `1px solid ${K.cardBorder}` }}>
        <div style={{ maxWidth: "960px", margin: "0 auto", padding: "24px 32px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <a href="/" style={{ fontSize: "0.78rem", color: K.textMuted, textDecoration: "none", display: "flex", alignItems: "center", gap: "4px" }}>
                ← Hub
              </a>
              <span style={{ color: K.cardBorder }}>|</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <img src="/images/brand-logo.svg" alt="Brand Logo" style={{ height: "22px" }} />
            </div>
          </div>

          <div style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.1em", color: ACCENT, textTransform: "uppercase", marginBottom: "6px" }}>
            {eventConfig?.client?.toUpperCase() || slug.toUpperCase()}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px", marginBottom: "16px" }}>
            <div>
              <h1 style={{ fontSize: "1.8rem", fontWeight: 800, color: K.text, margin: "0 0 4px" }}>
                {eventConfig?.name || slug} — FAQ Management
              </h1>
              <p style={{ color: K.textMuted, fontSize: "0.85rem", margin: 0 }}>
                {published.length} published · {drafts.length} drafts
              </p>
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexShrink: 0, flexWrap: "wrap" }}>
              {msg && (
                <span style={{ fontSize: "0.82rem", fontWeight: 600, padding: "5px 12px", borderRadius: "999px", background: msg.includes("✗") ? "#fee2e2" : "#dcfce7", color: msg.includes("✗") ? "#dc2626" : "#16a34a" }}>
                  {msg}
                </span>
              )}
              <a href={`/api/faq/export?slug=${slug}`} download
                style={{ display: "flex", alignItems: "center", gap: "5px", padding: "8px 12px", borderRadius: "10px", border: `1px solid ${K.cardBorder}`, background: K.bgLight, color: K.textMuted, fontSize: "0.82rem", textDecoration: "none" }}>
                <Download size={13} /> Export MD
              </a>
              <button onClick={fetchFAQs}
                style={{ display: "flex", alignItems: "center", gap: "5px", padding: "8px 12px", borderRadius: "10px", border: `1px solid ${K.cardBorder}`, background: K.bgLight, color: K.textMuted, fontSize: "0.82rem", cursor: "pointer" }}>
                <RefreshCw size={13} /> Refresh
              </button>
              {eventConfig?.clientPath && (
                <a href={eventConfig.clientPath} target="_blank" rel="noopener"
                  style={{ display: "flex", alignItems: "center", gap: "5px", padding: "8px 14px", borderRadius: "10px", backgroundColor: ACCENT, color: "#10100f", fontWeight: 700, fontSize: "0.82rem", textDecoration: "none" }}>
                  <ExternalLink size={13} /> View FAQ Page
                </a>
              )}
            </div>
          </div>

          {/* Scrape banner */}
          <div style={{ padding: "14px 16px", borderRadius: "12px", border: `1px solid ${K.cardBorder}`, backgroundColor: K.bgLight, marginBottom: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px" }}>
              <Sparkles size={14} style={{ color: ACCENT }} />
              <span style={{ fontSize: "0.82rem", color: K.text, fontWeight: 700 }}>AI Auto-Generate FAQs</span>
              <span style={{ fontSize: "0.78rem", color: K.textMuted }}>— paste any URL and we'll scrape it and write the Q&As</span>
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
              <input
                type="url"
                value={scrapeUrl}
                onChange={e => setScrapeUrl(e.target.value)}
                placeholder={eventConfig?.eventUrl || "https://example.com"}
                style={{ flex: 1, minWidth: "220px", padding: "8px 12px", borderRadius: "8px", border: `1px solid ${K.cardBorder}`, fontSize: "0.82rem", backgroundColor: "#fff", color: K.text, outline: "none" }}
              />
              <button onClick={triggerScrape} disabled={scraping}
                style={{ display: "flex", alignItems: "center", gap: "5px", padding: "8px 16px", borderRadius: "9px", backgroundColor: ACCENT, color: "#10100f", fontWeight: 700, fontSize: "0.8rem", border: "none", cursor: scraping ? "not-allowed" : "pointer", opacity: scraping ? 0.7 : 1, whiteSpace: "nowrap" }}>
                <Sparkles size={12} /> {scraping ? "Scraping…" : "Scrape & Generate"}
              </button>
            </div>
            {scrapeMsg && (
              <p style={{ margin: "8px 0 0", fontSize: "0.78rem", fontWeight: 600, color: scrapeMsg.startsWith("✓") ? "#16a34a" : "#dc2626" }}>{scrapeMsg}</p>
            )}
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: "4px" }}>
            {[
              { key: "published", label: `Published (${published.length})` },
              { key: "drafts", label: `AI Drafts (${drafts.length + submitted.length})`, highlight: drafts.length + submitted.length > 0 },
            ].map(({ key, label, highlight }) => (
              <button key={key} onClick={() => setActiveTab(key as any)}
                style={{ padding: "7px 18px", borderRadius: "8px 8px 0 0", border: "none", background: activeTab === key ? (highlight ? "#fef3c7" : ACCENT) : "transparent",
                  color: activeTab === key ? (highlight ? "#92400e" : "#10100f") : K.textMuted, fontWeight: 700, fontSize: "0.82rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "5px" }}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main style={{ maxWidth: "960px", margin: "0 auto", padding: "32px" }}>

        {/* ANALYTICS TAB */}
        {activeTab === "analytics" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
              <h2 style={{ fontSize: "1rem", fontWeight: 800, color: K.text, margin: 0 }}>
                Analytics — {eventConfig?.name || slug}
              </h2>
              <div style={{ display: "flex", gap: "6px" }}>
                {[7, 30, 90].map(d => (
                  <button key={d} onClick={() => setAnalyticsDays(d)}
                    style={{ padding: "5px 12px", borderRadius: "8px", border: `1px solid ${analyticsDays === d ? K.text : K.cardBorder}`, backgroundColor: analyticsDays === d ? K.text : "#fff", color: analyticsDays === d ? "#fff" : K.textMuted, fontSize: "0.78rem", fontWeight: 700, cursor: "pointer" }}>
                    {d}d
                  </button>
                ))}
              </div>
            </div>

            {analyticsLoading ? (
              <div style={{ textAlign: "center", padding: "64px", color: K.textMuted }}>Loading analytics…</div>
            ) : !analytics ? (
              <div style={{ textAlign: "center", padding: "48px 32px", borderRadius: "16px", border: `2px dashed ${K.cardBorder}`, color: K.textMuted }}>
                <BarChart2 size={28} style={{ margin: "0 auto 12px", opacity: 0.4 }} />
                <p style={{ fontWeight: 600, margin: "0 0 6px" }}>No analytics yet</p>
                <p style={{ fontSize: "0.82rem", margin: 0 }}>Analytics begin tracking when clients visit the FAQ page.</p>
              </div>
            ) : (() => {
              const s = analytics.summary?.[slug] || null;
              if (!s) return (
                <div style={{ textAlign: "center", padding: "48px 32px", borderRadius: "16px", border: `2px dashed ${K.cardBorder}`, color: K.textMuted }}>
                  <p style={{ fontWeight: 600, margin: "0 0 6px" }}>No data for this event yet</p>
                  <p style={{ fontSize: "0.82rem", margin: 0 }}>Data appears once clients start viewing the FAQ page.</p>
                </div>
              );

              const kpi = (label: string, value: number | string, sub?: string) => (
                <div style={{ flex: 1, minWidth: "130px", padding: "18px 16px", borderRadius: "12px", border: `1px solid ${K.cardBorder}`, backgroundColor: K.bgLight }}>
                  <div style={{ fontSize: "1.8rem", fontWeight: 800, color: K.text, lineHeight: 1 }}>{value}</div>
                  <div style={{ fontSize: "0.72rem", fontWeight: 700, color: K.textMuted, marginTop: "5px", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
                  {sub && <div style={{ fontSize: "0.7rem", color: K.textMuted, marginTop: "2px" }}>{sub}</div>}
                </div>
              );

              const termTable = (title: string, items: { term: string; count: number }[], note?: string) => (
                <div style={{ borderRadius: "12px", border: `1px solid ${K.cardBorder}`, overflow: "hidden", marginBottom: "14px" }}>
                  <div style={{ padding: "12px 16px", borderBottom: `1px solid ${K.cardBorder}`, backgroundColor: K.bgLight, display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "0.8rem", fontWeight: 700, color: K.text }}>{title}</span>
                    {note && <span style={{ fontSize: "0.7rem", color: K.textMuted }}>{note}</span>}
                  </div>
                  {items.length === 0 ? (
                    <div style={{ padding: "16px", color: K.textMuted, fontSize: "0.82rem" }}>No data yet.</div>
                  ) : items.slice(0, 8).map((item, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 16px", borderBottom: i < Math.min(items.length, 8) - 1 ? `1px solid ${K.cardBorder}` : "none" }}>
                      <span style={{ fontSize: "0.84rem", color: K.text, flex: 1 }}>{item.term}</span>
                      <span style={{ fontSize: "0.76rem", fontWeight: 700, color: K.textMuted, marginLeft: "12px" }}>×{item.count}</span>
                    </div>
                  ))}
                </div>
              );

              // Filter analytics data to this slug only
              const slugSearches = (analytics.topSearches || []).filter((_: any) => true);
              const slugChatbot = (analytics.topChatbotQueries || []).filter((_: any) => true);
              const slugUnmatched = (analytics.topUnmatched || []).filter((_: any) => true);
              const slugSubmitted = (analytics.submittedQuestions || []).filter((q: any) => q.slug === slug);

              return (
                <div>
                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "24px" }}>
                    {kpi("Page Views", s.page_views, `last ${analyticsDays}d`)}
                    {kpi("Unique Sessions", s.unique_sessions)}
                    {kpi("Searches", s.search_queries)}
                    {kpi("AI Chatbot Queries", s.chatbot_queries)}
                    {kpi("Questions Submitted", s.questions_submitted)}
                    {s.chatbot_queries > 0 && kpi("AI Unmatched %", `${s.chatbot_unmatched_rate}%`, "queries AI couldn't answer")}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "14px" }}>
                    <div>{termTable("Top Searches", slugSearches)}</div>
                    <div>{termTable("Top AI Queries", slugChatbot)}</div>
                  </div>
                  {termTable("AI Gaps — Unmatched Queries", slugUnmatched, "add FAQs for these")}
                  {slugSubmitted.length > 0 && (
                    <div style={{ borderRadius: "12px", border: `1px solid ${K.cardBorder}`, overflow: "hidden" }}>
                      <div style={{ padding: "12px 16px", borderBottom: `1px solid ${K.cardBorder}`, backgroundColor: K.bgLight }}>
                        <span style={{ fontSize: "0.8rem", fontWeight: 700, color: K.text }}>Submitted Questions</span>
                      </div>
                      {slugSubmitted.map((q: any, i: number) => (
                        <div key={i} style={{ padding: "11px 16px", borderBottom: i < slugSubmitted.length - 1 ? `1px solid ${K.cardBorder}` : "none" }}>
                          <div style={{ fontSize: "0.84rem", color: K.text, marginBottom: "2px" }}>{q.question}</div>
                          <div style={{ fontSize: "0.7rem", color: K.textMuted }}>{new Date(q.ts).toLocaleDateString()}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* DRAFTS TAB */}
        {activeTab === "drafts" && (
          <div>
            {/* Section: Questions from Users (via "Ask an admin") */}
            <div style={{ marginBottom: "32px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                <div>
                  <h2 style={{ fontSize: "0.95rem", fontWeight: 700, color: K.text, margin: "0 0 4px" }}>
                    Questions from Users{submitted.length > 0 ? ` (${submitted.length})` : ""}
                  </h2>
                  <p style={{ fontSize: "0.8rem", color: K.textMuted, margin: 0 }}>Submitted via "Ask an admin" on the FAQ page. Promote to a draft FAQ or dismiss.</p>
                </div>
                <button onClick={fetchSubmitted} style={{ display: "flex", alignItems: "center", gap: "5px", padding: "7px 12px", borderRadius: "8px", border: `1px solid ${K.cardBorder}`, background: K.bgLight, color: K.textMuted, fontSize: "0.8rem", cursor: "pointer" }}>
                  <RefreshCw size={12} /> Refresh
                </button>
              </div>
              {inboxMsg && (
                <div style={{ marginBottom: "14px", padding: "10px 16px", borderRadius: "10px", background: inboxMsg.startsWith("✓") ? "#f0fdf4" : "#fee2e2", color: inboxMsg.startsWith("✓") ? "#16a34a" : "#dc2626", fontSize: "0.85rem", fontWeight: 600 }}>
                  {inboxMsg}
                </div>
              )}
              {loadingSubmitted ? (
                <div style={{ textAlign: "center", padding: "32px", color: K.textMuted }}>Loading…</div>
              ) : submitted.length === 0 ? (
                <div style={{ textAlign: "center", padding: "28px 24px", borderRadius: "14px", border: `2px dashed ${K.cardBorder}`, color: K.textMuted }}>
                  <p style={{ fontSize: "0.82rem", margin: 0 }}>Questions users ask via "Ask an admin" on the FAQ page will appear here.</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {submitted.map(q => (
                    <div key={q.id} style={{ borderRadius: "14px", padding: "16px 18px", border: `1px solid ${K.cardBorder}`, backgroundColor: K.bgLight, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: "0 0 5px", fontWeight: 600, color: K.text, fontSize: "0.92rem", lineHeight: 1.4 }}>{q.question}</p>
                        <div style={{ fontSize: "0.72rem", color: K.textMuted, display: "flex", gap: "10px" }}>
                          {q.email && <span>✉ {q.email}</span>}
                          <span>{new Date(q.submitted_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                        <button onClick={() => promoteToFAQ(q)} disabled={saving}
                          style={{ display: "flex", alignItems: "center", gap: "4px", padding: "7px 12px", borderRadius: "8px", backgroundColor: ACCENT, color: "#10100f", fontWeight: 700, fontSize: "0.78rem", border: "none", cursor: "pointer", opacity: saving ? 0.6 : 1, whiteSpace: "nowrap" }}>
                          <Plus size={12} /> Draft FAQ
                        </button>
                        <button onClick={() => dismissQuestion(q.id)}
                          style={{ padding: "7px 10px", borderRadius: "8px", border: "1px solid #fca5a5", color: "#dc2626", background: "transparent", cursor: "pointer" }} title="Dismiss">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Section: AI-Generated Drafts */}
            <div>
              <h2 style={{ fontSize: "0.95rem", fontWeight: 700, color: K.text, margin: "0 0 14px" }}>AI-Generated Drafts</h2>
              {drafts.length === 0 ? (
                <div style={{ textAlign: "center", padding: "48px 32px", borderRadius: "16px", border: `2px dashed ${K.cardBorder}`, color: K.textMuted }}>
                  <Sparkles size={28} style={{ marginBottom: "12px", opacity: 0.5 }} />
                  <p style={{ fontWeight: 600, margin: "0 0 6px" }}>No AI drafts pending</p>
                  <p style={{ fontSize: "0.82rem", margin: 0 }}>Run "Scrape & Generate Drafts" to auto-populate from the event site.</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <div style={{ padding: "10px 14px", borderRadius: "10px", backgroundColor: "#fffbeb", border: "1px solid #fcd34d", fontSize: "0.82rem", color: "#92400e", fontWeight: 600, marginBottom: "6px" }}>
                    ⚠️ Review and approve or reject each AI-generated draft before it goes live.
                  </div>
                  {drafts.map(faq => (
                  <div key={faq.id} style={{ borderRadius: "14px", padding: "18px 20px", border: "2px solid #fcd34d", backgroundColor: "#fffbeb" }}>
                    {editingId === faq.id ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        <input type="text" value={editData.question ?? faq.question} onChange={e => setEditData({ ...editData, question: e.target.value })}
                          style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: `1px solid ${K.cardBorder}`, fontSize: "0.9rem", fontWeight: 600, color: K.text, boxSizing: "border-box" }} />
                        <textarea value={editData.answer ?? faq.answer} onChange={e => setEditData({ ...editData, answer: e.target.value })} rows={4}
                          style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: `1px solid ${K.cardBorder}`, fontSize: "0.88rem", color: K.text, fontFamily: "inherit", boxSizing: "border-box", resize: "vertical" }} />
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                          <select value={editData.milestone ?? faq.milestone} onChange={e => setEditData({ ...editData, milestone: e.target.value })}
                            style={{ padding: "8px 12px", borderRadius: "8px", border: `1px solid ${K.cardBorder}`, fontSize: "0.88rem", color: K.text }}>
                            {milestones.map(m => <option key={m} value={m}>{m}</option>)}
                          </select>
                          <select value={editData.audience ?? faq.audience ?? "General"} onChange={e => setEditData({ ...editData, audience: e.target.value })}
                            style={{ padding: "8px 12px", borderRadius: "8px", border: `1px solid ${K.cardBorder}`, fontSize: "0.88rem", color: K.text }}>
                            {audiences.map(a => <option key={a} value={a}>{a}</option>)}
                          </select>
                        </div>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button onClick={() => handleUpdate(faq.id, { ...editData, status: "published" })} disabled={saving}
                            style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", padding: "9px", borderRadius: "8px", backgroundColor: "#16a34a", color: "#fff", fontWeight: 700, border: "none", cursor: "pointer", fontSize: "0.85rem" }}>
                            <Check size={14} /> Approve & Publish
                          </button>
                          <button onClick={() => setEditingId(null)}
                            style={{ padding: "9px 14px", borderRadius: "8px", border: `1px solid ${K.cardBorder}`, color: K.textMuted, background: K.bg, cursor: "pointer" }}>
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                            <Sparkles size={12} style={{ color: "#d97706" }} />
                            <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "#92400e", textTransform: "uppercase", letterSpacing: "0.06em" }}>AI Draft</span>
                            <span style={{ fontSize: "0.65rem", color: K.textMuted, marginLeft: "4px" }}>{faq.milestone}</span>
                          </div>
                          <p style={{ margin: "0 0 6px", fontWeight: 700, color: K.text, fontSize: "0.92rem", lineHeight: 1.4 }}>{faq.question}</p>
                          <p style={{ margin: 0, color: "#374151", fontSize: "0.87rem", lineHeight: 1.5 }}>{faq.answer || <span style={{ fontStyle: "italic", color: "#9ca3af" }}>No answer extracted</span>}</p>
                        </div>
                        <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                          <button onClick={() => approveDraft(faq)}
                            style={{ padding: "7px 10px", borderRadius: "8px", border: "1px solid #86efac", color: "#16a34a", background: "#f0fdf4", cursor: "pointer" }} title="Approve">
                            <Check size={15} />
                          </button>
                          <button onClick={() => { setEditingId(faq.id); setEditData(faq); }}
                            style={{ padding: "7px 10px", borderRadius: "8px", border: `1px solid ${ACCENT}`, color: ACCENT, background: "transparent", cursor: "pointer" }} title="Edit before approving">
                            <Edit2 size={15} />
                          </button>
                          <button onClick={() => rejectDraft(faq.id)}
                            style={{ padding: "7px 10px", borderRadius: "8px", border: "1px solid #fca5a5", color: "#dc2626", background: "transparent", cursor: "pointer" }} title="Reject">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            </div>
          </div>
        )}

        {/* PUBLISHED TAB */}
        {activeTab === "published" && (
          <>
            {/* Add new */}
            <div style={{ marginBottom: "36px", borderRadius: "20px", padding: "26px", background: K.card }}>
              <h2 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "18px", color: K.textLight, display: "flex", alignItems: "center", gap: "8px" }}>
                <Plus size={18} style={{ color: ACCENT }} /> Add New Question
              </h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div>
                  <label style={{ color: K.textMutedLight, fontSize: "0.76rem", fontWeight: 600, display: "block", marginBottom: "5px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Question *</label>
                  <input id="faq-new-question-input" type="text" value={newEntry.question} onChange={e => setNewEntry({ ...newEntry, question: e.target.value })} placeholder="What is..."
                    style={{ width: "100%", padding: "10px 13px", borderRadius: "10px", border: `1px solid ${K.cardBorder}`, backgroundColor: K.bgLight, color: K.text, fontSize: "0.9rem", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ color: K.textMutedLight, fontSize: "0.76rem", fontWeight: 600, display: "block", marginBottom: "5px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Answer</label>
                  <textarea value={newEntry.answer} onChange={e => setNewEntry({ ...newEntry, answer: e.target.value })} placeholder="Detailed answer... (leave blank if TBD)" rows={4}
                    style={{ width: "100%", padding: "10px 13px", borderRadius: "10px", border: `1px solid ${K.cardBorder}`, backgroundColor: K.bgLight, color: K.text, fontSize: "0.9rem", fontFamily: "inherit", boxSizing: "border-box", resize: "vertical" }} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div>
                    <label style={{ color: K.textMutedLight, fontSize: "0.76rem", fontWeight: 600, display: "block", marginBottom: "5px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Milestone</label>
                    <select value={newEntry.milestone} onChange={e => setNewEntry({ ...newEntry, milestone: e.target.value })}
                      style={{ width: "100%", padding: "9px 13px", borderRadius: "10px", border: `1px solid ${K.cardBorder}`, backgroundColor: K.bgLight, color: K.text, fontSize: "0.88rem" }}>
                      {milestones.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ color: K.textMutedLight, fontSize: "0.76rem", fontWeight: 600, display: "block", marginBottom: "5px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Audience</label>
                    <select value={newEntry.audience} onChange={e => setNewEntry({ ...newEntry, audience: e.target.value })}
                      style={{ width: "100%", padding: "9px 13px", borderRadius: "10px", border: `1px solid ${K.cardBorder}`, backgroundColor: K.bgLight, color: K.text, fontSize: "0.88rem" }}>
                      {audiences.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                </div>
                <button onClick={handleCreate} disabled={saving}
                  style={{ backgroundColor: ACCENT, color: "#10100f", border: "none", borderRadius: "10px", padding: "11px", fontWeight: 700, fontSize: "0.9rem", cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
                  {saving ? "Adding…" : "Add Question"}
                </button>
              </div>
            </div>

            {/* FAQ list */}
            {loading ? (
              <div style={{ textAlign: "center", padding: "48px", color: K.textMuted }}>Loading FAQs…</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
                {[...groupedPublished, ...(otherPublished.length > 0 ? [{ milestone: "Other", entries: otherPublished }] : [])].map(({ milestone, entries }) => (
                  <div key={milestone}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", paddingBottom: "8px", borderBottom: `1px solid ${K.cardBorder}` }}>
                      <h2 style={{ fontSize: "0.8rem", fontWeight: 700, color: ACCENT, textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>{milestone}</h2>
                      <span style={{ fontSize: "0.75rem", color: K.textMuted }}>{entries.length} {entries.length === 1 ? "entry" : "entries"}</span>
                    </div>
                    {entries.length === 0 ? (
                      <p style={{ color: K.textMuted, fontSize: "0.82rem", fontStyle: "italic" }}>No entries yet</p>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "9px" }}>
                        {entries.map(faq => (
                          <div key={faq.id}
                            style={{ borderRadius: "13px", padding: "16px 18px", border: `1px solid ${editingId === faq.id ? ACCENT : K.cardBorder}`, background: editingId === faq.id ? "#fefce8" : K.bgLight }}>
                            {editingId === faq.id ? (
                              <div style={{ display: "flex", flexDirection: "column", gap: "9px" }}>
                                <input type="text" value={editData.question ?? faq.question} onChange={e => setEditData({ ...editData, question: e.target.value })}
                                  style={{ width: "100%", padding: "8px 11px", borderRadius: "8px", border: `1px solid ${K.cardBorder}`, fontSize: "0.9rem", fontWeight: 600, color: K.text, backgroundColor: "#fff", boxSizing: "border-box" }} />
                                <textarea value={editData.answer ?? faq.answer} onChange={e => setEditData({ ...editData, answer: e.target.value })} rows={4}
                                  style={{ width: "100%", padding: "8px 11px", borderRadius: "8px", border: `1px solid ${K.cardBorder}`, fontSize: "0.88rem", color: K.text, fontFamily: "inherit", backgroundColor: "#fff", boxSizing: "border-box", resize: "vertical" }} />
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "9px" }}>
                                  <select value={editData.milestone ?? faq.milestone} onChange={e => setEditData({ ...editData, milestone: e.target.value })}
                                    style={{ padding: "8px 11px", borderRadius: "8px", border: `1px solid ${K.cardBorder}`, fontSize: "0.88rem", color: K.text }}>
                                    {milestones.map(m => <option key={m} value={m}>{m}</option>)}
                                  </select>
                                  <select value={editData.audience ?? faq.audience ?? "General"} onChange={e => setEditData({ ...editData, audience: e.target.value })}
                                    style={{ padding: "8px 11px", borderRadius: "8px", border: `1px solid ${K.cardBorder}`, fontSize: "0.88rem", color: K.text }}>
                                    {audiences.map(a => <option key={a} value={a}>{a}</option>)}
                                  </select>
                                </div>
                                <div style={{ display: "flex", gap: "7px" }}>
                                  <button onClick={() => handleUpdate(faq.id, editData)} disabled={saving}
                                    style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "5px", padding: "8px", borderRadius: "8px", backgroundColor: ACCENT, color: "#10100f", fontWeight: 700, border: "none", cursor: "pointer", fontSize: "0.85rem" }}>
                                    <Save size={14} /> Save
                                  </button>
                                  <button onClick={() => setEditingId(null)}
                                    style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "5px", padding: "8px", borderRadius: "8px", border: `1px solid ${K.cardBorder}`, color: K.textMuted, background: "#fff", cursor: "pointer", fontSize: "0.85rem" }}>
                                    <X size={14} /> Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" }}>
                                <div style={{ flex: 1 }}>
                                  <p style={{ margin: "0 0 5px", fontWeight: 600, color: K.text, fontSize: "0.91rem", lineHeight: 1.4 }}>{faq.question}</p>
                                  {faq.answer ? (
                                    <p style={{ margin: "0 0 5px", color: "#374151", fontSize: "0.86rem", lineHeight: 1.5 }}>{faq.answer}</p>
                                  ) : (
                                    <p style={{ margin: "0 0 5px", color: "#9ca3af", fontSize: "0.86rem", fontStyle: "italic" }}>No answer yet</p>
                                  )}
                                  <span style={{ fontSize: "0.72rem", color: K.textMuted }}>{faq.audience || "General"}</span>
                                </div>
                                <div style={{ display: "flex", gap: "5px", flexShrink: 0 }}>
                                  <button onClick={() => { setEditingId(faq.id); setEditData(faq); }}
                                    style={{ padding: "6px 9px", borderRadius: "8px", border: `1px solid ${ACCENT}`, color: ACCENT, background: "transparent", cursor: "pointer" }} title="Edit">
                                    <Edit2 size={14} />
                                  </button>
                                  <button onClick={() => handleDelete(faq.id)}
                                    style={{ padding: "6px 9px", borderRadius: "8px", border: "1px solid #fca5a5", color: "#dc2626", background: "transparent", cursor: "pointer" }} title="Delete">
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      <footer style={{ borderTop: `1px solid ${K.cardBorder}`, marginTop: "48px" }}>
        <div style={{ maxWidth: "960px", margin: "0 auto", padding: "16px 32px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "0.75rem", color: K.textMuted }}>© 2026</span>
          <a href="/" style={{ fontSize: "0.78rem", color: ACCENT, textDecoration: "none", fontWeight: 600 }}>← Back to Hub</a>
        </div>
      </footer>
    </div>
  );
}
