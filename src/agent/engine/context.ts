import type { ProviderMessage } from "@/agent/providers/types";
import type { ChatMessage } from "@/types/chat";

/**
 * Session-scoped conversation context (Phase 2: short-term memory only).
 *
 * - History lives in the engine for the current session; nothing persists.
 * - No vector database, no embeddings — a bounded sliding window.
 * - The system prompt always leads; the most recent exchanges are kept whole
 *   (never split a user/assistant pair when trimming).
 */

export const MAX_HISTORY_MESSAGES = 20;

export function toProviderMessage(message: ChatMessage): ProviderMessage {
  return { role: message.role, content: message.text };
}

/**
 * Builds the provider message list: system prompt, then the trailing window
 * of session history, then the new user request.
 */
export function buildContext(
  systemPrompt: string,
  history: readonly ChatMessage[],
  request: string,
  maxHistoryMessages: number = MAX_HISTORY_MESSAGES,
): ProviderMessage[] {
  const window = history.slice(-Math.max(0, maxHistoryMessages));
  // Never orphan an assistant message: if the window starts mid-pair, drop it.
  const trimmed =
    window.length > 0 && window[0]?.role === "assistant"
      ? window.slice(1)
      : window;
  return [
    { role: "system", content: systemPrompt },
    ...trimmed.map(toProviderMessage),
    { role: "user", content: request },
  ];
}
