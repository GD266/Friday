import { FRIDAY_SYSTEM_PROMPT } from "@/agent/personality";
import { buildContext } from "@/agent/engine/context";
import { transitionTask } from "@/agent/engine/tasks";
import { parseToolIntent, stripIntentBlock } from "@/agent/engine/toolIntent";
import { toolRegistry } from "@/agent/tools/registry";
import type {
  Agent,
  AgentCallbacks,
  AgentTask,
  TaskRecord,
} from "@/agent/types/agent";
import type {
  AIProvider,
  ProviderError,
} from "@/agent/providers/types";
import { toProviderError } from "@/agent/providers/types";
import { logger } from "@/lib/logger";
import type { ChatMessage } from "@/types/chat";

/**
 * AgentEngine — the Phase 2 reasoning layer.
 *
 * Pipeline per request:
 *   request → context (system + session history) → provider → decision
 *   → tool-intent check → permission boundary → reply + events.
 *
 * Security boundary (structurally enforced):
 *   AI MODEL → ENGINE → PERMISSION LAYER → (no execution in Phase 2).
 * The model only produces text; only the engine inspects intent; nothing in
 * Phase 2 can reach the OS. `execute` is never called on definition-only tools.
 */
export class AgentEngine implements Agent {
  readonly name = "friday-agent-engine";
  private provider: AIProvider | null;
  private readonly history: ChatMessage[] = [];
  private running = false;
  private cancelled = false;

  constructor(provider: AIProvider | null) {
    this.provider = provider;
  }

  /** Hot-swap the provider (e.g. after configuration changes). */
  setProvider(provider: AIProvider | null): void {
    this.provider = provider;
  }

  get isBusy(): boolean {
    return this.running;
  }

  /** Session memory snapshot (oldest → newest), for the store/tests. */
  getHistory(): readonly ChatMessage[] {
    return [...this.history];
  }

  cancel(): void {
    if (!this.running) {
      return;
    }
    this.cancelled = true;
    logger.info("engine", "Cancellation requested by user.");
    this.provider?.cancel();
  }

  async execute(task: AgentTask, callbacks: AgentCallbacks): Promise<string> {
    if (this.running) {
      throw new Error("AgentEngine is already running a task.");
    }
    this.running = true;
    this.cancelled = false;
    let record: TaskRecord = {
      ...task,
      taskStatus: "queued",
      startedAt: Date.now(),
    };
    const { onEvent, onStatus, onDelta } = callbacks;
    const taskId = record.id;

    try {
      logger.info("request", "Request received.", { request: task.request });
      onEvent({
        taskId,
        kind: "request_received",
        label: "Request received",
        detail: task.request,
      });

      record = transitionTask(record, "running");

      if (this.provider === null) {
        throw toProviderError(
          new Error(
            "AI provider is not configured. Set the FRIDAY_API_KEY environment variable and restart FRIDAY.",
          ),
        );
      }

      onStatus("thinking");
      onEvent({
        taskId,
        kind: "thinking_started",
        status: "thinking",
        label: "Thinking started",
      });
      logger.info("engine", "Calling AI provider.");

      const messages = buildContext(
        FRIDAY_SYSTEM_PROMPT,
        this.history,
        task.request,
      );

      let streamed = false;
      const { text: rawReply } = await this.provider.complete(messages, {
        onDelta: (delta) => {
          if (!streamed) {
            streamed = true;
            onStatus("responding");
            onEvent({
              taskId,
              kind: "response_started",
              status: "responding",
              label: "Response started",
            });
            logger.info("engine", "Response streaming.");
          }
          onDelta?.(delta);
        },
        isCancelled: () => this.cancelled,
      });

      if (this.cancelled) {
        throw toProviderError(
          Object.assign(new Error("Request cancelled."), { name: "AbortError" }),
        );
      }

      onEvent({
        taskId,
        kind: "thinking_finished",
        label: "Thinking finished",
      });
      logger.info("provider", "Response received.");
      onEvent({
        taskId,
        kind: "response_completed",
        label: "Response completed",
      });

      // Decision: structured tool intent or plain reply.
      const outcome = parseToolIntent(rawReply);
      let reply = rawReply.trim();
      if (outcome.kind === "intent") {
        logger.info("tool", "Tool intent detected.", {
          tool: outcome.intent.tool,
        });
        onEvent({
          taskId,
          kind: "tool_requested",
          label: `Tool requested: ${outcome.intent.tool}`,
          detail: outcome.intent.toolDisplay,
        });
        reply = this.handleDefinitionOnlyIntent(taskId, outcome.intent.tool, onEvent, rawReply);
      } else if (outcome.kind === "invalid") {
        logger.warn("tool", "Invalid tool request ignored.", {
          reason: outcome.reason,
        });
        onEvent({
          taskId,
          kind: "tool_failed",
          label: "Invalid tool request",
          detail: outcome.reason,
        });
        const clean = stripIntentBlock(rawReply, outcome.rawBlock);
        reply =
          clean.length > 0
            ? clean
            : "I couldn't form a valid action for that — here's what I can help with instead.";
      }

      if (reply.length === 0) {
        reply = "I didn't produce a usable reply. Please try again.";
      }

      this.remember(task.request, reply);
      record = transitionTask(record, "completed");
      onEvent({ taskId, kind: "task_completed", label: "Task completed" });
      logger.info("task", "Task completed.");
      onStatus("completed");
      return reply;
    } catch (error) {
      const providerError: ProviderError = toProviderError(error);
      if (providerError.code === "cancelled") {
        record = transitionTask(record, "cancelled");
        onEvent({ taskId, kind: "task_failed", label: "Task cancelled" });
        logger.info("task", "Task cancelled.");
        onStatus("cancelled");
        throw providerError;
      }
      record = transitionTask(record, "failed");
      onEvent({
        taskId,
        kind: "agent_error",
        label: providerError.code === "not_configured"
          ? "AI provider not configured"
          : "Agent error",
        detail: providerError.message,
      });
      logger.error("task", "Task failed.", { message: providerError.message });
      onStatus("error");
      throw providerError;
    } finally {
      this.running = false;
      this.cancelled = false;
    }
  }

  /**
   * Permission boundary: Phase 2 tools are definition-only, so a valid intent
   * is RECORDED (events) and transparently DECLINED — never executed, never
   * faked. The prose reply keeps the model's text; the protocol block is
   * stripped and replaced with an honest availability note.
   */
  private handleDefinitionOnlyIntent(
    taskId: string,
    toolName: string,
    onEvent: AgentCallbacks["onEvent"],
    rawReply: string,
  ): string {
    const tool = toolRegistry.get(toolName);
    const description = tool?.description ?? toolName;
    onEvent({
      taskId,
      kind: "tool_started",
      label: `Permission check: ${toolName}`,
      detail: "definition-only — execution disabled in Phase 2",
    });
    logger.info("tool", "Tool execution unavailable (Phase 2).", {
      tool: toolName,
    });
    onEvent({
      taskId,
      kind: "tool_failed",
      label: `Tool unavailable: ${toolName}`,
      detail: "Tool execution is not available in Phase 2.",
    });
    const match = /```tool-request\s*\n[\s\S]*?```/.exec(rawReply);
    const prose =
      match !== null ? rawReply.replace(match[0], "").trim() : rawReply.trim();
    const note =
      `I identified this as a ${description.charAt(0).toLowerCase()}${description.slice(1)} ` +
      `request ("${toolName}"), but tool execution is not available in Phase 2 — ` +
      `I did not perform any action on your computer.`;
    return prose.length > 0 ? `${prose}\n\n${note}` : note;
  }

  /** Appends the completed exchange to session memory (bounded by context). */
  private remember(request: string, reply: string): void {
    const now = Date.now();
    this.history.push(
      { id: `hist-${now}-u`, role: "user", text: request, timestamp: now },
      { id: `hist-${now}-a`, role: "assistant", text: reply, timestamp: now },
    );
    // Keep 2× the context window so trimming in buildContext stays cheap.
    const cap = 40;
    if (this.history.length > cap) {
      this.history.splice(0, this.history.length - cap);
    }
  }
}
