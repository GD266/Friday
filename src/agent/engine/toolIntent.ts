import { toolRegistry } from "@/agent/tools/registry";

/**
 * Structured tool-intent parsing (Phase 2).
 *
 * The system prompt instructs the model to append at most one fenced block:
 *
 *   ```tool-request
 *   {"tool": "<name>", "arguments": {...}}
 *   ```
 *
 * The engine parses that block into a validated `ToolIntent`. Anything else —
 * unknown tool, malformed JSON, schema violation — becomes an `InvalidIntent`
 * that the engine reports transparently instead of executing or faking.
 */

export interface ToolIntent {
  readonly tool: string;
  readonly toolDisplay: string;
  readonly arguments: Record<string, unknown>;
  /** The exact fenced block, so the engine can strip it from visible reply. */
  readonly rawBlock: string;
}

export type IntentOutcome =
  | { readonly kind: "none" }
  | { readonly kind: "intent"; intent: ToolIntent }
  | { readonly kind: "invalid"; reason: string; rawBlock: string };

const FENCE_PATTERN = /```tool-request\s*\n([\s\S]*?)```/;

function validateArguments(
  toolName: string,
  value: unknown,
): { ok: true; args: Record<string, unknown> } | { ok: false; reason: string } {
  const tool = toolRegistry.get(toolName);
  if (tool === undefined) {
    return { ok: false, reason: `Unknown tool "${toolName}".` };
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return {
      ok: false,
      reason: `Invalid arguments for "${toolName}": expected a JSON object.`,
    };
  }
  const args = value as Record<string, unknown>;
  const required = tool.inputSchema.required ?? [];
  for (const key of required) {
    const property = tool.inputSchema.properties[key];
    const entry = args[key];
    if (entry === undefined || entry === null || entry === "") {
      return {
        ok: false,
        reason: `Invalid arguments for "${toolName}": missing required field "${key}".`,
      };
    }
    if (property !== undefined && typeof entry !== property.type) {
      return {
        ok: false,
        reason: `Invalid arguments for "${toolName}": "${key}" must be a ${property.type}.`,
      };
    }
  }
  return { ok: true, args: { ...args } };
}

export function parseToolIntent(reply: string): IntentOutcome {
  const match = FENCE_PATTERN.exec(reply);
  if (match === null) {
    return { kind: "none" };
  }
  const rawBlock = match[0];
  const payload = (match[1] ?? "").trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload) as unknown;
  } catch {
    return { kind: "invalid", reason: "Malformed tool-request JSON.", rawBlock };
  }
  if (
    parsed === null ||
    typeof parsed !== "object" ||
    Array.isArray(parsed) ||
    typeof (parsed as Record<string, unknown>).tool !== "string"
  ) {
    return {
      kind: "invalid",
      reason: "Malformed tool request: expected {\"tool\": string, \"arguments\": object}.",
      rawBlock,
    };
  }
  const { tool: toolName, arguments: rawArgs } = parsed as {
    tool: string;
    arguments?: unknown;
  };
  const tool = toolRegistry.get(toolName);
  if (tool === undefined) {
    return { kind: "invalid", reason: `Unknown tool "${toolName}".`, rawBlock };
  }
  const validated = validateArguments(toolName, rawArgs ?? {});
  if (!validated.ok) {
    return { kind: "invalid", reason: validated.reason, rawBlock };
  }
  return {
    kind: "intent",
    intent: {
      tool: toolName,
      toolDisplay: tool.description,
      arguments: validated.args,
      rawBlock,
    },
  };
}

/** Removes the fenced intent block so users see the prose, not the protocol. */
export function stripIntentBlock(reply: string, rawBlock: string): string {
  return reply.replace(rawBlock, "").trim();
}
