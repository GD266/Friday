/**
 * Centralized error model.
 *
 * Rules:
 * - Errors never crash the UI: components render `AppError`s via ErrorBanner.
 * - Agent failures are mirrored into agent state (`status: "error"`).
 * - Nothing is silently swallowed: every catch converts to AppError and logs
 *   in development.
 */

export type ErrorSource = "agent" | "tauri" | "ui" | "unknown";

export class AppError extends Error {
  readonly source: ErrorSource;
  readonly causeDetail?: string;

  constructor(message: string, source: ErrorSource = "unknown", cause?: unknown) {
    super(message, cause instanceof Error ? { cause } : undefined);
    this.name = "AppError";
    this.source = source;
    this.causeDetail =
      cause instanceof Error
        ? cause.stack ?? cause.message
        : cause === undefined
          ? undefined
          : String(cause);
  }
}

export function toAppError(error: unknown, source: ErrorSource = "unknown"): AppError {
  if (error instanceof AppError) {
    return error;
  }
  if (error instanceof Error) {
    return new AppError(error.message, source, error);
  }
  return new AppError("An unexpected error occurred.", source, error);
}

/** Development-only logging; keeps production console clean. */
export function reportError(error: AppError): void {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.error(`[FRIDAY:${error.source}] ${error.message}`, error);
  }
}
