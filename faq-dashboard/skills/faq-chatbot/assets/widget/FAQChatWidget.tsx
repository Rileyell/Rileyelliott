// FAQChatWidget — drop-in KITE FAQ chatbot widget.
// Paste this component into any zo.space page route and render:
//   <FAQChatWidget slug="your-event-slug-2026" />
//
// Props:
//   slug     (required) — matches a slug in faq-events.json
//   accent   (optional) — hex accent color, default KITE violet #7C3AED
//   greeting (optional) — override the opening message

import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";

// ── CONFIG ────────────────────────────────────────────────────────────────────
// If you rename the API route, update this path.
const API_PATH = "/api/faq-chat";
// ─────────────────────────────────────────────────────────────────────────────

interface FAQChatWidgetProps {
  slug: string;
  accent?: string;
  greeting?: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function FAQChatWidget({
  slug,
  accent = "#7C3AED",
  greeting,
}: FAQChatWidgetProps) {
  const defaultGreeting =
    greeting ||
    "Hi! I'm the KITE FAQ assistant. Ask me anything about the program — applications, timelines, judging, or what to expect.";

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: defaultGreeting },
  ]);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  const accentSoft = accent + "18"; // low-opacity tint for user bubbles

  async function sendMessage() {
    const q = input.trim();
    if (!q || loading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: q }]);
    setLoading(true);

    try {
      const res = await fetch(API_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ slug, question: q }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              data.error ||
              "Something went wrong. Please try again or email hello@kitescouting.com.",
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.response },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Network error. Please check your connection and try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  // ── Closed: floating button ─────────────────────────────────────────────────
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Open FAQ assistant"
        style={{
          position: "fixed",
          bottom: "28px",
          right: "28px",
          width: "56px",
          height: "56px",
          borderRadius: "50%",
          background: accent,
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: `0 4px 24px ${accent}55`,
          zIndex: 999,
          transition: "transform 0.15s ease, box-shadow 0.15s ease",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.08)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
        }}
      >
        <MessageCircle color="#fff" size={24} />
      </button>
    );
  }

  // ── Open: chat panel ────────────────────────────────────────────────────────
  return (
    <div
      style={{
        position: "fixed",
        bottom: "28px",
        right: "28px",
        width: "360px",
        maxWidth: "calc(100vw - 32px)",
        height: "520px",
        maxHeight: "calc(100vh - 56px)",
        background: "#ffffff",
        borderRadius: "16px",
        boxShadow: "0 8px 48px rgba(0,0,0,0.18)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        zIndex: 999,
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: accent,
          padding: "14px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "50%",
              background: "rgba(255,255,255,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <MessageCircle color="#fff" size={16} />
          </div>
          <div>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: "0.875rem", lineHeight: 1.2 }}>
              FAQ Assistant
            </div>
            <div style={{ color: "rgba(255,255,255,0.75)", fontSize: "0.7rem" }}>
              Powered by KITE Scouting
            </div>
          </div>
        </div>
        <button
          onClick={() => setOpen(false)}
          aria-label="Close chat"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "4px",
            borderRadius: "6px",
            display: "flex",
            color: "rgba(255,255,255,0.8)",
          }}
        >
          <X size={18} />
        </button>
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
            }}
          >
            <div
              style={{
                maxWidth: "85%",
                padding: "10px 14px",
                borderRadius:
                  msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                background: msg.role === "user" ? accentSoft : "#f4f4f5",
                border: msg.role === "user" ? `1px solid ${accent}30` : "1px solid #e4e4e7",
                fontSize: "0.8375rem",
                lineHeight: 1.55,
                color: "#18181b",
                wordBreak: "break-word",
                whiteSpace: "pre-wrap",
              }}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {loading && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div
              style={{
                padding: "10px 14px",
                borderRadius: "16px 16px 16px 4px",
                background: "#f4f4f5",
                border: "1px solid #e4e4e7",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                color: "#71717a",
                fontSize: "0.8rem",
              }}
            >
              <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
              Thinking…
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div
        style={{
          borderTop: "1px solid #e4e4e7",
          padding: "12px",
          display: "flex",
          gap: "8px",
          alignItems: "flex-end",
          flexShrink: 0,
        }}
      >
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about the program…"
          rows={1}
          style={{
            flex: 1,
            resize: "none",
            border: "1px solid #e4e4e7",
            borderRadius: "10px",
            padding: "9px 12px",
            fontSize: "0.8375rem",
            lineHeight: 1.5,
            outline: "none",
            fontFamily: "inherit",
            background: "#fafafa",
            color: "#18181b",
            overflowY: "hidden",
          }}
        />
        <button
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          aria-label="Send"
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "10px",
            background: loading || !input.trim() ? "#e4e4e7" : accent,
            border: "none",
            cursor: loading || !input.trim() ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            transition: "background 0.15s ease",
          }}
        >
          <Send
            size={15}
            color={loading || !input.trim() ? "#a1a1aa" : "#fff"}
          />
        </button>
      </div>

      {/* Spinner keyframe (injected inline) */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
