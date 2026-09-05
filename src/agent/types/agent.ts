/**
 * Future-proof agent interfaces (Phase 1).
 *
 * These types define the contract every agent implementation — mock today,
 * LLM-backed in later phases — must satisfy. Tools for terminal, filesystem,
 * application control, keyboard, mouse, browser, screenshot, git, and system
 * information will be added later as `Tool` implementations only; the
 * interfaces below already support them and must not change shape lightly.
 */

/** Lifecycle state of the assistant. Driven by the agent, rendered by the UI. */
export type AgentStatus =
  | "idle"
  | "listening"
  | "thinking"
  | "executing"
  | "waiting"
  | "completed"
  | "error";

/** Ordered lifecycle of a single user request. */
export interface AgentTask {
  readonly id: string;
  readonly request: string;
  readonly createdAt: number;
  status: AgentStatus;
  /** Human-readable result produced by the agent (mock text in Phase 1). */
  result?: string;
  /** Populated when the task ends in `error`. */
  error?: string;
}

/** Granular timeline entries emitted while a task runs. */
export type AgentEventKind =
  | "request_received"
  | "status_changed"
  | "tool_started"
  | "tool_finished"
  | "message"
  | "task_completed"
  | "task_failed";

export interface AgentEvent {
  readonly id: string;
  readonly taskId: string;
  readonly kind: AgentEventKind;
  /** Epoch milliseconds; assigned at emission time. */
  readonly timestamp: number;
  /** Short human-readable line shown in the activity panel. */
  readonly label: string;
  /** Optional extra detail (tool name, error text, assistant reply …). */
  readonly detail?: string;
  /** Status the assistant moved into, for `status_changed` events. */
  readonly status?: AgentStatus;
}

export type AgentEventListener = (event: AgentEvent) => void;

/**
 * A capability the agent may invoke. Phase 1 ships the interface only —
 * no concrete tools are registered (see `src/agent/tools/registry.ts`).
 *
 * Security contract for later phases:
 * - `requiresPermission` must be `true` for any tool that touches the system.
 * - The executor must obtain explicit user approval before running such tools.
 * - Tools must validate and narrow their inputs; never accept raw shell strings.
 */
export interface Tool<Input = unknown> {
  /** Stable machine name, e.g. `"terminal"`, `"filesystem.read"`. */
  readonly name: string;
  /** One-line human-readable description shown in permission prompts. */
  readonly description: string;
  /** Whether user approval is required before execution. */
  readonly requiresPermission: boolean;
  execute: (input: Input) => Promise<ToolResult>;
}

/** Outcome of a single tool invocation. */
export interface ToolResult {
  readonly ok: boolean;
  /** Human-readable summary or payload preview. */
  readonly output: string;
  /** Machine-readable payload, if any. Must be JSON-serializable. */
  readonly data?: Record<string, unknown>;
  readonly error?: string;
  /** Wall-clock duration of the invocation in milliseconds. */
  readonly durationMs: number;
}

/** Callbacks an agent uses to report progress on a task. */
export interface AgentCallbacks {
  onEvent: (event: Omit<AgentEvent, "id" | "timestamp">) => void;
  onStatus: (status: AgentStatus) => void;
}

/**
 * The agent contract. Implementations receive a task plus reporting
 * callbacks and resolve with the final assistant reply.
 */
export interface Agent {
  readonly name: string;
  /** True while an `execute` call is in flight; the store serializes tasks. */
  readonly isBusy: boolean;
  execute: (task: AgentTask, callbacks: AgentCallbacks) => Promise<string>;
  cancel: () => void;
}
