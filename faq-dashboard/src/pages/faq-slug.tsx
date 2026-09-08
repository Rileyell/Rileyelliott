import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { ChevronDown, Search, Send, MessageSquare } from "lucide-react";

interface EventConfig {
  slug: string;
  name: string;
  program: string;
  client: string;
  accent: string;
  milestones: string[];
  logoFile?: string;
  enableChatbot?: boolean;
}

interface FAQ {
  id: string;
  question: string;
  answer: string;
  milestone: string;
  audience?: string;
  tags?: string[];
}

function getOrCreateSession(): string {
  const key = "kite_faq_session";
  let sid = sessionStorage.getItem(key);
  if (!sid) {
    sid = Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem(key, sid);
  }
  return sid;
}

const K = {
  bg: "#ffffff",
  text: "#10100f",
  textMuted: "#6b7280",
  border: "#e5e7eb",
  bgLight: "#f9fafb",
};

export default function FAQClient() {
  const { slug } = useParams<{ slug: string }>();
  const [event, setEvent] = useState<EventConfig | null>(null);
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [activeMilestone, setActiveMilestone] = useState<string | null>(null);
  const [showAskAdmin, setShowAskAdmin] = useState(false);
  const [question, setQuestion] = useState("");
  const [askEmail, setAskEmail] = useState("");
  const [askLoading, setAskLoading] = useState(false);
  const [askMsg, setAskMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  // ── Analytics ──────────────────────────────────────────────────────────────
  const sessionId = useRef<string>("");
  useEffect(() => {
    const key = "kite_faq_session";
    let id = sessionStorage.getItem(key);
    if (!id) { id = Math.random().toString(36).slice(2) + Date.now().toString(36); sessionStorage.setItem(key, id); }
    sessionId.current = id;
  }, []);

  const track = useCallback((type: string, data?: Record<string, unknown>) => {
    if (!slug) return;
    fetch("/api/analytics/track", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-session-id": sessionId.current },
      body: JSON.stringify({ type, slug, data: data || {} }),
    }).catch(() => {});
  }, [slug]);

  // Page view — once on mount after event loads
  const trackedView = useRef(false);
  useEffect(() => {
    if (event && !trackedView.current) {
      trackedView.current = true;
      track("page_view");
    }
  }, [event, track]);

  // Search debounce — track after 600ms idle, min 2 chars
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchChange = (val: string) => {
    setSearch(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (val.trim().length >= 2) {
      searchTimer.current = setTimeout(() => track("search", { term: val.trim() }), 600);
    }
  };

  // FAQ expand tracking (wraps existing handleToggle)
  const handleToggle = (id: string) => {
    const newExp = new Set(expanded);
    if (newExp.has(id)) { newExp.delete(id); }
    else {
      newExp.add(id);
      const faq = faqs.find(f => f.id === id);
      if (faq) track("faq_expand", { faq_id: id, question: faq.question.slice(0, 120) });
    }
    setExpanded(newExp);
  };

  const filteredFAQs = faqs.filter(f => {
    const matchMilestone = !activeMilestone || f.milestone === activeMilestone;
    const matchSearch =
      search === "" ||
      f.question.toLowerCase().includes(search.toLowerCase()) ||
      f.answer.toLowerCase().includes(search.toLowerCase());
    return matchMilestone && matchSearch;
  });

  const handleAskAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || !slug) return;
    setAskLoading(true);
    setAskMsg("");
    const q = question.trim();
    try {
      const res = await fetch("/api/faq/submit-question", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ question: q, email: askEmail.trim(), slug, program: event?.program }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        track("question_submitted", { question: q.slice(0, 200) });
        setAskMsg("Sent to the admin team — they'll follow up" + (askEmail.trim() ? " by email." : " here soon."));
        setQuestion("");
        setAskEmail("");
      } else {
        setAskMsg(data.error || "Couldn't send your question. Try again.");
      }
    } catch (err) {
      setAskMsg("Network error — couldn't send your question.");
    } finally {
      setAskLoading(false);
    }
  };

  // ── Load event + FAQs ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!slug) return;
    const loadData = async () => {
      try {
        const eRes = await fetch(`/api/events/list?slug=${slug}`, { headers: { Accept: "application/json" } });
        const eData = await eRes.json();
        const events = eData.events || [];
        const foundEvent = events.find((e: EventConfig) => e.slug === slug);
        if (foundEvent) setEvent(foundEvent);
        const fRes = await fetch(`/api/faq/list?slug=${slug}&status=published`, { headers: { Accept: "application/json" } });
        const fData = await fRes.json();
        setFaqs(fData.entries || []);
        if (foundEvent?.milestones?.length) setActiveMilestone(foundEvent.milestones[0]);
      } catch (err) {
        console.error("Load error:", err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [slug]);

  if (loading) return <div style={{ padding: "32px", textAlign: "center", color: K.textMuted }}>Loading…</div>;
  if (!event) return <div style={{ padding: "32px", textAlign: "center", color: K.textMuted }}>Event not found.</div>;

  return (
    <main style={{ backgroundColor: K.bg, minHeight: "100vh" }}>
      {/* Header */}
      <header style={{ borderBottom: `1px solid ${K.border}`, paddingBottom: "24px" }}>
        <div style={{ maxWidth: "800px", margin: "0 auto", padding: "32px 24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
            {/* Client logo — top left */}
            <div style={{ display: "flex", alignItems: "center", minWidth: "120px" }}>
              {event.logoFile ? (
                <img
                  src={`/api/events/logo?slug=${event.slug}`}
                  alt={`${event.client} logo`}
                  style={{ height: "40px", maxWidth: "160px", objectFit: "contain" }}
                />
              ) : (
                <span style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.1em", color: event.accent, textTransform: "uppercase" }}>
                  {event.client.toUpperCase()}
                </span>
              )}
            </div>
            {/* Brand logo — top right */}
            <img src="/images/brand-logo.svg" alt="Brand Logo" style={{ height: "22px", flexShrink: 0 }} />
          </div>
          <h1 style={{ fontSize: "2rem", fontWeight: 800, color: K.text, margin: "0 0 12px" }}>{event.name}</h1>
          <p style={{ color: K.textMuted, fontSize: "0.95rem", margin: 0 }}>Questions & answers to help you navigate the application process.</p>
        </div>
      </header>

      <div style={{ maxWidth: "800px", margin: "0 auto", padding: "32px 24px" }}>
        {/* Search — uses handleSearchChange */}
        <div style={{ position: "relative", marginBottom: "32px" }}>
          <Search size={18} style={{ position: "absolute", top: "12px", left: "14px", color: K.textMuted, pointerEvents: "none" }} />
          <input
            type="text"
            placeholder="Search questions…"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            style={{ width: "100%", padding: "12px 14px 12px 40px", borderRadius: "12px", border: `1px solid ${K.border}`, backgroundColor: K.bgLight, color: K.text, fontSize: "0.95rem", boxSizing: "border-box" }}
          />
        </div>

        {/* Milestone Tabs */}
        {event.milestones.length > 0 && (
          <div style={{ display: "flex", gap: "8px", marginBottom: "24px", overflowX: "auto", paddingBottom: "8px" }}>
            {event.milestones.map((m) => (
              <button key={m} onClick={() => setActiveMilestone(m)}
                style={{ padding: "10px 16px", borderRadius: "10px", border: activeMilestone === m ? `2px solid ${event.accent}` : `1px solid ${K.border}`, backgroundColor: activeMilestone === m ? event.accent : "white", color: activeMilestone === m ? K.text : K.textMuted, fontWeight: activeMilestone === m ? 700 : 500, fontSize: "0.85rem", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
                {m}
              </button>
            ))}
          </div>
        )}

        {/* FAQ List */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "32px" }}>
          {filteredFAQs.length === 0 ? (
            <div style={{ padding: "32px", textAlign: "center", color: K.textMuted, backgroundColor: K.bgLight, borderRadius: "12px" }}>
              No questions found. Try a different search or milestone.
            </div>
          ) : (
            filteredFAQs.map((f) => (
              <div key={f.id} onClick={() => handleToggle(f.id)}
                style={{ borderRadius: "12px", border: `1px solid ${K.border}`, backgroundColor: expanded.has(f.id) ? K.bgLight : "white", cursor: "pointer", overflow: "hidden" }}>
                <div style={{ padding: "16px 18px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ color: K.text, fontSize: "0.95rem", fontWeight: 600, margin: 0, paddingRight: "8px" }}>{f.question}</p>
                  </div>
                  <ChevronDown size={18} style={{ color: K.textMuted, transform: expanded.has(f.id) ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s", flexShrink: 0 }} />
                </div>
                {expanded.has(f.id) && (
                  <div style={{ padding: "0 18px 16px", borderTop: `1px solid ${K.border}` }}>
                    <p style={{ color: K.text, fontSize: "0.9rem", lineHeight: 1.6, margin: "12px 0 0" }}>{f.answer}</p>
                    {f.audience && (
                      <div style={{ marginTop: "10px", fontSize: "0.75rem", color: K.textMuted }}>
                        <strong>Audience:</strong> {f.audience}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Ask an Admin Toggle / Contact CTA */}
        {event.enableChatbot !== false ? (
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "24px" }}>
            <button onClick={() => setShowAskAdmin(!showAskAdmin)}
              style={{ display: "flex", alignItems: "center", gap: "6px", padding: "10px 16px", borderRadius: "10px", border: `1px solid ${event.accent}`, backgroundColor: "white", color: event.accent, fontWeight: 600, fontSize: "0.85rem", cursor: "pointer" }}>
              <MessageSquare size={14} /> Ask an admin
            </button>
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "20px", borderRadius: "12px", border: `1px solid ${K.border}`, backgroundColor: K.bgLight, marginBottom: "24px" }}>
            <p style={{ fontSize: "0.9rem", color: K.textMuted, margin: "0 0 10px" }}>Can't find what you're looking for?</p>
            <a href="mailto:hello@example.com" style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "10px 18px", borderRadius: "10px", backgroundColor: event.accent, color: K.text, fontWeight: 600, fontSize: "0.85rem", textDecoration: "none" }}>
              Contact Us →
            </a>
          </div>
        )}

        {/* Ask an Admin */}
        {event.enableChatbot !== false && showAskAdmin && (
          <div style={{ padding: "20px", borderRadius: "12px", border: `1px solid ${K.border}`, backgroundColor: K.bgLight, marginBottom: "32px" }}>
            <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: K.text, margin: "0 0 4px" }}>Ask an admin</h3>
            <p style={{ fontSize: "0.8rem", color: K.textMuted, margin: "0 0 12px" }}>Can't find your answer above? Send it to the team directly.</p>
            <form onSubmit={handleAskAdminSubmit} style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "12px" }}>
              <input type="text" placeholder="Your question…" value={question} onChange={(e) => setQuestion(e.target.value)} disabled={askLoading}
                style={{ padding: "10px 12px", borderRadius: "10px", border: `1px solid ${K.border}`, backgroundColor: "white", color: K.text, fontSize: "0.85rem", boxSizing: "border-box" }} />
              <input type="email" placeholder="Email (optional, for a reply)" value={askEmail} onChange={(e) => setAskEmail(e.target.value)} disabled={askLoading}
                style={{ padding: "10px 12px", borderRadius: "10px", border: `1px solid ${K.border}`, backgroundColor: "white", color: K.text, fontSize: "0.85rem", boxSizing: "border-box" }} />
              <button type="submit" disabled={askLoading || !question.trim()}
                style={{ padding: "10px 14px", borderRadius: "10px", backgroundColor: event.accent, color: K.text, border: "none", fontWeight: 600, fontSize: "0.85rem", cursor: askLoading ? "not-allowed" : "pointer", opacity: askLoading || !question.trim() ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "5px" }}>
                <Send size={12} /> {askLoading ? "Sending…" : "Send to admin"}
              </button>
            </form>
            {askMsg && (
              <div style={{ padding: "12px", borderRadius: "10px", backgroundColor: "white", border: `1px solid ${K.border}`, fontSize: "0.9rem", color: K.text, lineHeight: 1.5 }}>
                {askMsg}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer style={{ borderTop: `1px solid ${K.border}`, textAlign: "center", padding: "16px", color: K.textMuted, fontSize: "0.75rem" }}>
        Powered by FAQ Dashboard Kit
      </footer>
    </main>
  );
}
