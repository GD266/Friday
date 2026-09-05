import type {
  Agent,
  AgentCallbacks,
  AgentTask,
} from "@/agent/types/agent";

/** Small cancellable delay used to simulate staged agent work. */
function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Mock task cancelled.", "AbortError"));
      return;
    }
    const timer = window.setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    function onAbort(): void {
      window.clearTimeout(timer);
      reject(new DOMException("Mock task cancelled.", "AbortError"));
    }
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function pickReply(request: string): string {
  const text = request.trim().toLowerCase();
  if (text.length === 0) {
    return "I'm listening — type a message and I'll process it.";
  }
  if (/(^|\s)(hi|hello|hey)\b/.test(text)) {
    return "Hello. FRIDAY foundation systems nominal — mock agent responding. Real intelligence arrives in a later phase.";
  }
  if (text.includes("status")) {
    return "All Phase 1 systems nominal: UI online, mock agent idle-capable, no system tools connected (by design).";
  }
  if (text.includes("help")) {
    return "Phase 1 accepts typed messages only. Try \"hello\", \"status\", or type \"error\" to preview failure handling.";
  }
  return `Mock acknowledgement: "${request.trim()}". No AI inference ran — this reply validates the agent architecture only.`;
}

/**
 * Mock agent — validates the Agent ↔ Store ↔ UI pipeline.
 *
 * Simulated pipeline: thinking → executing → completed.
 * Special mock-only triggers (documented, not hidden):
 * - message starting with "error" → simulated failure (error state path)
 * - message containing "wait"  → pauses in `waiting`, then resumes
 *
 * This class is throwaway scaffolding for the real agent; the `Agent`
 * interface it implements is the stable contract.
 */
export class MockAgent implements Agent {
  readonly name = "mock-agent";
  private controller: AbortController | null = null;

  get isBusy(): boolean {
    return this.controller !== null;
  }

  cancel(): void {
    this.controller?.abort();
    this.controller = null;
  }

  async execute(task: AgentTask, callbacks: AgentCallbacks): Promise<string> {
    const controller = new AbortController();
    this.controller = controller;
    const { signal } = controller;
    const { onEvent, onStatus } = callbacks;

    try {
      onEvent({
        taskId: task.id,
        kind: "request_received",
        label: "Request received",
        detail: task.request,
      });

      onStatus("thinking");
      onEvent({
        taskId: task.id,
        kind: "status_changed",
        status: "thinking",
        label: "Processing request",
      });
      await delay(700, signal);

      if (task.request.trim().toLowerCase().startsWith("error")) {
        throw new Error(
          "Simulated mock failure — the error state path works as designed.",
        );
      }

      // Demonstrate the `waiting` state without real tool permissions yet.
      if (task.request.toLowerCase().includes("wait")) {
        onStatus("waiting");
        onEvent({
          taskId: task.id,
          kind: "status_changed",
          status: "waiting",
          label: "Waiting for approval (simulated)",
          detail: "A future permission-gated tool would pause here.",
        });
        await delay(1200, signal);
      }

      onStatus("executing");
      onEvent({
        taskId: task.id,
        kind: "status_changed",
        status: "executing",
        label: "Executing mock step",
        detail: "No system tools are connected in Phase 1.",
      });
      await delay(800, signal);

      const reply = pickReply(task.request);
      onEvent({
        taskId: task.id,
        kind: "message",
        label: "Response ready",
        detail: reply,
      });
      onEvent({
        taskId: task.id,
        kind: "task_completed",
        label: "Task completed",
      });
      onStatus("completed");
      return reply;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        onEvent({
          taskId: task.id,
          kind: "task_failed",
          label: "Task cancelled",
        });
        onStatus("idle");
        throw error;
      }
      const message =
        error instanceof Error ? error.message : "Unknown mock agent failure.";
      onEvent({
        taskId: task.id,
        kind: "task_failed",
        label: "Task failed",
        detail: message,
      });
      onStatus("error");
      throw new Error(message);
    } finally {
      if (this.controller === controller) {
        this.controller = null;
      }
    }
  }
}
