/**
 * Backend API client — talks to the Python FastAPI server.
 * Base URL is configurable via VITE_FRIDAY_API_URL (defaults to http://127.0.0.1:8000).
 */

import type { ChatResponse, HealthStatus } from "../types";

const API_URL = import.meta.env.VITE_FRIDAY_API_URL ?? "http://127.0.0.1:8000";

export async function fetchHealth(): Promise<HealthStatus> {
  const res = await fetch(`${API_URL}/health`);
  if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
  return res.json() as Promise<HealthStatus>;
}

export async function sendChat(message: string, sessionId = "default"): Promise<ChatResponse> {
  const res = await fetch(`${API_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, session_id: sessionId }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Chat failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<ChatResponse>;
}

export function getApiUrl(): string {
  return API_URL;
}
