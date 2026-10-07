// Demo page — fastest way to see the FAQ chatbot live.
// Deploy as a zo.space page route, e.g. /faq-demo
// Then embed FAQChatWidget into your real dashboard instead.
import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Copy, Check } from "lucide-react";

// ---- CONFIG ----
const EVENT_SLUG = "shes-next-egypt-2026"; // ← change to your event slug
const API_CHAT = "/api/faq-chat";
const CONTACT_EMAIL = "you@example.com"; // ← change to your support address
const ACCENT = "#7C3AED";
const ACCENT_DARK = "#5B21B6";
const ACCENT_SOFT = "#F5F3FF";
// ----------------

interface Message {
  role: "user" | "assistant";
  content: string;
  copied?: boolean;
}

function renderMarkdown(text: string): string {
  return text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, '<code style="background:#f3f4f6;padding:0 3px;border-radius:3px;font-size:0.85em">$1</code>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color:#7C3AED;text-decoration:underline">$1</a>')
    .replace(/\n/g, "<br/>");
}

function FAQChatWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hi! I'm the FAQ assistant. Ask me anything about the program, application process, or event details." },
  ]);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  const sendMessage = async () => {
    const question = input.trim();
    if (!question || loading) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setLoading(true);
    try {
      const res = await fetch(API_CHAT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ question, slug: EVENT_SLUG }),
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.success ? data.response : (data.error || "Something went wrong.") },
      ]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Connection error. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  const copyMsg = async (idx: number, content: string) => {
    await navigator.clipboard.writeText(content);
    setMessages((prev) => prev.map((m, i) => i === idx ? { ...m, copied: true } : m));
    setTimeout(() => setMessages((prev) => prev.map((m, i) => i === idx ? { ...m, copied: false } : m)), 1800);
  };

  return (
    <>
      {!open && (
        <button onClick={() => setOpen(true)} aria-label="Open FAQ chat"
          style={{ position: "fixed", bottom: "28px", right: "28px", width: "56px", height: "56px", borderRadius: "50%", background: ACCENT, color: "#fff", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 8px 24px ${ACCENT}55`, zIndex: 999 }}>
          <MessageCircle size={24} />
        </button>
      )}
      {open && (
        <div style={{ position: "fixed", bottom: "24px", right: "24px", width: "360px", maxWidth: "calc(100vw - 32px)", height: "520px", maxHeight: "80vh", borderRadius: "16px", background: "#fff", boxShadow: "0 24px 64px rgba(0,0,0,0.18)", display: "flex", flexDirection: "column", overflow: "hidden", zIndex: 1000, fontFamily: "system-ui, sans-serif" }}>
          <div style={{ background: ACCENT, color: "#fff", padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <MessageCircle size={18} />
              <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>FAQ Assistant</span>
            </div>
            <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#fff", display: "flex" }}><X size={18} /></button>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
            {messages.map((msg, idx) => (
              <div key={idx} style={{ display: "flex", flexDirection: "column", alignItems: msg.role === "user" ? "flex-end" : "flex-start" }}>
                <div style={{ maxWidth: "85%", background: msg.role === "user" ? ACCENT : ACCENT_SOFT, color: msg.role === "user" ? "#fff" : "#111", borderRadius: msg.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px", padding: "10px 14px", fontSize: "0.875rem", lineHeight: 1.55, wordBreak: "break-word" }} dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
                {msg.role === "assistant" && idx > 0 && (
                  <button onClick={() => copyMsg(idx, msg.content)} style={{ marginTop: "4px", background: "none", border: "none", cursor: "pointer", color: "#9ca3af", display: "flex", alignItems: "center", gap: "3px", fontSize: "0.75rem", padding: "2px 4px" }}>
                    {msg.copied ? <Check size={12} /> : <Copy size={12} />}
                    {msg.copied ? "Copied" : "Copy"}
                  </button>
                )}
              </div>
            ))}
            {loading && (
              <div style={{ display: "flex", gap: "5px", padding: "6px 0" }}>
                {[0, 1, 2].map((i) => (
                  <span key={i} style={{ width: "7px", height: "7px", borderRadius: "50%", background: ACCENT, opacity: 0.6, animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                ))}
                <style>{`@keyframes pulse{0%,80%,100%{transform:scale(0.7);opacity:0.4}40%{transform:scale(1);opacity:1}}`}</style>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          <div style={{ padding: "4px 16px 6px", flexShrink: 0 }}>
            <p style={{ fontSize: "0.7rem", color: "#9ca3af", margin: 0, textAlign: "center" }}>
              Can't find your answer? <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: ACCENT }}>Contact us</a>
            </p>
          </div>
          <div style={{ padding: "10px 14px", borderTop: "1px solid #e5e7eb", display: "flex", gap: "8px", alignItems: "flex-end", flexShrink: 0, background: "#fafafa" }}>
            <textarea ref={textareaRef} value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder="Ask a question about the program…" rows={1}
              style={{ flex: 1, resize: "none", border: "1px solid #e5e7eb", borderRadius: "10px", padding: "9px 12px", fontSize: "0.875rem", lineHeight: 1.4, outline: "none", background: "#fff", fontFamily: "inherit", minHeight: "38px", maxHeight: "120px", overflowY: "auto" }} />
            <button onClick={sendMessage} disabled={!input.trim() || loading}
              style={{ background: !input.trim() || loading ? "#e5e7eb" : ACCENT, color: !input.trim() || loading ? "#9ca3af" : "#fff", border: "none", borderRadius: "10px", width: "38px", height: "38px", cursor: !input.trim() || loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default function DemoPage() {
  return (
    <main style={{ minHeight: "100vh", background: "#f9fafb", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ textAlign: "center", color: "#6b7280" }}>
        <p style={{ fontSize: "1.1rem", fontWeight: 600, color: "#111" }}>FAQ Chatbot Demo</p>
        <p style={{ fontSize: "0.875rem", marginTop: "8px" }}>Click the purple button → to try it</p>
      </div>
      <FAQChatWidget />
    </main>
  );
}
