import { describe, expect, it } from "vitest";
import { ProviderError, toProviderError } from "@/agent/providers/types";
import { redact } from "@/lib/logger";

describe("toProviderError", () => {
  it("passes ProviderError through untouched", () => {
    const original = new ProviderError("auth", "bad key");
    expect(toProviderError(original)).toBe(original);
  });

  it("maps AbortError to cancelled", () => {
    const error = new DOMException("aborted", "AbortError");
    expect(toProviderError(error).code).toBe("cancelled");
  });

  it("maps missing-key messages to not_configured", () => {
    expect(toProviderError(new Error("missing API key")).code).toBe(
      "not_configured",
    );
  });

  it("maps network failures", () => {
    expect(toProviderError(new Error("fetch failed")).code).toBe("network");
  });

  it("falls back to unknown", () => {
    expect(toProviderError(new Error("weird")).code).toBe("unknown");
    expect(toProviderError("string chaos").code).toBe("unknown");
  });
});

describe("redact", () => {
  it("redacts credential-looking keys and tokens", () => {
    expect(
      redact({ apiKey: "sk-abcdef123456", model: "gpt-4o-mini" }),
    ).toEqual({ apiKey: "[REDACTED]", model: "gpt-4o-mini" });
    expect(redact("Bearer abcdefgh12345678")).toBe("[REDACTED]");
    expect(redact("sk-abcdef1234567890")).toBe("[REDACTED]");
    expect(redact("plain harmless text")).toBe("plain harmless text");
  });
});
