import type {
  AgentEvent,
  AgentEventListener,
} from "@/agent/types/agent";

type EventInput = Omit<AgentEvent, "id" | "timestamp">;

let sequence = 0;

function createId(): string {
  sequence += 1;
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `evt-${Date.now()}-${sequence}`;
}

/**
 * Minimal typed event bus for agent activity.
 *
 * Phase 1 use: the store subscribes once and appends every emitted event to
 * the activity timeline. Later phases (streaming LLM output, tool progress)
 * reuse the same bus without changing subscribers.
 */
export function createEventBus() {
  const listeners = new Set<AgentEventListener>();

  function emit(input: EventInput): AgentEvent {
    const event: AgentEvent = {
      ...input,
      id: createId(),
      timestamp: Date.now(),
    };
    for (const listener of listeners) {
      try {
        listener(event);
      } catch {
        // A failing subscriber must never break the agent loop or other UI.
      }
    }
    return event;
  }

  function subscribe(listener: AgentEventListener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  return { emit, subscribe };
}

export type EventBus = ReturnType<typeof createEventBus>;
