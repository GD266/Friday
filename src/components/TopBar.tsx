import { useBackendStatus } from "@/hooks/useBackendStatus";
import { useAgent } from "@/stores/AgentProvider";
import type { ConnectionState } from "@/types/chat";

const CONNECTION_STYLE: Record<ConnectionState, { dot: string; label: string }> = {
  online: { dot: "bg-emerald-400", label: "ONLINE" },
  offline: { dot: "bg-red-400", label: "OFFLINE" },
  "web-preview": { dot: "bg-amber-400", label: "WEB PREVIEW" },
  checking: { dot: "bg-zinc-500", label: "CONNECTING" },
};

/** Top area: FRIDAY branding left, provider + connection status right. */
export function TopBar() {
  const connection = useBackendStatus();
  const { resetSession, provider } = useAgent();
  const style = CONNECTION_STYLE[connection];
  const providerLabel =
    provider.configured === null
      ? "AI …"
      : provider.configured
        ? provider.model
        : "NO API KEY";
  const providerDot =
    provider.configured === null
      ? "bg-zinc-500"
      : provider.configured
        ? "bg-sky-400"
        : "bg-red-400";

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
          className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 sm:flex"
          role="status"
          aria-label={`AI provider ${providerLabel}`}
          title={provider.configured ? provider.label : "Set FRIDAY_API_KEY and restart"}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${providerDot}`} />
          <span className="max-w-36 truncate text-[11px] font-medium tracking-[0.15em] text-zinc-300">
            {providerLabel.toUpperCase()}
          </span>
        </div>
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
