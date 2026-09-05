import type { Tool, ToolResult } from "@/agent/types/agent";

/**
 * Phase 2 tool definitions — DEFINITIONS ONLY, never executed.
 *
 * These exist so the agent can reason about future capabilities, record
 * structured tool intent, and be tested end-to-end without touching the
 * computer. `availability` is `"definition-only"` and `execute` unconditionally
 * refuses: the permission boundary lives in the engine, but the tools
 * themselves are also inert as defense in depth.
 */

function unavailableResult(name: string, startedAt: number): ToolResult {
  return {
    ok: false,
    output: `Tool "${name}" is not available in Phase 2. Definitions only — no execution.`,
    durationMs: Date.now() - startedAt,
    error: "phase-2-unavailable",
  };
}

export const openApplicationTool: Tool<{ application?: unknown }> = {
  name: "open_application",
  description: "Open an installed desktop application.",
  requiresPermission: true,
  permission: "requiresApproval",
  availability: "definition-only",
  inputSchema: {
    properties: {
      application: {
        type: "string",
        description: "Display name of the application, e.g. \"Visual Studio Code\".",
      },
    },
    required: ["application"],
  },
  execute: async () => unavailableResult("open_application", Date.now()),
};

export const getSystemInfoTool: Tool<Record<string, unknown>> = {
  name: "get_system_info",
  description: "Read basic system information (OS, CPU, memory).",
  requiresPermission: false,
  permission: "safe",
  availability: "definition-only",
  inputSchema: { properties: {} },
  execute: async () => unavailableResult("get_system_info", Date.now()),
};

/** Every tool the Phase 2 agent is allowed to reason about. */
export const PHASE_2_TOOLS: Array<Tool<never>> = [
  openApplicationTool as Tool<never>,
  getSystemInfoTool as Tool<never>,
];
