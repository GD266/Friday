import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { useAgent } from "@/stores/AgentProvider";

/** Bottom command area: typed messages route to the agent (mock in Phase 1). */
export function CommandInput() {
  const { submitRequest, setComposing, canSubmit } = useAgent();
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const busy = !canSubmit || sending;

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    const text = value.trim();
    if (text.length === 0 || busy) {
      return;
    }
    setValue("");
    setComposing(false);
    setSending(true);
    try {
      await submitRequest(text);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 backdrop-blur-md transition focus-within:border-sky-300/30 focus-within:bg-white/[0.05]">
        <span
          aria-hidden="true"
          className="select-none font-mono text-sm text-zinc-600"
        >
          ›
        </span>
        <label htmlFor="friday-command" className="sr-only">
          Ask FRIDAY
        </label>
        <input
          ref={inputRef}
          id="friday-command"
          type="text"
          value={value}
          autoComplete="off"
          spellCheck={false}
          maxLength={2000}
          placeholder={busy ? "Working…" : "Ask FRIDAY anything…"}
          disabled={busy}
          onChange={(event) => {
            setValue(event.target.value);
            setComposing(event.target.value.trim().length > 0);
          }}
          onFocus={() => {
            if (value.trim().length > 0) {
              setComposing(true);
            }
          }}
          onBlur={() => setComposing(false)}
          className="min-w-0 flex-1 bg-transparent text-[15px] text-zinc-100 placeholder:text-zinc-600 focus:outline-none disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={value.trim().length === 0 || busy}
          className="shrink-0 rounded-lg bg-zinc-100 px-4 py-1.5 text-sm font-medium text-zinc-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-30"
        >
          {busy ? "···" : "Send"}
        </button>
      </div>
      <p className="mt-2 text-center text-[11px] tracking-wide text-zinc-600">
        Phase 1 — typed input only · mock agent · no system access
      </p>
    </form>
  );
}
