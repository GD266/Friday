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

async function safeInvoke<T>(command: "ping" | "get_app_info"): Promise<T | null> {
  if (!isTauriRuntime()) {
    return null;
  }
  try {
    return await invoke<T>(command);
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
};
