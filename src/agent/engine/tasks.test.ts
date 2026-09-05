import { describe, expect, it } from "vitest";
import { createTaskRecord, transitionTask } from "@/agent/engine/tasks";

describe("task lifecycle", () => {
  it("creates a queued task with unique ids", () => {
    const first = createTaskRecord("hello");
    const second = createTaskRecord("hello");
    expect(first.taskStatus).toBe("queued");
    expect(first.id).not.toBe(second.id);
    expect(first.startedAt).toBeLessThanOrEqual(Date.now());
  });

  it("allows the happy path queued → running → completed", () => {
    let task = createTaskRecord("hello");
    task = transitionTask(task, "running");
    task = transitionTask(task, "completed");
    expect(task.taskStatus).toBe("completed");
    expect(task.finishedAt).toBeDefined();
  });

  it("allows running → failed and running → cancelled", () => {
    expect(
      transitionTask(transitionTask(createTaskRecord("x"), "running"), "failed")
        .taskStatus,
    ).toBe("failed");
    expect(
      transitionTask(transitionTask(createTaskRecord("x"), "running"), "cancelled")
        .taskStatus,
    ).toBe("cancelled");
  });

  it("allows waiting pause and resume", () => {
    let task = transitionTask(createTaskRecord("x"), "running");
    task = transitionTask(task, "waiting");
    task = transitionTask(task, "running");
    expect(task.taskStatus).toBe("running");
  });

  it("rejects illegal transitions loudly", () => {
    const task = createTaskRecord("x");
    expect(() => transitionTask(task, "completed")).toThrow(
      /Illegal task transition/,
    );
  });
});
