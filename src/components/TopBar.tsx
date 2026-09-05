import { useBackendStatus } from "@/hooks/useBackendStatus";
import { useAgent } from "@/stores/AgentProvider";
import type { ConnectionState } from "@/types/chat";

const CONNECTION_STYLE: Record<ConnectionState, { dot: string; label: string }> = {
  online: { dot: "bg-emerald-400", label: "ONLINE" },
  offline: { dot: "bg-red-400", label: "OFFLINE" },
  "web-preview": { dot: "bg-amber-400", label: "WEB PREVIEW" },
  checking: { dot: "bg-zinc-500", label: "CONNECTING" },
};

/** Top area: FRIDAY branding left, backend connection status right. */
export function TopBar() {
  const connection = useBackendStatus();
  const { resetSession } = useAgent();
  const style = CONNECTION_STYLE[connection];

  return (
    <header className="flex items-center justify-between px-6 pt-5 sm:px-8">
      <div className="flex items-baseline gap-3">
        <h1 className="text-sm font-semibold tracking-[0.35em] text-zinc-100">
          FRIDAY
        </h1>
        <span className="hidden text-[11px] tracking-wide text-zinc-500 sm:inline">
          Personal AI Computer
        </span>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={resetSession}
          title="Reset session state"
          className="rounded-md px-2 py-1 text-[11px] font-medium tracking-wide text-zinc-500 transition hover:bg-white/5 hover:text-zinc-300"
        >
          RESET
        </button>
        <div
          className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5"
          role="status"
          aria-label={`Backend ${style.label}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
          <span className="text-[11px] font-medium tracking-[0.15em] text-zinc-300">
            {style.label}
          </span>
        </div>
      </div>
    </header>
  );
}
