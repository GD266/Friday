import type { Tool } from "@/agent/types/agent";

/**
 * Registry for agent tools.
 *
 * Phase 1 intentionally registers ZERO tools — the registry exists so that
 * later phases (terminal, filesystem, app control, keyboard, mouse, browser,
 * screenshot, git, system info) can plug in without touching agent or UI code.
 *
 * Security rule enforced here: any tool with `requiresPermission: true`
 * must pass through an explicit approval step before `execute` runs.
 * The approval UI lands with the first permission-gated tool (Phase 2+).
 */
export class ToolRegistry {
  private readonly tools = new Map<string, Tool<never>>();

  register(tool: Tool<never>): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool "${tool.name}" is already registered.`);
    }
    this.tools.set(tool.name, tool);
  }

  get(name: string): Tool<never> | undefined {
    return this.tools.get(name);
  }

  list(): Array<Pick<Tool<never>, "name" | "description" | "requiresPermission">> {
    return [...this.tools.values()].map((tool) => ({
      name: tool.name,
      description: tool.description,
      requiresPermission: tool.requiresPermission,
    }));
  }

  get size(): number {
    return this.tools.size;
  }
}

/** Shared singleton; tools self-register here in later phases. */
export const toolRegistry = new ToolRegistry();
