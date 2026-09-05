import { describe, expect, it } from "vitest";
import { buildContext } from "@/agent/engine/context";
import type { ChatMessage } from "@/types/chat";

function message(role: "user" | "assistant", text: string): ChatMessage {
  return { id: text, role, text, timestamp: 0 };
}

describe("buildContext", () => {
  it("leads with the system prompt and ends with the request", () => {
    const context = buildContext("SYS", [], "hello");
    expect(context).toEqual([
      { role: "system", content: "SYS" },
      { role: "user", content: "hello" },
    ]);
  });

  it("includes session history in order", () => {
    const context = buildContext(
      "SYS",
      [message("user", "my project is Atom AI"), message("assistant", "Understood.")],
      "what is it called?",
    );
    expect(context.map((entry) => entry.content)).toEqual([
      "SYS",
      "my project is Atom AI",
      "Understood.",
      "what is it called?",
    ]);
  });

  it("trims to the trailing window without orphaning pairs", () => {
    const history = [
      message("user", "u1"),
      message("assistant", "a1"),
      message("user", "u2"),
      message("assistant", "a2"),
    ];
    const context = buildContext("SYS", history, "u3", 3);
    // Window of 3 starts with a1 (orphan) → dropped, keeping u2/a2.
    expect(context.map((entry) => entry.content)).toEqual([
      "SYS",
      "u2",
      "a2",
      "u3",
    ]);
  });
});
