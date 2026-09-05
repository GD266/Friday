/**
 * AI provider abstraction (Phase 2).
 *
 * FRIDAY is never coupled to a single model vendor. Every provider — OpenAI,
 * Anthropic, Google, local models, any OpenAI-compatible endpoint — implements
 * this interface. The AgentEngine only ever talks to `AIProvider`.
 */

/** A single message in provider (chronological) order. */
export interface ProviderMessage {
  readonly role: "system" | "user" | "assistant";
  readonly content: string;
}

/** Public, non-secret provider configuration surfaced to the UI. */
export interface ProviderInfo {
  /** Stable id, e.g. `"tauri-openai-compatible"`, `"direct-dev"`. */
  readonly id: string;
  /** Human-readable label, e.g. `"OpenAI-compatible"`. */
  readonly label: string;
  /** Model in use, e.g. `"gpt-4o-mini"`. Never includes credentials. */
  readonly model: string;
  /** True when the backend reports a usable API key. */
  readonly configured: boolean;
}

/** Machine-readable provider failure taxonomy for the engine/UI. */
export type ProviderErrorCode =
  | "not_configured"
  | "unavailable"
  | "network"
  | "auth"
  | "timeout"
  | "malformed"
  | "cancelled"
  | "unknown";

export class ProviderError extends Error {
  readonly code: ProviderErrorCode;

  constructor(code: ProviderErrorCode, message: string, cause?: unknown) {
    super(message, cause instanceof Error ? { cause } : undefined);
    this.name = "ProviderError";
    this.code = code;
  }
}

/** Streaming callbacks for one completion call. */
export interface CompletionCallbacks {
  /** Invoked for every content delta, in order. */
  onDelta: (text: string) => void;
  /** Cooperative cancellation probe; return true to abort promptly. */
  isCancelled?: () => boolean;
}

export interface CompletionResult {
  /** Full assembled reply text. */
  readonly text: string;
  /** Number of deltas received (0 for non-streaming completions). */
  readonly chunks: number;
}

export interface AIProvider {
  readonly info: ProviderInfo;
  /** True while a completion is in flight. */
  readonly isBusy: boolean;
  complete: (
    messages: readonly ProviderMessage[],
    callbacks?: CompletionCallbacks,
  ) => Promise<CompletionResult>;
  cancel: () => void;
}

/**
 * Maps arbitrary failures to the ProviderError taxonomy. Local pre-flight
 * problems (missing key, no runtime) are classified without network access.
 */
export function toProviderError(error: unknown): ProviderError {
  if (error instanceof ProviderError) {
    return error;
  }
  if (error instanceof DOMException && error.name === "AbortError") {
    return new ProviderError("cancelled", "Request cancelled.", error);
  }
  if (error instanceof Error) {
    const text = error.message.toLowerCase();
    if (
      text.includes("api key") ||
      text.includes("not configured") ||
      text.includes("missing")
    ) {
      return new ProviderError("not_configured", error.message, error);
    }
    if (text.includes("fetch failed") || text.includes("network")) {
      return new ProviderError(
        "network",
        "Network failure while contacting the AI provider.",
        error,
      );
    }
    if (text.includes("timed out") || text.includes("timeout")) {
      return new ProviderError(
        "timeout",
        "The AI provider did not respond in time.",
        error,
      );
    }
    return new ProviderError("unknown", error.message, error);
  }
  return new ProviderError("unknown", "Unexpected provider failure.", error);
}
