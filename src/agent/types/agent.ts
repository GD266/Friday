/**
 * Future-proof agent interfaces (Phase 2: real AI brain + agent engine).
 *
 * Phase 1 established these contracts with a mock agent; Phase 2 keeps every
 * existing shape and extends it additively:
 * - `AgentStatus` gains `responding` (streaming reply) and `cancelled`.
 * - `AgentEventKind` gains thinking/response/tool-failure granularity.
 * - `Tool` gains permission level, availability, and a minimal input schema
 *   so Phase 2 tools can exist as safe definitions without execution.
 * - `TaskRecord`/`TaskStatus` track the request lifecycle for the UI.
 */

/** Lifecycle state of the assistant. Driven by the agent, rendered by the UI. */
export type AgentStatus =
  | "idle"
  | "listening"
  | "thinking"
  | "executing"
  | "responding"
  | "waiting"
  | "completed"
  | "cancelled"
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
  | "thinking_started"
  | "thinking_finished"
  | "response_started"
  | "response_completed"
  | "tool_requested"
  | "tool_started"
  | "tool_completed"
  | "tool_failed"
  | "tool_finished"
  | "message"
  | "agent_error"
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
 * Permission tier for a tool. The engine enforces the boundary:
 * - `safe`: read-only, no approval needed (only tier usable in Phase 2).
 * - `requiresApproval`: must pause in `waiting` for explicit user consent.
 * - `system`: reserved for future OS-level control; never auto-approved.
 */
export type ToolPermission = "safe" | "requiresApproval" | "system";

/**
 * Execution availability. Phase 2 tools are `definition-only`: the agent can
 * reason about them and record intent, but the engine always reports them as
 * unavailable instead of executing anything.
 */
export type ToolAvailability = "definition-only" | "mock" | "live";

/** Minimal JSON-schema-style input contract for a tool's arguments. */
export interface ToolInputSchema {
  readonly properties: Record<
    string,
    { readonly type: "string" | "number" | "boolean"; readonly description: string }
  >;
  readonly required?: readonly string[];
}

/**
 * A capability the agent may invoke.
 *
 * Security contract (unchanged from Phase 1, now enforced by the engine):
 * - The AI model NEVER calls `execute` directly; only the engine does, after
 *   passing the permission layer (`availability` + `requiresPermission`).
 * - Tools must validate and narrow their inputs; never accept raw shell strings.
 */
export interface Tool<Input = unknown> {
  /** Stable machine name, e.g. `"open_application"`. */
  readonly name: string;
  /** One-line human-readable description shown in permission prompts. */
  readonly description: string;
  /** Whether user approval is required before execution. */
  readonly requiresPermission: boolean;
  readonly permission: ToolPermission;
  readonly availability: ToolAvailability;
  readonly inputSchema: ToolInputSchema;
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
  /** Streaming reply deltas; the store appends them to the pending message. */
  onDelta?: (text: string) => void;
}

/** Request lifecycle tracked by the AgentEngine and shown in the UI. */
export type TaskStatus =
  | "queued"
  | "running"
  | "waiting"
  | "completed"
  | "failed"
  | "cancelled";

/** Full lifecycle record for one user request. */
export interface TaskRecord extends AgentTask {
  taskStatus: TaskStatus;
  readonly startedAt: number;
  finishedAt?: number;
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
