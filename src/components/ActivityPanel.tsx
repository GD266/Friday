import { useEffect, useRef } from "react";
import { useAgent } from "@/stores/AgentProvider";
import type { AgentEventKind } from "@/agent/types/agent";

const KIND_DOT: Record<AgentEventKind, string> = {
  request_received: "bg-sky-400",
  status_changed: "bg-violet-400",
  thinking_started: "bg-sky-300",
  thinking_finished: "bg-sky-200",
  response_started: "bg-sky-200",
  response_completed: "bg-emerald-300",
  tool_requested: "bg-amber-400",
  tool_started: "bg-amber-400",
  tool_completed: "bg-emerald-400",
  tool_failed: "bg-red-400",
  tool_finished: "bg-amber-200",
  message: "bg-zinc-300",
  agent_error: "bg-red-400",
  task_completed: "bg-emerald-400",
  task_failed: "bg-red-400",
};

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/** Compact activity timeline: the future agent execution view (Phase 1: mock events). */
export function ActivityPanel() {
  const { events } = useAgent();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = scrollRef.current;
    if (node) {
      node.scrollTop = node.scrollHeight;
    }
  }, [events.length]);

  return (
    <section
      aria-label="Activity"
      className="flex min-h-0 w-full flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.02]"
    >
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
        <h2 className="text-[11px] font-semibold tracking-[0.2em] text-zinc-400">
          ACTIVITY
        </h2>
        <span className="font-mono text-[11px] text-zinc-600">
          {events.length} event{events.length === 1 ? "" : "s"}
        </span>
      </div>
      <div
        ref={scrollRef}
        className="slim-scroll min-h-0 max-h-44 flex-1 overflow-y-auto px-4 py-2"
      >
        {events.length === 0 ? (
          <p className="py-4 text-center text-[13px] text-zinc-600">
            No activity yet — send a message to start the mock pipeline.
          </p>
        ) : (
          <ol className="flex flex-col">
            {events.map((event) => (
              <li
                key={event.id}
                className="anim-rise flex items-baseline gap-2.5 border-b border-white/[0.04] py-1.5 font-mono text-xs last:border-0"
              >
                <span
                  aria-hidden="true"
                  className={`mt-0.5 h-1.5 w-1.5 shrink-0 self-center rounded-full ${KIND_DOT[event.kind]}`}
                />
                <span className="shrink-0 text-zinc-600">
                  {formatTime(event.timestamp)}
                </span>
                <span className="min-w-0 flex-1 truncate text-zinc-300">
                  {event.label}
                  {event.detail ? (
                    <span className="text-zinc-500"> — {event.detail}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
