import { useState, useEffect, useRef } from "react";
import { Plus, ExternalLink, Sparkles, Settings, Globe, Edit2, Check, X, BarChart2, Upload, Image } from "lucide-react";


const K = {
  bg: "#ffffff",
  bgLight: "#f9fafb",
  cardBorder: "#e5e7eb",
  text: "#10100f",
  textMuted: "#6b7280",
  accent: "#d8a657",
};

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
  created_at?: string;
  logoPath?: string;
}

interface EditForm {
  name: string;
  client: string;
  accent: string;
  eventUrl: string;
  milestones: string;
  audiences: string;
}

interface NewEventForm {
  slug: string;
  name: string;
  client: string;
  accent: string;
  eventUrl: string;
  milestones: string;
  audiences: string;
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

const DEFAULT_MILESTONES = "Application,Down-Select,Program Structure,Event Day,Winners & Awards";
const DEFAULT_AUDIENCES = "Applicants,Finalists,General";

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label style={{ fontSize: "0.72rem", fontWeight: 700, color: K.textMuted, display: "block", marginBottom: "5px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
      {children}
    </label>
  );
}

function TextInput({ value, onChange, placeholder, type = "text" }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      style={{ width: "100%", padding: "9px 12px", borderRadius: "9px", border: `1px solid ${K.cardBorder}`, backgroundColor: "#fff", color: K.text, fontSize: "0.88rem", boxSizing: "border-box" }} />
  );
}

export default function FAQHub() {
  const [events, setEvents] = useState<EventConfig[]>([]);
  const [eventStats, setEventStats] = useState<Record<string, { total: number; drafts: number }>>({});
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState<NewEventForm>({ slug: "", name: "", client: "", accent: "#d8a657", eventUrl: "", milestones: DEFAULT_MILESTONES, audiences: DEFAULT_AUDIENCES });
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState("");
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ name: "", client: "", accent: "", eventUrl: "", milestones: "", audiences: "" });
  const [editSaving, setEditSaving] = useState(false);
  const [editMsg, setEditMsg] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<"events" | "analytics">("events");
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsDays, setAnalyticsDays] = useState(30);

  const refreshEvents = async () => {
    const r = await fetch("/api/events/list", { headers: { Accept: "application/json" } });
    const d = await r.json();
    const evs: EventConfig[] = d.events || [];
    setEvents(evs);
    const stats: Record<string, { total: number; drafts: number }> = {};
    await Promise.all(evs.map(async ev => {
      try {
        const r2 = await fetch(`/api/faq/list?slug=${ev.slug}`, { headers: { Accept: "application/json" } });
        const data = await r2.json();
        const all = data.entries || [];
        stats[ev.slug] = { total: all.filter((e: any) => (e.status || "published") === "published").length, drafts: all.filter((e: any) => e.status === "draft").length };
      } catch { stats[ev.slug] = { total: 0, drafts: 0 }; }
    }));
    setEventStats(stats);
  };

  useEffect(() => {
    setLoading(true);
    refreshEvents().finally(() => setLoading(false));
  }, []);

  const openEdit = (ev: EventConfig) => {
    setEditingSlug(ev.slug);
    setEditForm({
      name: ev.name,
      client: ev.client,
      accent: ev.accent,
      eventUrl: ev.eventUrl || "",
      milestones: ev.milestones.join(", "),
      audiences: ev.audiences.join(", "),
    });
    setEditMsg("");
  };

  const handleSaveEdit = async () => {
    if (!editingSlug) return;
    setEditSaving(true); setEditMsg("");
    try {
      // Upload logo first if one was selected
      if (logoFile) {
        setLogoUploading(true);
        const fd = new FormData();
        fd.append("logo", logoFile);
        fd.append("slug", editingSlug);
        const logoRes = await fetch(`/api/events/upload-logo`, {
          method: "POST",
          body: fd,
          headers: { Accept: "application/json" },
        });
        const logoData = await logoRes.json();
        setLogoUploading(false);
        if (!logoRes.ok) {
          setEditMsg("✗ Logo upload failed: " + (logoData.error || "unknown error"));
          setEditSaving(false);
          return;
        }
      }

      const res = await fetch("/api/events/update", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          slug: editingSlug,
          name: editForm.name.trim(),
          client: editForm.client.trim(),
          accent: editForm.accent,
          eventUrl: editForm.eventUrl.trim(),
          milestones: editForm.milestones.split(",").map(s => s.trim()).filter(Boolean),
          audiences: editForm.audiences.split(",").map(s => s.trim()).filter(Boolean),
        }),
      });
      const d = await res.json();
      if (res.ok) {
        setEditMsg("✓ Saved");
        await refreshEvents();
        setTimeout(() => { setEditingSlug(null); setEditMsg(""); setLogoFile(null); setLogoPreview(null); }, 800);
      } else {
        setEditMsg("✗ " + (d.error || "Failed to save"));
      }
    } catch { setEditMsg("✗ Network error"); } finally { setEditSaving(false); setLogoUploading(false); }
  };

  const handleCreateEvent = async () => {
    if (!newForm.slug.trim() || !newForm.name.trim() || !newForm.client.trim()) {
      setCreateMsg("✗ Slug, name, and client are required."); return;
    }
    if (!/^[a-z0-9-]+$/.test(newForm.slug)) {
      setCreateMsg("✗ Slug must be lowercase letters, numbers, and hyphens only."); return;
    }
    setCreating(true); setCreateMsg("");
    try {
      const res = await fetch("/api/events/create", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          slug: newForm.slug.trim(),
          name: newForm.name.trim(),
          client: newForm.client.trim(),
          accent: newForm.accent,
          eventUrl: newForm.eventUrl.trim(),
          milestones: newForm.milestones.split(",").map(s => s.trim()).filter(Boolean),
          audiences: newForm.audiences.split(",").map(s => s.trim()).filter(Boolean),
        }),
      });
      const d = await res.json();
      if (res.ok) {
        setCreateMsg("✓ Event created!");
        setShowNew(false);
        setNewForm({ slug: "", name: "", client: "", accent: "#d8a657", eventUrl: "", milestones: DEFAULT_MILESTONES, audiences: DEFAULT_AUDIENCES });
        await refreshEvents();
        setEventStats(prev => ({ ...prev, [newForm.slug]: { total: 0, drafts: 0 } }));
      } else {
        setCreateMsg("✗ " + (d.error || "Failed to create event"));
      }
    } catch { setCreateMsg("✗ Network error"); } finally { setCreating(false); }
  };

  const loadAnalytics = async (days: number) => {
    setAnalyticsLoading(true);
    try {
      const r = await fetch(`/api/analytics/summary?days=${days}`, { headers: { Accept: "application/json" } });
      const d = await r.json();
      setAnalytics(d);
    } catch { } finally { setAnalyticsLoading(false); }
  };

  useEffect(() => {
    if (activeTab === "analytics") {
      loadAnalytics(analyticsDays);
    }
  }, [activeTab, analyticsDays]);
  return (
    <div style={{ backgroundColor: K.bg, minHeight: "100vh" }}>
      <header style={{ borderBottom: `1px solid ${K.cardBorder}` }}>
        <div style={{ maxWidth: "960px", margin: "0 auto", padding: "24px 32px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <img src="/images/brand-logo.svg" alt="Brand Logo" style={{ height: "22px" }} />
            </div>
          </div>
          <div style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.1em", color: K.accent, textTransform: "uppercase", marginBottom: "6px" }}>FAQ SYSTEM</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <h1 style={{ fontSize: "2rem", fontWeight: 800, color: K.text, margin: "0 0 4px" }}>FAQ Hub</h1>
              <p style={{ color: K.textMuted, fontSize: "0.85rem", margin: 0 }}>All event FAQ dashboards — manage, create, and monitor from here.</p>
            </div>
            {activeTab === "events" && (
              <button onClick={() => setShowNew(!showNew)}
                style={{ display: "flex", alignItems: "center", gap: "6px", padding: "10px 18px", borderRadius: "12px", backgroundColor: K.accent, color: K.text, fontWeight: 700, fontSize: "0.85rem", border: "none", cursor: "pointer" }}>
                <Plus size={15} /> New Event
              </button>
            )}
          </div>

          {/* Tab switcher */}
          <div style={{ display: "flex", gap: "4px", marginTop: "20px" }}>
            {([["events", "Events"], ["analytics", "Analytics"]] as const).map(([tab, label]) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                style={{
                  display: "flex", alignItems: "center", gap: "5px",
                  padding: "7px 16px", borderRadius: "8px", border: "none", cursor: "pointer", fontSize: "0.82rem", fontWeight: 700,
                  backgroundColor: activeTab === tab ? K.text : "transparent",
                  color: activeTab === tab ? "#fff" : K.textMuted,
                }}>
                {tab === "analytics" && <BarChart2 size={13} />}
                {label}
              </button>
            ))}
          </div>

          {createMsg && (
            <div style={{ marginTop: "12px", padding: "8px 14px", borderRadius: "10px", backgroundColor: createMsg.startsWith("✓") ? "#dcfce7" : "#fee2e2", color: createMsg.startsWith("✓") ? "#16a34a" : "#dc2626", fontSize: "0.82rem", fontWeight: 600 }}>
              {createMsg}
            </div>
          )}
        </div>
      </header>

      <main style={{ maxWidth: "960px", margin: "0 auto", padding: "32px" }}>

        {activeTab === "events" && (
          <>
            {/* New Event Form */}
            {showNew && (
              <div style={{ marginBottom: "36px", padding: "28px", borderRadius: "20px", border: `2px dashed ${K.accent}`, backgroundColor: "#fffbeb" }}>
                <h2 style={{ fontSize: "1rem", fontWeight: 700, color: K.text, margin: "0 0 20px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <Plus size={18} style={{ color: K.accent }} /> Create New Event FAQ Dashboard
                </h2>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <FieldLabel>Event Name *</FieldLabel>
                    <TextInput value={newForm.name} onChange={v => setNewForm({ ...newForm, name: v })} placeholder="She's Next Kenya 2026" />
                  </div>
                  <div>
                    <FieldLabel>Slug *</FieldLabel>
                    <TextInput value={newForm.slug} onChange={v => setNewForm({ ...newForm, slug: v.toLowerCase().replace(/[^a-z0-9-]/g, "-") })} placeholder="shes-next-kenya-2026" />
                    <div style={{ fontSize: "0.68rem", color: K.textMuted, marginTop: "3px" }}>Lowercase, no spaces. Used in URLs.</div>
                  </div>
                  <div>
                    <FieldLabel>Client Name *</FieldLabel>
                    <TextInput value={newForm.client} onChange={v => setNewForm({ ...newForm, client: v })} placeholder="She's Next" />
                  </div>
                  <div>
                    <FieldLabel>Accent Color</FieldLabel>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <input type="color" value={newForm.accent} onChange={e => setNewForm({ ...newForm, accent: e.target.value })}
                        style={{ width: "40px", height: "38px", borderRadius: "8px", border: `1px solid ${K.cardBorder}`, cursor: "pointer", padding: "2px" }} />
                      <input type="text" value={newForm.accent} onChange={e => setNewForm({ ...newForm, accent: e.target.value })} maxLength={7}
                        style={{ flex: 1, padding: "9px 12px", borderRadius: "9px", border: `1px solid ${K.cardBorder}`, backgroundColor: "#fff", color: K.text, fontSize: "0.88rem", fontFamily: "monospace" }} />
                    </div>
                  </div>
                  <div>
                    <FieldLabel>Event URL (for AI scraping)</FieldLabel>
                    <TextInput type="url" value={newForm.eventUrl} onChange={v => setNewForm({ ...newForm, eventUrl: v })} placeholder="https://www.example.com/event" />
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <FieldLabel>Milestones (comma-separated)</FieldLabel>
                    <TextInput value={newForm.milestones} onChange={v => setNewForm({ ...newForm, milestones: v })} />
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <FieldLabel>Audiences (comma-separated)</FieldLabel>
                    <TextInput value={newForm.audiences} onChange={v => setNewForm({ ...newForm, audiences: v })} />
                  </div>
                </div>
                <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
                  <button onClick={handleCreateEvent} disabled={creating}
                    style={{ flex: 1, padding: "12px", borderRadius: "12px", backgroundColor: K.accent, color: K.text, fontWeight: 700, fontSize: "0.9rem", border: "none", cursor: creating ? "not-allowed" : "pointer", opacity: creating ? 0.7 : 1 }}>
                    {creating ? "Creating…" : "Create Event Dashboard"}
                  </button>
                  <button onClick={() => { setShowNew(false); setCreateMsg(""); }}
                    style={{ padding: "12px 20px", borderRadius: "12px", border: `1px solid ${K.cardBorder}`, backgroundColor: "#fff", color: K.textMuted, fontWeight: 600, fontSize: "0.9rem", cursor: "pointer" }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Event Cards */}
            {loading ? (
              <div style={{ textAlign: "center", padding: "48px", color: K.textMuted }}>Loading events…</div>
            ) : events.length === 0 ? (
              <div style={{ textAlign: "center", padding: "64px 32px", borderRadius: "16px", border: `2px dashed ${K.cardBorder}`, color: K.textMuted }}>
                <p style={{ fontWeight: 600, marginBottom: "8px" }}>No events yet</p>
                <p style={{ fontSize: "0.85rem", margin: 0 }}>Click "New Event" to create your first FAQ dashboard.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {events.map(ev => {
                  const stats = eventStats[ev.slug] || { total: 0, drafts: 0 };
                  const isEditing = editingSlug === ev.slug;
                  return (
                    <div key={ev.slug} style={{ borderRadius: "16px", border: `1px solid ${isEditing ? ev.accent : K.cardBorder}`, backgroundColor: K.bgLight, overflow: "hidden", transition: "border-color 0.15s" }}>
                      <div style={{ display: "flex", alignItems: "stretch" }}>
                        <div style={{ width: "5px", backgroundColor: ev.accent, flexShrink: 0 }} />
                        <div style={{ flex: 1, padding: "20px 22px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                                <span style={{ fontSize: "0.68rem", fontWeight: 700, color: ev.accent, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                                  {ev.client.toUpperCase()}
                                </span>
                                {!ev.active && <span style={{ fontSize: "0.62rem", fontWeight: 700, padding: "1px 7px", borderRadius: "999px", backgroundColor: "#f3f4f6", color: K.textMuted }}>INACTIVE</span>}
                              </div>
                              <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: K.text, margin: "0 0 8px" }}>{ev.name}</h3>
                              <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
                                <span style={{ fontSize: "0.78rem", color: K.textMuted }}>
                                  <strong style={{ color: K.text }}>{stats.total}</strong> published
                                </span>
                                {stats.drafts > 0 && (
                                  <span style={{ fontSize: "0.78rem", fontWeight: 700, padding: "2px 8px", borderRadius: "999px", backgroundColor: "#fef3c7", color: "#92400e" }}>
                                    {stats.drafts} AI drafts pending
                                  </span>
                                )}
                                {ev.eventUrl && (
                                  <a href={ev.eventUrl} target="_blank" rel="noopener"
                                    style={{ display: "flex", alignItems: "center", gap: "3px", fontSize: "0.72rem", color: K.textMuted, textDecoration: "none" }}>
                                    <Globe size={10} /> {ev.eventUrl.replace(/https?:\/\//, "").split("/")[0]}
                                  </a>
                                )}
                              </div>
                            </div>
                            <div style={{ display: "flex", gap: "7px", flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
                              <a href={`/admin?slug=${ev.slug}`}
                                style={{ display: "flex", alignItems: "center", gap: "5px", padding: "8px 14px", borderRadius: "10px", backgroundColor: ev.accent, color: "#10100f", fontWeight: 700, fontSize: "0.8rem", textDecoration: "none" }}>
                                <Settings size={12} /> Manage FAQs
                                {stats.drafts > 0 && <span style={{ backgroundColor: "#10100f", color: ev.accent, borderRadius: "999px", fontSize: "0.65rem", padding: "1px 6px", fontWeight: 700, marginLeft: "2px" }}>{stats.drafts}</span>}
                              </a>
                              <button onClick={() => isEditing ? setEditingSlug(null) : openEdit(ev)}
                                style={{ display: "flex", alignItems: "center", gap: "5px", padding: "8px 12px", borderRadius: "10px", border: `1px solid ${isEditing ? ev.accent : K.cardBorder}`, backgroundColor: isEditing ? ev.accent + "18" : "#fff", color: isEditing ? ev.accent : K.textMuted, fontWeight: 700, fontSize: "0.8rem", cursor: "pointer" }}>
                                <Edit2 size={12} /> Edit
                              </button>
                              {ev.clientPath && (
                                <a href={`${window.location.origin}${ev.clientPath}`} target="_blank" rel="noopener"
                                  style={{ display: "flex", alignItems: "center", gap: "5px", padding: "8px 12px", borderRadius: "10px", border: `1px solid ${K.cardBorder}`, color: K.textMuted, backgroundColor: "#fff", fontSize: "0.8rem", textDecoration: "none" }}>
                                  <ExternalLink size={12} /> FAQ Page
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {isEditing && (
                        <div style={{ borderTop: `1px solid ${ev.accent}40`, backgroundColor: "#fffdf5", padding: "22px 22px 22px 27px" }}>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                            <div style={{ gridColumn: "1 / -1" }}>
                              <FieldLabel>Event Name</FieldLabel>
                              <TextInput value={editForm.name} onChange={v => setEditForm({ ...editForm, name: v })} />
                            </div>
                            <div>
                              <FieldLabel>Client Name</FieldLabel>
                              <TextInput value={editForm.client} onChange={v => setEditForm({ ...editForm, client: v })} />
                            </div>
                            <div>
                              <FieldLabel>Accent Color</FieldLabel>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <input type="color" value={editForm.accent} onChange={e => setEditForm({ ...editForm, accent: e.target.value })}
                                  style={{ width: "38px", height: "36px", borderRadius: "8px", border: `1px solid ${K.cardBorder}`, cursor: "pointer", padding: "2px" }} />
                                <input type="text" value={editForm.accent} onChange={e => setEditForm({ ...editForm, accent: e.target.value })} maxLength={7}
                                  style={{ flex: 1, padding: "8px 11px", borderRadius: "9px", border: `1px solid ${K.cardBorder}`, backgroundColor: "#fff", color: K.text, fontSize: "0.85rem", fontFamily: "monospace" }} />
                              </div>
                            </div>
                            <div style={{ gridColumn: "1 / -1" }}>
                              <FieldLabel>Event URL (for AI scraping)</FieldLabel>
                              <TextInput type="url" value={editForm.eventUrl} onChange={v => setEditForm({ ...editForm, eventUrl: v })} placeholder="https://www.example.com/event" />
                            </div>
                            <div style={{ gridColumn: "1 / -1" }}>
                              <FieldLabel>Milestones (comma-separated)</FieldLabel>
                              <TextInput value={editForm.milestones} onChange={v => setEditForm({ ...editForm, milestones: v })} />
                            </div>
                            <div style={{ gridColumn: "1 / -1" }}>
                              <FieldLabel>Audiences (comma-separated)</FieldLabel>
                              <TextInput value={editForm.audiences} onChange={v => setEditForm({ ...editForm, audiences: v })} />
                            </div>
                            {/* Client Logo Upload */}
                            <div style={{ gridColumn: "1 / -1", borderTop: `1px solid ${K.cardBorder}`, paddingTop: "14px", marginTop: "4px" }}>
                              <FieldLabel>Client Logo (top-right on FAQ page)</FieldLabel>
                              <div style={{ display: "flex", alignItems: "center", gap: "14px", marginTop: "6px" }}>
                                {logoPreview ? (
                                  <div style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center", width: "80px", height: "48px", borderRadius: "8px", border: `1px solid ${K.cardBorder}`, backgroundColor: "#fff", overflow: "hidden", flexShrink: 0 }}>
                                    <img src={logoPreview} alt="Logo preview" style={{ maxWidth: "72px", maxHeight: "40px", objectFit: "contain" }} />
                                    <button
                                      onClick={() => { setLogoFile(null); setLogoPreview(null); if (logoInputRef.current) logoInputRef.current.value = ""; }}
                                      style={{ position: "absolute", top: "-1px", right: "-1px", width: "16px", height: "16px", borderRadius: "50%", backgroundColor: "#ef4444", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, lineHeight: 1, fontSize: "10px", color: "#fff", fontWeight: 700 }}
                                      title="Remove logo"
                                    >×</button>
                                  </div>
                                ) : (
                                  <div style={{ width: "80px", height: "48px", borderRadius: "8px", border: `2px dashed ${K.cardBorder}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                    <Image size={18} style={{ color: K.textMuted }} />
                                  </div>
                                )}
                                <div>
                                  <input
                                    ref={logoInputRef}
                                    type="file"
                                    accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml,image/gif"
                                    style={{ display: "none" }}
                                    onChange={e => {
                                      const file = e.target.files?.[0];
                                      if (!file) return;
                                      setLogoFile(file);
                                      const url = URL.createObjectURL(file);
                                      setLogoPreview(url);
                                    }}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => logoInputRef.current?.click()}
                                    style={{ display: "flex", alignItems: "center", gap: "5px", padding: "8px 14px", borderRadius: "9px", border: `1px solid ${K.cardBorder}`, backgroundColor: "#fff", color: K.text, fontSize: "0.82rem", fontWeight: 600, cursor: "pointer" }}
                                  >
                                    <Upload size={13} /> {logoPreview ? "Replace logo" : "Upload logo"}
                                  </button>
                                  <div style={{ fontSize: "0.68rem", color: K.textMuted, marginTop: "4px" }}>PNG, JPEG, WebP, SVG · max 2 MB</div>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "16px" }}>
                            <button onClick={handleSaveEdit} disabled={editSaving}
                              style={{ display: "flex", alignItems: "center", gap: "5px", padding: "9px 18px", borderRadius: "10px", backgroundColor: ev.accent, color: "#10100f", fontWeight: 700, fontSize: "0.85rem", border: "none", cursor: editSaving ? "not-allowed" : "pointer", opacity: editSaving ? 0.7 : 1 }}>
                              <Check size={14} /> {logoUploading ? "Uploading logo…" : editSaving ? "Saving…" : "Save Changes"}
                            </button>
                            <button onClick={() => { setEditingSlug(null); setEditMsg(""); setLogoFile(null); setLogoPreview(null); }}
                              style={{ display: "flex", alignItems: "center", gap: "5px", padding: "9px 14px", borderRadius: "10px", border: `1px solid ${K.cardBorder}`, backgroundColor: "#fff", color: K.textMuted, fontWeight: 600, fontSize: "0.85rem", cursor: "pointer" }}>
                              <X size={14} /> Cancel
                            </button>
                            {editMsg && (
                              <span style={{ fontSize: "0.82rem", fontWeight: 700, color: editMsg.startsWith("✓") ? "#16a34a" : "#dc2626" }}>{editMsg}</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {activeTab === "analytics" && (
          <AnalyticsPanel analytics={analytics} loading={analyticsLoading} events={events} days={analyticsDays} onDaysChange={d => setAnalyticsDays(d)} />
        )}
      </main>

      <footer style={{ borderTop: `1px solid ${K.cardBorder}`, marginTop: "48px" }}>
        <div style={{ maxWidth: "960px", margin: "0 auto", padding: "16px 32px", textAlign: "center" }}>
          <span style={{ fontSize: "0.75rem", color: K.textMuted }}>© 2026</span>
        </div>
      </footer>
    </div>
  );
}

function AnalyticsPanel({ analytics, loading, events, days, onDaysChange }: {
  analytics: AnalyticsSummary | null;
  loading: boolean;
  events: EventConfig[];
  days: number;
  onDaysChange: (d: number) => void;
}) {
  const K = { bg: "#ffffff", bgLight: "#f9fafb", cardBorder: "#e5e7eb", text: "#10100f", textMuted: "#6b7280", accent: "#d8a657" };

  if (loading) return <div style={{ textAlign: "center", padding: "64px", color: K.textMuted }}>Loading analytics…</div>;
  if (!analytics) return null;

  const slugToName = Object.fromEntries(events.map(e => [e.slug, e.name]));
  const summaryEntries = Object.entries(analytics.summary);
  const totalViews = summaryEntries.reduce((s, [, v]) => s + v.page_views, 0);
  const totalSessions = summaryEntries.reduce((s, [, v]) => s + v.unique_sessions, 0);
  const totalChatbot = summaryEntries.reduce((s, [, v]) => s + v.chatbot_queries, 0);
  const totalSubmitted = summaryEntries.reduce((s, [, v]) => s + v.questions_submitted, 0);

  const kpiTile = (label: string, value: number | string, sub?: string) => (
    <div style={{ flex: 1, minWidth: "140px", padding: "20px", borderRadius: "14px", border: `1px solid ${K.cardBorder}`, backgroundColor: K.bgLight }}>
      <div style={{ fontSize: "1.8rem", fontWeight: 800, color: K.text, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: "0.75rem", fontWeight: 700, color: K.textMuted, marginTop: "6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
      {sub && <div style={{ fontSize: "0.7rem", color: K.textMuted, marginTop: "3px" }}>{sub}</div>}
    </div>
  );

  const termTable = (title: string, items: { term: string; count: number }[], note?: string) => (
    <div style={{ borderRadius: "14px", border: `1px solid ${K.cardBorder}`, overflow: "hidden", marginBottom: "16px" }}>
      <div style={{ padding: "14px 18px", borderBottom: `1px solid ${K.cardBorder}`, backgroundColor: K.bgLight, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "0.82rem", fontWeight: 700, color: K.text }}>{title}</span>
        {note && <span style={{ fontSize: "0.7rem", color: K.textMuted }}>{note}</span>}
      </div>
      {items.length === 0 ? (
        <div style={{ padding: "20px 18px", color: K.textMuted, fontSize: "0.82rem" }}>No data yet.</div>
      ) : (
        items.slice(0, 10).map((item, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 18px", borderBottom: i < items.length - 1 ? `1px solid ${K.cardBorder}` : "none" }}>
            <span style={{ fontSize: "0.85rem", color: K.text, flex: 1 }}>{item.term}</span>
            <span style={{ fontSize: "0.78rem", fontWeight: 700, color: K.textMuted, marginLeft: "12px" }}>×{item.count}</span>
          </div>
        ))
      )}
    </div>
  );

  return (
    <div>
      {/* Period selector */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 800, color: K.text, margin: 0 }}>Analytics</h2>
        <div style={{ display: "flex", gap: "6px" }}>
          {[7, 30, 90].map(d => (
            <button key={d} onClick={() => onDaysChange(d)}
              style={{ padding: "5px 12px", borderRadius: "8px", border: `1px solid ${days === d ? K.text : K.cardBorder}`, backgroundColor: days === d ? K.text : "#fff", color: days === d ? "#fff" : K.textMuted, fontSize: "0.78rem", fontWeight: 700, cursor: "pointer" }}>
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Top-line KPIs */}
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "28px" }}>
        {kpiTile("Page Views", totalViews, `last ${days} days`)}
        {kpiTile("Unique Sessions", totalSessions)}
        {kpiTile("AI Chatbot Queries", totalChatbot)}
        {kpiTile("Questions Submitted", totalSubmitted)}
      </div>

      {/* Per-event breakdown */}
      {summaryEntries.length > 0 && (
        <div style={{ marginBottom: "28px" }}>
          <h3 style={{ fontSize: "0.85rem", fontWeight: 700, color: K.text, marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.06em" }}>By Event</h3>
          <div style={{ borderRadius: "14px", border: `1px solid ${K.cardBorder}`, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr", padding: "10px 18px", borderBottom: `1px solid ${K.cardBorder}`, backgroundColor: K.bgLight }}>
              {["Event", "Views", "Sessions", "Searches", "AI Queries", "Unmatched %"].map(h => (
                <span key={h} style={{ fontSize: "0.68rem", fontWeight: 700, color: K.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</span>
              ))}
            </div>
            {summaryEntries.map(([slug, s], i) => (
              <div key={slug} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr", padding: "12px 18px", borderBottom: i < summaryEntries.length - 1 ? `1px solid ${K.cardBorder}` : "none", alignItems: "center" }}>
                <span style={{ fontSize: "0.85rem", fontWeight: 600, color: K.text }}>{slugToName[slug] || slug}</span>
                <span style={{ fontSize: "0.85rem", color: K.text }}>{s.page_views}</span>
                <span style={{ fontSize: "0.85rem", color: K.text }}>{s.unique_sessions}</span>
                <span style={{ fontSize: "0.85rem", color: K.text }}>{s.search_queries}</span>
                <span style={{ fontSize: "0.85rem", color: K.text }}>{s.chatbot_queries}</span>
                <span style={{ fontSize: "0.85rem", color: s.chatbot_unmatched_rate > 40 ? "#dc2626" : s.chatbot_unmatched_rate > 20 ? "#d97706" : K.textMuted, fontWeight: s.chatbot_unmatched_rate > 20 ? 700 : 400 }}>
                  {s.chatbot_unmatched_rate}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Signal tables */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "28px" }}>
        <div>{termTable("Top Searches", analytics.topSearches, "what clients are looking for")}</div>
        <div>{termTable("Top Chatbot Queries", analytics.topChatbotQueries, "questions asked to AI")}</div>
      </div>

      {termTable("AI Gaps — Unmatched Queries", analytics.topUnmatched, "queries where AI said it couldn't answer → add FAQs for these")}

      {/* Submitted questions */}
      {analytics.submittedQuestions.length > 0 && (
        <div style={{ borderRadius: "14px", border: `1px solid ${K.cardBorder}`, overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: `1px solid ${K.cardBorder}`, backgroundColor: K.bgLight, display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: "0.82rem", fontWeight: 700, color: K.text }}>Submitted Questions</span>
            <span style={{ fontSize: "0.7rem", color: K.textMuted }}>most recent {analytics.submittedQuestions.length}</span>
          </div>
          {analytics.submittedQuestions.map((q, i) => (
            <div key={i} style={{ padding: "12px 18px", borderBottom: i < analytics.submittedQuestions.length - 1 ? `1px solid ${K.cardBorder}` : "none" }}>
              <div style={{ fontSize: "0.85rem", color: K.text, marginBottom: "3px" }}>{q.question}</div>
              <div style={{ fontSize: "0.7rem", color: K.textMuted }}>{slugToName[q.slug] || q.slug} · {new Date(q.ts).toLocaleDateString()}</div>
            </div>
          ))}
        </div>
      )}

      {summaryEntries.length === 0 && (
        <div style={{ textAlign: "center", padding: "64px 32px", borderRadius: "16px", border: `2px dashed ${K.cardBorder}`, color: K.textMuted }}>
          <BarChart2 size={32} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
          <p style={{ fontWeight: 600, marginBottom: "6px" }}>No analytics yet</p>
          <p style={{ fontSize: "0.85rem", margin: 0 }}>Events start tracking when clients visit their FAQ page.</p>
        </div>
      )}
    </div>
  );
}
