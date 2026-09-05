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
 * DEV-ONLY fallback provider: calls an OpenAI-compatible endpoint directly
 * from the browser so `npm run dev` can exercise the real AI path without
 * the desktop shell.
 *
 * Guardrails (non-negotiable):
 * - Refuses to run in production builds (`import.meta.env.PROD`).
 * - Key comes ONLY from `VITE_FRIDAY_API_KEY`; never from source code.
 * - Loud console warning on every use so nobody mistakes it for the secure path.
 *
 * The supported path is ALWAYS the Tauri backend provider, where the key
 * stays in process environment and out of the bundle.
 */
export class DirectProvider implements AIProvider {
  private busy = false;
  private controller: AbortController | null = null;

  constructor(private providerInfo: ProviderInfo) {}

  get info(): ProviderInfo {
    return this.providerInfo;
  }

  get isBusy(): boolean {
    return this.busy;
  }

  cancel(): void {
    this.controller?.abort();
  }

  async complete(
    messages: readonly ProviderMessage[],
    callbacks?: CompletionCallbacks,
  ): Promise<CompletionResult> {
    if (import.meta.env.PROD) {
      throw new ProviderError(
        "unavailable",
        "Direct browser provider is disabled in production. Use the FRIDAY desktop app.",
      );
    }
    const apiKey = import.meta.env.VITE_FRIDAY_API_KEY as string | undefined;
    const baseUrl = (
      (import.meta.env.VITE_FRIDAY_API_BASE as string | undefined) ??
      "https://api.openai.com/v1"
    ).replace(/\/+$/, "");
    const model =
      (import.meta.env.VITE_FRIDAY_MODEL as string | undefined) ??
      "gpt-4o-mini";

    if (!apiKey || apiKey.length === 0) {
      throw new ProviderError(
        "not_configured",
        "AI provider is not configured. Set VITE_FRIDAY_API_KEY in a local .env file (dev only) or FRIDAY_API_KEY for the desktop app.",
      );
    }
    if (this.busy) {
      throw new ProviderError("unknown", "A completion is already running.");
    }

    logger.warn(
      "provider",
      "Using DEV-ONLY direct browser provider. Keys in dev bundles are visible — prefer the desktop app.",
    );
    this.busy = true;
    const controller = new AbortController();
    this.controller = controller;

    try {
      // Single request; the key is attached here and never logged anywhere.
      const live = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          stream: true,
          messages: messages.map((message) => ({ ...message })),
        }),
      });
      if (live.status === 401 || live.status === 403) {
        throw new ProviderError(
          "auth",
          "The AI provider rejected the API key. Check VITE_FRIDAY_API_KEY.",
        );
      }
      if (!live.ok || live.body === null) {
        throw new ProviderError(
          "unknown",
          `Provider request failed (HTTP ${live.status}).`,
        );
      }
      const { text, chunks } = await readSseStream(
        live.body,
        controller.signal,
        callbacks,
      );
      if (text.trim().length === 0) {
        throw new ProviderError(
          "malformed",
          "The provider returned an empty response.",
        );
      }
      return { text, chunks };
    } catch (error) {
      throw toProviderError(error);
    } finally {
      if (this.controller === controller) {
        this.controller = null;
      }
      this.busy = false;
    }
  }
}

/** Minimal SSE reader for OpenAI-compatible `data:` streams. */
async function readSseStream(
  body: ReadableStream<Uint8Array>,
  signal: AbortSignal,
  callbacks?: CompletionCallbacks,
): Promise<{ text: string; chunks: number }> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let chunks = 0;

  for (;;) {
    if (signal.aborted || callbacks?.isCancelled?.() === true) {
      await reader.cancel().catch(() => undefined);
      throw new ProviderError("cancelled", "Request cancelled.");
    }
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) {
        continue;
      }
      const payload = trimmed.slice("data:".length).trim();
      if (payload === "[DONE]") {
        continue;
      }
      try {
        const json = JSON.parse(payload) as {
          choices?: Array<{ delta?: { content?: string } }>;
        };
        const delta = json.choices?.[0]?.delta?.content ?? "";
        if (delta.length > 0) {
          text += delta;
          chunks += 1;
          callbacks?.onDelta(delta);
        }
      } catch {
        // Malformed SSE line — skip rather than failing the whole stream.
      }
    }
  }
  return { text, chunks };
}
