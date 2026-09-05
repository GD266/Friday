import { describe, expect, it, vi } from "vitest";
import { AgentEngine } from "@/agent/engine/AgentEngine";
import { toolRegistry } from "@/agent/tools/registry";
import type { AgentEvent, AgentStatus } from "@/agent/types/agent";
import type {
  AIProvider,
  CompletionCallbacks,
  ProviderMessage,
} from "@/agent/providers/types";
import { ProviderError } from "@/agent/providers/types";

/** Controllable fake provider: scripted replies, chunk streaming, failures. */
class FakeProvider implements AIProvider {
  readonly info = {
    id: "fake",
    label: "Fake",
    model: "fake-model",
    configured: true,
  };
  readonly seen: ProviderMessage[][] = [];
  readonly deltas: string[][] = [];
  private busy = false;
  private script: Array<
    | { kind: "reply"; text: string }
    | { kind: "fail"; error: ProviderError }
    | { kind: "hang" }
  >;
  private cancelledFlag = false;

  constructor(
    script: Array<
      | { kind: "reply"; text: string }
      | { kind: "fail"; error: ProviderError }
      | { kind: "hang" }
    >,
  ) {
    this.script = [...script];
  }

  get isBusy(): boolean {
    return this.busy;
  }

  cancel(): void {
    this.cancelledFlag = true;
  }

  async complete(
    messages: readonly ProviderMessage[],
    callbacks?: CompletionCallbacks,
  ): Promise<{ text: string; chunks: number }> {
    this.busy = true;
    this.seen.push([...messages]);
    const step = this.script.shift() ?? { kind: "reply" as const, text: "" };
    try {
      if (step.kind === "fail") {
        throw step.error;
      }
      if (step.kind === "hang") {
        for (;;) {
          if (this.cancelledFlag || callbacks?.isCancelled?.() === true) {
            throw new ProviderError("cancelled", "Request cancelled.");
          }
          await new Promise((resolve) => setTimeout(resolve, 5));
        }
      }
      const words = step.text.split(" ");
      const seen: string[] = [];
      for (const word of words) {
        if (this.cancelledFlag || callbacks?.isCancelled?.() === true) {
          throw new ProviderError("cancelled", "Request cancelled.");
        }
        callbacks?.onDelta(word + " ");
        seen.push(word);
      }
      this.deltas.push(seen);
      return { text: step.text, chunks: seen.length };
    } finally {
      this.busy = false;
    }
  }
}

function collect() {
  const events: AgentEvent[] = [];
  const statuses: AgentStatus[] = [];
  const deltas: string[] = [];
  return {
    events,
    statuses,
    deltas,
    callbacks: {
      onEvent: (event: Omit<AgentEvent, "id" | "timestamp">) => {
        events.push({ ...event, id: "test", timestamp: 0 });
      },
      onStatus: (status: AgentStatus) => {
        statuses.push(status);
      },
      onDelta: (delta: string) => {
        deltas.push(delta);
      },
    },
  };
}

function task(request: string) {
  return { id: "t1", request, createdAt: 0, status: "thinking" as const };
}

describe("AgentEngine", () => {
  it("completes a request and streams the reply", async () => {
    const provider = new FakeProvider([{ kind: "reply", text: "Hello there" }]);
    const engine = new AgentEngine(provider);
    const spy = collect();
    const reply = await engine.execute(task("hi"), spy.callbacks);
    expect(reply).toBe("Hello there");
    expect(spy.deltas.join("")).toContain("Hello");
    expect(spy.statuses).toContain("thinking");
    expect(spy.statuses).toContain("responding");
    expect(spy.statuses[spy.statuses.length - 1]).toBe("completed");
    expect(spy.events.map((event) => event.kind)).toContain("task_completed");
  });

  it("remembers session history across requests", async () => {
    const provider = new FakeProvider([
      { kind: "reply", text: "Understood" },
      { kind: "reply", text: "Atom AI" },
    ]);
    const engine = new AgentEngine(provider);
    await engine.execute(task("my project is Atom AI"), collect().callbacks);
    await engine.execute(task("what is it called?"), collect().callbacks);
    const secondCall = provider.seen[1] ?? [];
    expect(secondCall[0]?.role).toBe("system");
    expect(secondCall.map((entry) => entry.content)).toContain("Understood");
    expect(secondCall[secondCall.length - 1]).toEqual({
      role: "user",
      content: "what is it called?",
    });
  });

  it("surfaces provider failure as error state without crashing", async () => {
    const provider = new FakeProvider([
      { kind: "fail", error: new ProviderError("network", "boom") },
    ]);
    const engine = new AgentEngine(provider);
    const spy = collect();
    await expect(engine.execute(task("hi"), spy.callbacks)).rejects.toThrow(
      "boom",
    );
    expect(spy.statuses[spy.statuses.length - 1]).toBe("error");
    expect(spy.events.map((event) => event.kind)).toContain("agent_error");
  });

  it("reports missing configuration instead of crashing", async () => {
    const engine = new AgentEngine(null);
    const spy = collect();
    await expect(engine.execute(task("hi"), spy.callbacks)).rejects.toThrow(
      /not configured/i,
    );
    expect(spy.statuses[spy.statuses.length - 1]).toBe("error");
  });

  it("cancels an in-flight request and lands on cancelled", async () => {
    const provider = new FakeProvider([{ kind: "hang" }]);
    const engine = new AgentEngine(provider);
    const spy = collect();
    const pending = engine.execute(task("hi"), spy.callbacks);
    await new Promise((resolve) => setTimeout(resolve, 20));
    engine.cancel();
    await expect(pending).rejects.toThrow(/cancel/i);
    expect(spy.statuses[spy.statuses.length - 1]).toBe("cancelled");
  });

  it("records tool intent but never executes (definition-only boundary)", async () => {
    const executeSpy = vi.fn(async () => ({
      ok: true,
      output: "MUST NEVER HAPPEN",
      durationMs: 0,
    }));
    toolRegistry.register({
      name: "test_live_probe",
      description: "Probe tool for the boundary test.",
      requiresPermission: false,
      permission: "safe",
      availability: "live",
      inputSchema: { properties: {} },
      execute: executeSpy,
    });
    const provider = new FakeProvider([
      {
        kind: "reply",
        text: 'Opening now.\n```tool-request\n{"tool": "test_live_probe", "arguments": {}}\n```',
      },
    ]);
    const engine = new AgentEngine(provider);
    const spy = collect();
    const reply = await engine.execute(task("open it"), spy.callbacks);
    expect(reply).toContain("not available in Phase 2");
    expect(reply).not.toContain("```tool-request");
    expect(executeSpy).not.toHaveBeenCalled();
    expect(spy.events.map((event) => event.kind)).toContain("tool_requested");
    expect(spy.events.map((event) => event.kind)).toContain("tool_failed");
  });

  it("handles invalid tool requests transparently", async () => {
    const provider = new FakeProvider([
      {
        kind: "reply",
        text: 'Trying.\n```tool-request\n{"tool": "nope", "arguments": {}}\n```',
      },
    ]);
    const engine = new AgentEngine(provider);
    const spy = collect();
    const reply = await engine.execute(task("do it"), spy.callbacks);
    expect(reply).not.toContain("```tool-request");
    const failed = spy.events.find((event) => event.kind === "tool_failed");
    expect(failed?.detail).toContain("Unknown tool");
  });
});
