/** A single visible chat line in the transcript. */
export interface ChatMessage {
  readonly id: string;
  readonly role: "user" | "assistant";
  readonly text: string;
  readonly timestamp: number;
}

export type ConnectionState = "online" | "offline" | "web-preview" | "checking";
