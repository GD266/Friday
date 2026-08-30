import type { HealthStatus } from "../types";

type Props = {
  health: HealthStatus | null;
  error: string | null;
  loading: boolean;
};

export function Header({ health, error, loading }: Props) {
  const statusColor = error ? "#ef4444" : health?.provider_healthy ? "#22c55e" : "#eab308";
  const statusText = loading ? "Checking…" : error ? "Backend offline" : `${health?.provider ?? "—"} · ${health?.provider_healthy ? "ready" : "not ready"}`;

  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 16px",
        borderBottom: "1px solid #222",
        background: "#0f0f0f",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: "linear-gradient(135deg,#3b82f6,#8b5cf6)",
            display: "grid",
            placeItems: "center",
            fontWeight: 700,
            color: "white",
            fontSize: 14,
          }}
        >
          F
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, letterSpacing: 0.3 }}>Friday</div>
          <div style={{ fontSize: 11, color: "#9ca3af" }}>Desktop AI Assistant · foundation build</div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#9ca3af" }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            background: statusColor,
            display: "inline-block",
            boxShadow: `0 0 8px ${statusColor}66`,
          }}
        />
        <span>{statusText}</span>
      </div>
    </header>
  );
}
