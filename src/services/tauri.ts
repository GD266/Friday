import { invoke } from "@tauri-apps/api/core";

/**
 * Secure Tauri bridge — the ONLY place the frontend may call the backend.
 *
 * Security rules:
 * - Only explicitly wrapped, allowlisted commands may be invoked.
 * - No dynamic/arbitrary command names, no raw argument passthrough.
 * - Outside Tauri (plain browser `npm run dev`) every call resolves to a
 *   documented fallback so the UI stays usable during web development.
 */

export interface BackendAppInfo {
  name: string;
  version: string;
  backend: string;
}

/** True when running inside the Tauri webview. */
export function isTauriRuntime(): boolean {
  return (
    typeof window !== "undefined" &&
    "__TAURI_INTERNALS__" in window
  );
}

/** Public provider status reported by the backend (never contains secrets). */
export interface BackendProviderStatus {
  configured: boolean;
  model: string;
  label: string;
}

type AllowlistedCommand =
  | "ping"
  | "get_app_info"
  | "provider_status"
  | "cancel_chat";

async function safeInvoke<T>(
  command: AllowlistedCommand,
  args?: Record<string, unknown>,
): Promise<T | null> {
  if (!isTauriRuntime()) {
    return null;
  }
  try {
    return await invoke<T>(command, args);
  } catch {
    return null;
  }
}

export const tauriService = {
  isAvailable: isTauriRuntime(),

  /** Liveness probe; falls back to "web-preview" outside the desktop shell. */
  async getConnection(): Promise<"online" | "offline" | "web-preview"> {
    if (!isTauriRuntime()) {
      return "web-preview";
    }
    const reply = await safeInvoke<string>("ping");
    return reply === "pong" ? "online" : "offline";
  },

  async getAppInfo(): Promise<BackendAppInfo | null> {
    return safeInvoke<BackendAppInfo>("get_app_info");
  },

  /** Provider configuration WITHOUT secrets; null outside the desktop shell. */
  async getProviderStatus(): Promise<BackendProviderStatus | null> {
    return safeInvoke<BackendProviderStatus>("provider_status");
  },

  /** Best-effort cancellation of an in-flight streamed completion. */
  async cancelChat(requestId: string): Promise<void> {
    await safeInvoke("cancel_chat", { requestId });
  },
};
