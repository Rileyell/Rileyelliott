// FaqChatWidget — drop-in AI chatbot for any KITE FAQ dashboard.
// Render: <FaqChatWidget slug="your-event-slug" />
// Requires /api/faq-chat deployed in zo.space.
import { useState } from "react";
import { MessageCircle, X } from "lucide-react";

interface FaqChatWidgetProps {
  slug: string;
  accentColor?: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function FaqChatWidget({ slug, accentColor = "#7C3AED" }: FaqChatWidgetProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const softBg = `${accentColor}18`;

  const renderMarkdown = (text: string) => {
    const html = text
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/^- (.*?)$/gm, "<li>$1</li>")
      .replace(/\n/g, "<br />");
    return <div dangerouslySetInnerHTML={{ __html: html }} />;
  };

  const send = async (messageToSend?: string) => {
    const message = (messageToSend || input).trim();
    if (!message || loading) return;

    setMessages(prev => [...prev, { role: "user", content: message }]);
    setInput("");
    setLoading(true);

    try {
      const history = messages.map(({ role, content }) => ({ role, content }));
      const res = await fetch("/api/faq-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ slug, question: message, history }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, {
        role: "assistant",
        content: res.ok ? data.response : "Sorry, something went wrong. Please try again.",
      }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Error connecting to chatbot. Try again later." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {open && (
        <div style={{
          position: "fixed", bottom: "20px", right: "20px",
          width: "380px", height: "500px",
          background: "#ffffff", border: "1px solid #e5e7eb",
          borderRadius: "18px", boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
          display: "flex", flexDirection: "column", zIndex: 1000,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px", borderBottom: "1px solid #e5e7eb" }}>
            <h3 style={{ margin: 0, fontWeight: 700, color: "#111827", fontSize: "0.95rem" }}>Ask AI</h3>
            <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
              <X style={{ width: "18px", height: "18px", color: "#64748b" }} />
            </button>
          </div>

          <div style={{ flex: 1, overflow: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
            {messages.length === 0 && (
              <p style={{ color: "#64748b", fontSize: "0.85rem", textAlign: "center", marginTop: "40px" }}>
                Ask me anything about this program.
              </p>
            )}
            {messages.map((msg, i) => (
              <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                <div style={{
                  maxWidth: "80%", padding: "10px 12px", borderRadius: "12px",
                  background: msg.role === "user" ? accentColor : softBg,
                  color: msg.role === "user" ? "#ffffff" : "#111827",
                  fontSize: "0.875rem", lineHeight: "1.45",
                }}>
                  {renderMarkdown(msg.content)}
                </div>
              </div>
            ))}
            {loading && <div style={{ color: "#64748b", fontSize: "0.85rem" }}>Thinking…</div>}
          </div>

          <div style={{ padding: "12px", borderTop: "1px solid #e5e7eb", display: "flex", gap: "8px" }}>
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && send()}
              placeholder="Type a message…"
              style={{ flex: 1, padding: "8px 12px", borderRadius: "999px", border: "1px solid #e5e7eb", fontSize: "0.875rem", outline: "none" }}
            />
            <button
              onClick={() => send()}
              disabled={loading || !input.trim()}
              style={{
                background: accentColor, color: "#ffffff", border: "none",
                borderRadius: "999px", padding: "8px 14px",
                fontWeight: 700, cursor: "pointer", fontSize: "0.85rem",
                opacity: loading || !input.trim() ? 0.5 : 1,
              }}
            >
              Send
            </button>
          </div>
        </div>
      )}

      {!open && (
        <button
          onClick={() => setOpen(true)}
          style={{
            position: "fixed", bottom: "20px", right: "20px",
            width: "56px", height: "56px", borderRadius: "999px",
            background: accentColor, color: "#ffffff", border: "none",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 16px 34px ${accentColor}40`, zIndex: 999,
          }}
        >
          <MessageCircle style={{ width: "24px", height: "24px" }} />
        </button>
      )}
    </>
  );
}
