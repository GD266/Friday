import { describe, expect, it } from "vitest";
import {
  parseToolIntent,
  stripIntentBlock,
} from "@/agent/engine/toolIntent";

describe("parseToolIntent", () => {
  it("returns none when the reply has no tool-request block", () => {
    expect(parseToolIntent("Just a plain helpful answer.")).toEqual({
      kind: "none",
    });
  });

  it("parses a valid open_application intent", () => {
    const reply = [
      "Sure, opening it now.",
      "```tool-request",
      '{"tool": "open_application", "arguments": {"application": "Visual Studio Code"}}',
      "```",
    ].join("\n");
    const outcome = parseToolIntent(reply);
    expect(outcome.kind).toBe("intent");
    if (outcome.kind !== "intent") {
      throw new Error("expected intent");
    }
    expect(outcome.intent.tool).toBe("open_application");
    expect(outcome.intent.arguments).toEqual({
      application: "Visual Studio Code",
    });
    expect(outcome.intent.rawBlock).toContain("```tool-request");
  });

  it("rejects an unknown tool", () => {
    const outcome = parseToolIntent(
      '```tool-request\n{"tool": "delete_everything", "arguments": {}}\n```',
    );
    expect(outcome.kind).toBe("invalid");
    if (outcome.kind !== "invalid") {
      throw new Error("expected invalid");
    }
    expect(outcome.reason).toContain("Unknown tool");
  });

  it("rejects malformed JSON", () => {
    const outcome = parseToolIntent(
      "```tool-request\n{not valid json\n```",
    );
    expect(outcome.kind).toBe("invalid");
  });

  it("rejects missing required arguments", () => {
    const outcome = parseToolIntent(
      '```tool-request\n{"tool": "open_application", "arguments": {}}\n```',
    );
    expect(outcome.kind).toBe("invalid");
    if (outcome.kind !== "invalid") {
      throw new Error("expected invalid");
    }
    expect(outcome.reason).toContain("application");
  });

  it("rejects wrong argument types", () => {
    const outcome = parseToolIntent(
      '```tool-request\n{"tool": "open_application", "arguments": {"application": 42}}\n```',
    );
    expect(outcome.kind).toBe("invalid");
  });

  it("strips the protocol block from visible reply text", () => {
    const rawBlock = '```tool-request\n{"tool": "get_system_info", "arguments": {}}\n```';
    expect(stripIntentBlock(`Hello.\n${rawBlock}`, rawBlock)).toBe("Hello.");
  });
});
