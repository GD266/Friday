import { useState } from "react";
import { sendChat } from "../utils/api";

export function ChatPlaceholder() {
  const [input, setInput] = useState("");
  const [log, setLog] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSend() {
    const text = input.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    setLog((prev) => [...prev, { role: "user", content: text }]);
    setInput("");

    try {
      const res = await sendChat(text);
      setLog((prev) => [...prev, { role: "assistant", content: res.content }]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setLog((prev) => [...prev, { role: "assistant", content: `⚠️ ${msg}` }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, height: "100%" }}>
      <div style={{ fontSize: 12, color: "#9ca3af" }}>
        This is the foundation chat. AI reasoning / streaming is wired through the provider abstraction. Voice & computer control are stubbed for now.
      </div>

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          background: "#0b0e14",
          border: "1px solid #1f2937",
          borderRadius: 10,
          padding: 12,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          minHeight: 180,
        }}
      >
        {log.length === 0 ? (
          <div style={{ color: "#6b7280", fontSize: 13, textAlign: "center", marginTop: 24 }}>
            No messages yet — say hello to Friday ✨
          </div>
        ) : (
          log.map((m, i) => (
            <div
              key={i}
              style={{
                alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                maxWidth: "80%",
                background: m.role === "user" ? "#1d4ed8" : "#1f2937",
                color: "#e5e7eb",
                padding: "8px 10px",
                borderRadius: 10,
                borderTopRightRadius: m.role === "user" ? 2 : 10,
                borderTopLeftRadius: m.role === "assistant" ? 2 : 10,
                fontSize: 13,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {m.content}
            </div>
          ))
        )}
        {busy && <div style={{ fontSize: 12, color: "#9ca3af" }}>Friday is thinking…</div>}
      </div>

      {error && <div style={{ color: "#f87171", fontSize: 12 }}>{error}</div>}

      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          placeholder="Type a message…"
          style={{
            flex: 1,
            background: "#111827",
            border: "1px solid #1f2937",
            borderRadius: 8,
            padding: "10px 12px",
            color: "#e5e7eb",
            outline: "none",
            fontSize: 13,
          }}
        />
        <button
          onClick={onSend}
          disabled={busy || !input.trim()}
          style={{
            background: busy || !input.trim() ? "#1f2937" : "#2563eb",
            color: "white",
            border: "none",
            borderRadius: 8,
            padding: "10px 16px",
            fontWeight: 600,
            cursor: busy || !input.trim() ? "not-allowed" : "pointer",
            fontSize: 13,
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
