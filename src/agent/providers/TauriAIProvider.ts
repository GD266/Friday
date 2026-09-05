import { Channel, invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "@/services/tauri";
import { logger } from "@/lib/logger";
import {
  ProviderError,
  toProviderError,
} from "@/agent/providers/types";
import type {
  AIProvider,
  CompletionCallbacks,
  CompletionResult,
  ProviderInfo,
  ProviderMessage,
} from "@/agent/providers/types";

/**
 * Backend streaming chunk emitted by the Tauri `chat_stream` command.
 * Mirrors the Rust `ChatChunk` enum 1:1.
 */
type ChatChunk =
  | { kind: "delta"; text: string }
  | { kind: "done" }
  | { kind: "failed"; error: string; code: string };

/** Public provider status reported by the backend (never contains secrets). */
export interface BackendProviderStatus {
  configured: boolean;
  model: string;
  label: string;
}

/**
 * Primary Phase 2 provider: the API key lives in the backend process
 * environment (`FRIDAY_API_KEY`) and never enters the frontend bundle.
 * Replies stream through a Tauri `Channel`, delta by delta.
 */
export class TauriAIProvider implements AIProvider {
  private busy = false;
  private cancelled = false;
  private currentRequestId: string | null = null;

  constructor(private providerInfo: ProviderInfo) {}

  get info(): ProviderInfo {
    return this.providerInfo;
  }

  get isBusy(): boolean {
    return this.busy;
  }

  cancel(): void {
    if (!this.busy || this.currentRequestId === null) {
      return;
    }
    this.cancelled = true;
    const requestId = this.currentRequestId;
    logger.info("provider", "Cancellation requested.", { requestId });
    // Best-effort: the backend also polls its own cancellation flag.
    invoke("cancel_chat", { requestId }).catch(() => undefined);
  }

  async complete(
    messages: readonly ProviderMessage[],
    callbacks?: CompletionCallbacks,
  ): Promise<CompletionResult> {
    if (!isTauriRuntime()) {
      throw new ProviderError(
        "unavailable",
        "Desktop backend is not available (web preview).",
      );
    }
    if (this.busy) {
      throw new ProviderError("unknown", "A completion is already running.");
    }
    this.busy = true;
    this.cancelled = false;
    const requestId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `req-${Date.now()}`;
    this.currentRequestId = requestId;

    let text = "";
    let chunks = 0;
    let failed: { error: string; code: string } | null = null;

    try {
      const onChunk = new Channel<ChatChunk>();
      onChunk.onmessage = (chunk) => {
        if (chunk.kind === "delta") {
          text += chunk.text;
          chunks += 1;
          callbacks?.onDelta(chunk.text);
        } else if (chunk.kind === "failed") {
          failed = { error: chunk.error, code: chunk.code };
        }
        // `done` needs no handling: invoke resolves right after.
      };

      await invoke("chat_stream", {
        requestId,
        messages: messages.map((message) => ({ ...message })),
        onChunk,
      });

      if (this.cancelled || callbacks?.isCancelled?.() === true) {
        throw new ProviderError("cancelled", "Request cancelled.");
      }
      if (failed !== null) {
        const { error, code } = failed as { error: string; code: string };
        throw classifiedBackendError(code, error);
      }
      if (text.trim().length === 0) {
        throw new ProviderError(
          "malformed",
          "The provider returned an empty response.",
        );
      }
      logger.info("provider", "Response received.", { chunks });
      return { text, chunks };
    } catch (error) {
      if (
        error instanceof ProviderError ||
        (error instanceof Error &&
          /cancel_chat|__tauri_channel__/i.test(error.message))
      ) {
        throw toProviderError(error);
      }
      throw toProviderError(error);
    } finally {
      this.busy = false;
      this.cancelled = false;
      this.currentRequestId = null;
    }
  }
}

/** Converts backend error codes back into the typed taxonomy. */
function classifiedBackendError(code: string, message: string): ProviderError {
  switch (code) {
    case "not_configured":
      return new ProviderError(
        "not_configured",
        "AI provider is not configured. Set the FRIDAY_API_KEY environment variable and restart FRIDAY.",
      );
    case "auth":
      return new ProviderError(
        "auth",
        "The AI provider rejected the API key. Check FRIDAY_API_KEY.",
      );
    case "timeout":
      return new ProviderError(
        "timeout",
        "The AI provider did not respond in time.",
      );
    case "network":
      return new ProviderError(
        "network",
        "Network failure while contacting the AI provider.",
      );
    case "cancelled":
      return new ProviderError("cancelled", "Request cancelled.");
    case "malformed":
      return new ProviderError(
        "malformed",
        "The AI provider returned an unreadable response.",
      );
    default:
      return new ProviderError(
        "unknown",
        message || "AI provider request failed.",
      );
  }
}

export async function fetchBackendProviderInfo(): Promise<BackendProviderStatus | null> {
  if (!isTauriRuntime()) {
    return null;
  }
  try {
    return await invoke<BackendProviderStatus>("provider_status");
  } catch {
    return null;
  }
}
