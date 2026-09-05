import { Component } from "react";
import type { ReactNode } from "react";
import { AppError, reportError, toAppError } from "@/lib/errors";

interface Props {
  children: ReactNode;
}

interface State {
  error: AppError | null;
}

/**
 * Last-resort crash guard: isolates render failures to a recovery card
 * instead of blank-screening the desktop window.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    const appError = toAppError(error, "ui");
    reportError(appError);
    return { error: appError };
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="flex h-full items-center justify-center bg-zinc-950 p-6">
          <div className="anim-rise w-full max-w-md rounded-xl border border-white/10 bg-white/[0.03] p-6 text-center">
            <p className="text-xs font-medium tracking-[0.2em] text-zinc-500">
              FRIDAY
            </p>
            <h1 className="mt-2 text-lg font-semibold text-zinc-100">
              Something went wrong
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              {this.state.error.message}
            </p>
            <button
              type="button"
              onClick={this.handleReload}
              className="mt-5 rounded-lg border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-medium text-zinc-100 transition hover:bg-white/[0.1]"
            >
              Reload interface
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
