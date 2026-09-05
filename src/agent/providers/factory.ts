import { isTauriRuntime } from "@/services/tauri";
import { logger } from "@/lib/logger";
import { DirectProvider } from "@/agent/providers/DirectProvider";
import {
  fetchBackendProviderInfo,
  TauriAIProvider,
} from "@/agent/providers/TauriAIProvider";
import type { AIProvider } from "@/agent/providers/types";

/**
 * Provider selection (no secrets involved — only capability probing):
 * 1. Inside the desktop shell → secure backend provider (key in env).
 * 2. Plain browser dev server with `VITE_FRIDAY_API_KEY` → dev-only direct
 *    provider (refuses production builds).
 * 3. Otherwise → null; the engine surfaces a clear configuration error.
 */
export async function resolveProvider(): Promise<AIProvider | null> {
  if (isTauriRuntime()) {
    const status = await fetchBackendProviderInfo();
    const model = status?.model ?? "unknown-model";
    logger.info("provider", "Backend provider selected.", {
      model,
      configured: status?.configured ?? false,
    });
    return new TauriAIProvider({
      id: "tauri-openai-compatible",
      label: status?.label ?? "OpenAI-compatible",
      model,
      configured: status?.configured ?? false,
    });
  }
  if (
    !import.meta.env.PROD &&
    typeof import.meta.env.VITE_FRIDAY_API_KEY === "string" &&
    (import.meta.env.VITE_FRIDAY_API_KEY as string).length > 0
  ) {
    const model =
      (import.meta.env.VITE_FRIDAY_MODEL as string | undefined) ??
      "gpt-4o-mini";
    return new DirectProvider({
      id: "direct-dev",
      label: "Direct (dev only)",
      model,
      configured: true,
    });
  }
  return null;
}
