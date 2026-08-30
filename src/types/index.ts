export type ProviderName = "mock" | "openai" | "anthropic" | "openrouter" | "ollama" | "gemini";

export interface HealthStatus {
  status: string;
  provider: string;
  provider_healthy: boolean;
  memory_count: number;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatResponse {
  content: string;
  provider: string;
  model: string;
  session_id: string;
}
