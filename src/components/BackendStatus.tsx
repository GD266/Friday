import { getApiUrl } from "../utils/api";
import type { HealthStatus } from "../types";

type Props = {
  health: HealthStatus | null;
  error: string | null;
};

export function BackendStatus({ health, error }: Props) {
  return (
    <div
      style={{
        background: "#111827",
        border: "1px solid #1f2937",
        borderRadius: 10,
        padding: 12,
        fontSize: 12,
        lineHeight: 1.6,
        color: "#9ca3af",
      }}
    >
      <div style={{ fontWeight: 600, color: "#e5e7eb", marginBottom: 6 }}>Backend</div>
      <div>
        API: <code style={{ color: "#e5e7eb" }}>{getApiUrl()}</code>
      </div>
      {error ? (
        <div style={{ color: "#f87171" }}>Offline — {error}</div>
      ) : health ? (
        <>
          <div>
            Provider: <code style={{ color: "#e5e7eb" }}>{health.provider}</code> · healthy: {health.provider_healthy ? "yes" : "no"}
          </div>
          <div>Memory entries: {health.memory_count}</div>
        </>
      ) : (
        <div>Loading…</div>
      )}
      <div style={{ marginTop: 8, fontSize: 11, color: "#6b7280" }}>
        Run <code>python -m friday</code> or <code>uvicorn friday.__main__:build_app --host 127.0.0.1 --port 8000</code> to start the backend.
      </div>
    </div>
  );
}
