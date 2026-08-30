import { BackendStatus } from "./components/BackendStatus";
import { ChatPlaceholder } from "./components/ChatPlaceholder";
import { Header } from "./components/Header";
import { useHealth } from "./hooks/useHealth";

export default function App() {
  const { health, error, loading } = useHealth(5000);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "#09090b",
        color: "#e5e7eb",
        fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
      }}
    >
      <Header health={health} error={error} loading={loading} />

      <main
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "1fr 320px",
          gap: 16,
          padding: 16,
          maxWidth: 1100,
          width: "100%",
          margin: "0 auto",
        }}
      >
        {/* Left: chat */}
        <section
          style={{
            background: "#111113",
            border: "1px solid #1f2937",
            borderRadius: 12,
            padding: 16,
            display: "flex",
            flexDirection: "column",
            minHeight: 420,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Chat</h2>
          <p style={{ margin: "6px 0 12px", fontSize: 12, color: "#9ca3af" }}>
            Foundation build — provider abstraction is live, no hard-coded keys.
          </p>
          <div style={{ flex: 1, minHeight: 0 }}>
            <ChatPlaceholder />
          </div>
        </section>

        {/* Right: status + roadmap */}
        <aside style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <BackendStatus health={health} error={error} />

          <div
            style={{
              background: "#111827",
              border: "1px solid #1f2937",
              borderRadius: 10,
              padding: 12,
              fontSize: 12,
              lineHeight: 1.7,
              color: "#9ca3af",
            }}
          >
            <div style={{ fontWeight: 600, color: "#e5e7eb", marginBottom: 6 }}>Roadmap (foundation)</div>
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              <li>✅ Python package layout (agent / providers / tools / voice / memory)</li>
              <li>✅ Config + env + provider abstraction</li>
              <li>✅ Logging + error hierarchy</li>
              <li>✅ FastAPI backend + Tauri shell</li>
              <li>⬜ Voice (stubbed)</li>
              <li>⬜ Computer control (stubbed)</li>
              <li>⬜ AI reasoning & tool calling</li>
            </ul>
          </div>

          <div
            style={{
              background: "#0f172a",
              border: "1px solid #1e293b",
              borderRadius: 10,
              padding: 12,
              fontSize: 11,
              color: "#94a3b8",
            }}
          >
            <div style={{ fontWeight: 600, color: "#e2e8f0", marginBottom: 4 }}>Separation of concerns</div>
            <code style={{ fontSize: 11, color: "#cbd5e1" }}>
              friday/agent → friday/providers → friday/tools
              <br />
              friday/voice → friday/computer_control → friday/memory
              <br />
              friday/config → friday/utils (logging/errors)
            </code>
          </div>
        </aside>
      </main>

      <footer
        style={{
          padding: "10px 16px",
          borderTop: "1px solid #1f2937",
          color: "#6b7280",
          fontSize: 11,
          textAlign: "center",
        }}
      >
        Friday v0.1.0 — foundation build. No API keys required (uses mock provider by default).
      </footer>
    </div>
  );
}
