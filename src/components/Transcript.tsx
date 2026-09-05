import { useEffect, useRef } from "react";
import { useAgent } from "@/stores/AgentProvider";

/** Transcript of user requests and assistant replies, newest at the bottom. */
export function Transcript() {
  const { messages } = useAgent();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = scrollRef.current;
    if (node) {
      node.scrollTop = node.scrollHeight;
    }
  }, [messages.length]);

  if (messages.length === 0) {
    return null;
  }

  return (
    <div
      ref={scrollRef}
      aria-label="Conversation"
      className="slim-scroll max-h-52 w-full overflow-y-auto"
    >
      <ol className="flex flex-col gap-3">
        {messages.map((message) => (
          <li
            key={message.id}
            className={`anim-rise flex ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={
                message.role === "user"
                  ? "max-w-[85%] rounded-xl rounded-br-sm border border-white/10 bg-white/[0.06] px-4 py-2.5 text-sm leading-relaxed text-zinc-100"
                  : "max-w-[85%] rounded-xl rounded-bl-sm border border-white/[0.07] bg-white/[0.02] px-4 py-2.5 text-sm leading-relaxed text-zinc-300"
              }
            >
              {message.role === "assistant" ? (
                <p className="mb-1 text-[10px] font-semibold tracking-[0.2em] text-zinc-500">
                  FRIDAY
                </p>
              ) : null}
              <p className="break-words">{message.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
