/**
 * Structured development logger for the agent pipeline.
 *
 * Rules:
 * - All lines are prefixed with `[FRIDAY]` and a pipeline stage.
 * - NEVER pass secrets, API keys, tokens, or credentials to any function here.
 * - Verbose output is dev-only; production logs warnings/errors only.
 */

export type LogStage =
  | "request"
  | "provider"
  | "engine"
  | "tool"
  | "task"
  | "ui";

const STAGE_LABEL: Record<LogStage, string> = {
  request: "Request received",
  provider: "Provider",
  engine: "Engine",
  tool: "Tool",
  task: "Task",
  ui: "UI",
};

/** Redacts anything that looks like a credential before it can reach a log. */
export function redact(value: unknown): unknown {
  if (typeof value === "string") {
    // Bearer tokens, sk- keys, and long opaque secrets become [REDACTED].
    if (
      /bearer\s+[A-Za-z0-9\-._~+/=]{8,}/i.test(value) ||
      /sk-[A-Za-z0-9]{8,}/.test(value)
    ) {
      return "[REDACTED]";
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(redact);
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      out[key] = /key|token|secret|credential|password|authorization/i.test(key)
        ? "[REDACTED]"
        : redact(entry);
    }
    return out;
  }
  return value;
}

function write(
  level: "info" | "warn" | "error",
  stage: LogStage,
  message: string,
  detail?: unknown,
): void {
  if (!import.meta.env.DEV && level === "info") {
    return;
  }
  const line = `[FRIDAY] ${STAGE_LABEL[stage]} — ${message}`;
  if (level === "error") {
    // eslint-disable-next-line no-console
    console.error(line, detail === undefined ? "" : redact(detail));
  } else if (level === "warn") {
    // eslint-disable-next-line no-console
    console.warn(line, detail === undefined ? "" : redact(detail));
  } else {
    // eslint-disable-next-line no-console
    console.log(line, detail === undefined ? "" : redact(detail));
  }
}

export const logger = {
  info: (stage: LogStage, message: string, detail?: unknown): void =>
    write("info", stage, message, detail),
  warn: (stage: LogStage, message: string, detail?: unknown): void =>
    write("warn", stage, message, detail),
  error: (stage: LogStage, message: string, detail?: unknown): void =>
    write("error", stage, message, detail),
};
