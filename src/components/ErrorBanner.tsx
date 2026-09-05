import { useAgent } from "@/stores/AgentProvider";

/** Inline, dismissible error card fed by centralized agent/UI error state. */
export function ErrorBanner() {
  const { error, dismissError } = useAgent();

  if (error === null) {
    return null;
  }

  const showDetail = import.meta.env.DEV && error.causeDetail !== undefined;

  return (
    <div
      role="alert"
      className="anim-rise flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3"
    >
      <span
        aria-hidden="true"
        className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400"
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-red-200">{error.message}</p>
        <p className="mt-0.5 text-xs text-red-200/60">
          Source: {error.source} — the assistant is in the error state.
        </p>
        {showDetail ? (
          <pre className="slim-scroll mt-2 max-h-24 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-red-200/50">
            {error.causeDetail}
          </pre>
        ) : null}
      </div>
      <button
        type="button"
        onClick={dismissError}
        className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-red-200/70 transition hover:bg-red-500/10 hover:text-red-200"
      >
        Dismiss
      </button>
    </div>
  );
}
