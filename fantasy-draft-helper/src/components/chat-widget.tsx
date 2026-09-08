import { useEffect, useState, useRef } from "react";
import { MessageSquare, X, Send, Loader2, GripHorizontal } from "lucide-react";
import { marked } from "marked";

interface ChatMessage { role: "user" | "assistant"; content: string }
interface Point { left: number; top: number }

const BUBBLE_SIZE = 48;
const PANEL_WIDTH = 380;
const PANEL_HEIGHT_ESTIMATE = 600;
const EDGE_GAP = 16;
const STORAGE_KEY = "chatWidgetPos";

function defaultPos(): Point {
  return {
    left: window.innerWidth - BUBBLE_SIZE - 24,
    top: window.innerHeight - BUBBLE_SIZE - 24,
  };
}

function clampPos(p: Point): Point {
  const maxLeft = window.innerWidth - BUBBLE_SIZE - 8;
  const maxTop = window.innerHeight - BUBBLE_SIZE - 8;
  return {
    left: Math.min(Math.max(p.left, 8), Math.max(8, maxLeft)),
    top: Math.min(Math.max(p.top, 8), Math.max(8, maxTop)),
  };
}

export default function ChatWidget({ platform }: { platform?: string | null } = {}) {
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [slowLoading, setSlowLoading] = useState(false);
  const [sessionId] = useState(() => `draft_${Date.now()}`);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [pos, setPos] = useState<Point>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return clampPos(JSON.parse(saved));
    } catch { /* ignore */ }
    return defaultPos();
  });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; startPos: Point } | null>(null);
  const movedRef = useRef(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
  }, [pos]);

  useEffect(() => {
    const onResize = () => setPos(p => clampPos(p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  function startDrag(e: React.PointerEvent) {
    e.preventDefault();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch { /* capture is a reliability enhancement, not required for drag to function */ }
    movedRef.current = false;
    dragRef.current = { startX: e.clientX, startY: e.clientY, startPos: pos };
    setDragging(true);
  }

  function onDrag(e: React.PointerEvent) {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) movedRef.current = true;
    setPos(clampPos({ left: dragRef.current.startPos.left + dx, top: dragRef.current.startPos.top + dy }));
  }

  function endDrag() {
    dragRef.current = null;
    setDragging(false);
  }

  function toggleChat() {
    if (movedRef.current) { movedRef.current = false; return; }
    setChatOpen(v => !v);
  }

  // Anchor panel above-right of the bubble by default; flip below/inward if it'd clip the viewport.
  const bubbleRight = pos.left + BUBBLE_SIZE;
  const spaceAbove = pos.top - EDGE_GAP;
  const panelAbove = spaceAbove >= Math.min(PANEL_HEIGHT_ESTIMATE, window.innerHeight - 7 * 16 - 2 * EDGE_GAP);
  const panelTop = panelAbove
    ? Math.max(8, pos.top - EDGE_GAP - PANEL_HEIGHT_ESTIMATE)
    : pos.top + BUBBLE_SIZE + EDGE_GAP;
  const panelLeft = Math.min(
    Math.max(8, bubbleRight - PANEL_WIDTH),
    window.innerWidth - PANEL_WIDTH - 8,
  );

  useEffect(() => {
    if (chatOpen) chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatOpen]);

  async function sendChat() {
    if (!chatInput.trim() || chatLoading) return;
    const msg = chatInput.trim();
    setChatInput("");
    setMessages(prev => [...prev, { role: "user", content: msg }]);
    setChatLoading(true);
    const slowTimer = setTimeout(() => setSlowLoading(true), 10000);
    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, session_id: sessionId, include_board: true, platform }),
      });
      const d = await r.json();
      setMessages(prev => [...prev, { role: "assistant", content: d.reply ?? `Error: ${d.error ?? "no response from server."}` }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `Lost connection reaching Zo (${err instanceof Error ? err.message : "network error"}). Your question wasn't lost — just ask it again.`,
      }]);
    } finally {
      clearTimeout(slowTimer);
      setSlowLoading(false);
      setChatLoading(false);
    }
  }

  return (
    <>
      {chatOpen && (
        <div
          style={{ left: panelLeft, top: panelTop, width: PANEL_WIDTH }}
          className="fixed z-50 flex h-[min(600px,calc(100vh-2rem))] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl"
        >
          <div
            onPointerDown={startDrag}
            onPointerMove={onDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            className={`flex items-center justify-between px-4 py-3 border-b border-border shrink-0 select-none ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
            style={{ touchAction: "none" }}
          >
            <div className="flex items-center gap-2">
              <GripHorizontal className="size-3.5 text-muted-foreground/50" />
              <MessageSquare className="size-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Draft Assistant</span>
            </div>
            <button
              onPointerDown={e => e.stopPropagation()}
              onClick={() => setChatOpen(false)}
            >
              <X className="size-4 text-muted-foreground hover:text-foreground transition-colors" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 && (
              <p className="text-xs text-muted-foreground">Ask anything about the draft — player comparisons, value picks, positional needs…</p>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`rounded-lg px-3 py-2 text-sm leading-relaxed ${m.role === "user" ? "bg-foreground/10 ml-6" : "bg-muted mr-6 prose prose-sm dark:prose-invert max-w-none"}`}
                {...(m.role === "assistant"
                  ? { dangerouslySetInnerHTML: { __html: marked.parse(m.content) as string } }
                  : { children: m.content }
                )}
              />
            ))}
            {chatLoading && (
              <div className="bg-muted rounded-lg px-3 py-2 mr-6 flex items-center gap-2">
                <Loader2 className="size-3.5 animate-spin text-muted-foreground shrink-0" />
                {slowLoading && (
                  <span className="text-xs text-muted-foreground">Still thinking, hang tight…</span>
                )}
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          <div className="px-4 py-3 border-t border-border shrink-0">
            <div className="flex gap-2">
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendChat()}
                placeholder="Ask about the draft…"
                className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-1 ring-ring"
              />
              <button
                onClick={sendChat}
                disabled={chatLoading || !chatInput.trim()}
                className="rounded-md bg-foreground text-background px-3 py-2 hover:opacity-90 disabled:opacity-40 transition-opacity"
              >
                <Send className="size-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        onPointerDown={startDrag}
        onPointerMove={onDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClick={toggleChat}
        title={chatOpen ? "Minimize chat (drag to move)" : "Open Draft Assistant (drag to move)"}
        style={{ left: pos.left, top: pos.top, touchAction: "none" }}
        className={`fixed z-50 flex size-12 items-center justify-center rounded-full bg-foreground text-background shadow-lg hover:opacity-90 transition-opacity select-none ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
      >
        {chatOpen ? <X className="size-5" /> : <MessageSquare className="size-5" />}
      </button>
    </>
  );
}
