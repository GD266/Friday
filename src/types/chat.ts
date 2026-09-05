/** A single visible chat line in the transcript. */
export interface ChatMessage {
  readonly id: string;
  readonly role: "user" | "assistant";
  readonly text: string;
  readonly timestamp: number;
  /** True while this reply is still streaming in. */
  readonly streaming?: boolean;
}

export type ConnectionState = "online" | "offline" | "web-preview" | "checking";
