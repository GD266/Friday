import { useAgent } from "@/stores/AgentProvider";
import type { AgentStatus } from "@/agent/types/agent";

const STATUS_COPY: Record<AgentStatus, { title: string; hint: string }> = {
  idle: { title: "IDLE", hint: "Ready for your next request" },
  listening: { title: "LISTENING", hint: "Composing — voice input plugs in here" },
  thinking: { title: "THINKING", hint: "Reasoning over your request" },
  executing: { title: "EXECUTING", hint: "Running the planned step" },
  responding: { title: "RESPONDING", hint: "Streaming the reply" },
  waiting: { title: "WAITING", hint: "Paused — approval required" },
  completed: { title: "COMPLETED", hint: "Task finished successfully" },
  cancelled: { title: "CANCELLED", hint: "Request stopped — ready for the next one" },
  error: { title: "ERROR", hint: "Task failed — see details below" },
};

const ACCENT: Record<AgentStatus, string> = {
  idle: "bg-zinc-500",
  listening: "bg-sky-400",
  thinking: "bg-sky-300",
  executing: "bg-violet-400",
  responding: "bg-sky-200",
  waiting: "bg-amber-400",
  completed: "bg-emerald-400",
  cancelled: "bg-zinc-400",
  error: "bg-red-400",
};

/**
 * Center assistant visual: a restrained orbital core whose motion and accent
 * reflect the live agent status. Decorative layers are aria-hidden; the
 * status text itself is the accessible live region.
 */
export function AssistantCore() {
  const { displayStatus } = useAgent();
  const copy = STATUS_COPY[displayStatus];
  const accent = ACCENT[displayStatus];
  const active =
    displayStatus === "thinking" ||
    displayStatus === "executing" ||
    displayStatus === "responding" ||
    displayStatus === "listening";

  return (
    <section
      className="flex flex-col items-center px-6"
      aria-live="polite"
      aria-label={`Assistant status: ${copy.title}`}
    >
      <div className="relative flex h-44 w-44 items-center justify-center sm:h-52 sm:w-52">
        {/* Ambient halo */}
        <div
          aria-hidden="true"
          className="absolute inset-0 rounded-full bg-sky-400/[0.05] blur-2xl"
        />
        {/* Pulse ring while busy */}
        {active ? (
          <div
            aria-hidden="true"
            className="anim-pulse-ring absolute inset-2 rounded-full border border-sky-300/30"
          />
        ) : null}
        {/* Orbit ring */}
        <div
          aria-hidden="true"
          className={`absolute inset-4 rounded-full border border-white/10 ${
            active ? "anim-spin-slow" : ""
          }`}
          style={{ borderTopColor: "rgba(125,211,252,0.5)" }}
        />
        {/* Inner orbit */}
        <div
          aria-hidden="true"
          className="absolute inset-9 rounded-full border border-white/[0.07]"
        />
        {/* Core */}
        <div
          aria-hidden="true"
          className={`${active ? "anim-breathe" : ""} relative flex h-20 w-20 items-center justify-center rounded-full border border-white/15 bg-zinc-900 shadow-[0_0_60px_-12px_rgba(125,211,252,0.35)]`}
        >
          <span className={`h-2.5 w-2.5 rounded-full ${accent}`} />
        </div>
      </div>

      <h2
        key={displayStatus}
        className="anim-rise mt-6 text-xl font-semibold tracking-[0.25em] text-zinc-100 sm:text-2xl"
      >
        {copy.title}
      </h2>
      <p className="mt-2 text-sm text-zinc-500">{copy.hint}</p>
    </section>
  );
}
