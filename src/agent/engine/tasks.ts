import type { AgentTask, TaskRecord, TaskStatus } from "@/agent/types/agent";

/**
 * Task lifecycle helpers (Phase 2).
 *
 * Legal transitions:
 *   queued → running → completed | failed | cancelled
 *   running → waiting → running (approval pause; reserved for live tools)
 * `transitionTask` throws on anything else so illegal states fail loudly in
 * development instead of silently corrupting the timeline.
 */

const LEGAL_TRANSITIONS: Record<TaskStatus, readonly TaskStatus[]> = {
  queued: ["running", "cancelled"],
  running: ["waiting", "completed", "failed", "cancelled"],
  waiting: ["running", "cancelled", "failed"],
  completed: [],
  failed: [],
  cancelled: [],
};

function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `task-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

export function createTaskRecord(request: string): TaskRecord {
  const now = Date.now();
  const base: AgentTask = {
    id: createId(),
    request,
    createdAt: now,
    status: "thinking",
  };
  return { ...base, taskStatus: "queued", startedAt: now };
}

export function transitionTask(task: TaskRecord, next: TaskStatus): TaskRecord {
  const allowed = LEGAL_TRANSITIONS[task.taskStatus];
  if (!allowed.includes(next)) {
    throw new Error(
      `Illegal task transition: ${task.taskStatus} → ${next} (task ${task.id}).`,
    );
  }
  const finished =
    next === "completed" || next === "failed" || next === "cancelled";
  return {
    ...task,
    taskStatus: next,
    finishedAt: finished ? Date.now() : task.finishedAt,
  };
}
