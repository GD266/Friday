import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from "react";
import type { ReactNode } from "react";
import { AgentEngine } from "@/agent/engine/AgentEngine";
import { createEventBus } from "@/agent/events/eventBus";
import { resolveProvider } from "@/agent/providers/factory";
import { ProviderError } from "@/agent/providers/types";
import type {
  AgentEvent,
  AgentStatus,
  AgentTask,
} from "@/agent/types/agent";
import { AppError, reportError, toAppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import type { ChatMessage } from "@/types/chat";

/**
 * Centralized assistant store (React context + reducer, no external deps).
 *
 * Phase 2: owns the AgentEngine (real AI), streams reply deltas into a
 * pending transcript message, and exposes cancellation. Voice input (Phase 3+)
 * still plugs into `submitRequest` / `setComposing` without changing shape.
 */

interface ProviderSnapshot {
  label: string;
  model: string;
  /** null = not yet probed; false = missing key / unavailable. */
  configured: boolean | null;
}

interface AgentState {
  status: AgentStatus;
  /** True while the user is composing text (drives the `listening` preview). */
  composing: boolean;
  currentTask: AgentTask | null;
  messages: ChatMessage[];
  events: AgentEvent[];
  error: AppError | null;
  completedTasks: number;
  provider: ProviderSnapshot;
}

type AgentAction =
  | { type: "COMPOSE"; composing: boolean }
  | { type: "PROVIDER"; provider: ProviderSnapshot }
  | { type: "TASK_START"; task: AgentTask; userMessage: ChatMessage; pending: ChatMessage }
  | { type: "STATUS"; status: AgentStatus }
  | { type: "EVENT"; event: AgentEvent }
  | { type: "STREAM_DELTA"; id: string; delta: string }
  | { type: "TASK_DONE"; id: string; text: string }
  | { type: "TASK_CANCELLED"; id: string }
  | { type: "TASK_ERROR"; id: string; error: AppError }
  | { type: "ERROR_DISMISS" }
  | { type: "RESET" };

const initialState: AgentState = {
  status: "idle",
  composing: false,
  currentTask: null,
  messages: [],
  events: [],
  error: null,
  completedTasks: 0,
  provider: { label: "AI", model: "…", configured: null },
};

const MAX_EVENTS = 100;

function appendDelta(messages: ChatMessage[], id: string, delta: string): ChatMessage[] {
  return messages.map((message) =>
    message.id === id
      ? { ...message, text: message.text + delta }
      : message,
  );
}

function finalize(
  messages: ChatMessage[],
  id: string,
  text: string,
): ChatMessage[] {
  return messages.map((message) =>
    message.id === id
      ? { ...message, text, streaming: false }
      : message,
  );
}

function reducer(state: AgentState, action: AgentAction): AgentState {
  switch (action.type) {
    case "COMPOSE":
      return { ...state, composing: action.composing };
    case "PROVIDER":
      return { ...state, provider: action.provider };
    case "TASK_START":
      return {
        ...state,
        status: "thinking",
        currentTask: action.task,
        messages: [...state.messages, action.userMessage, action.pending],
        error: null,
      };
    case "STATUS":
      return { ...state, status: action.status };
    case "EVENT":
      return {
        ...state,
        events: [...state.events, action.event].slice(-MAX_EVENTS),
      };
    case "STREAM_DELTA":
      return { ...state, messages: appendDelta(state.messages, action.id, action.delta) };
    case "TASK_DONE":
      return {
        ...state,
        status: "completed",
        currentTask: state.currentTask
          ? { ...state.currentTask, status: "completed", result: action.text }
          : null,
        messages: finalize(state.messages, action.id, action.text),
        completedTasks: state.completedTasks + 1,
      };
    case "TASK_CANCELLED":
      return {
        ...state,
        status: "cancelled",
        currentTask: state.currentTask
          ? { ...state.currentTask, status: "cancelled" }
          : null,
        messages: finalize(state.messages, action.id, cancelNote(state.messages, action.id)),
      };
    case "TASK_ERROR": {
      const failed = state.messages.find((message) => message.id === action.id);
      const partial = (failed?.text ?? "").trim();
      return {
        ...state,
        status: "error",
        error: action.error,
        messages:
          partial.length > 0
            ? finalize(
                state.messages,
                action.id,
                `${partial}\n\n_Response interrupted: ${action.error.message}_`,
              )
            : state.messages.filter((message) => message.id !== action.id),
      };
    }
    case "ERROR_DISMISS":
      return {
        ...state,
        error: null,
        status: state.status === "error" ? "idle" : state.status,
      };
    case "RESET":
      return { ...initialState, messages: state.messages, events: state.events, provider: state.provider };
    default:
      return state;
  }
}

/** Keeps whatever streamed before cancellation, labelled honestly. */
function cancelNote(messages: ChatMessage[], id: string): string {
  const pending = messages.find((message) => message.id === id);
  const partial = (pending?.text ?? "").trim();
  return partial.length > 0 ? `${partial}\n\n_Request cancelled._` : "_Request cancelled._";
}

function createTaskId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `task-${Date.now()}`;
}

interface AgentContextValue extends AgentState {
  /** Effective status shown in the UI (composing previews `listening`). */
  displayStatus: AgentStatus;
  canSubmit: boolean;
  canCancel: boolean;
  submitRequest: (request: string) => Promise<void>;
  cancelRequest: () => void;
  setComposing: (composing: boolean) => void;
  dismissError: () => void;
  resetSession: () => void;
}

const AgentContext = createContext<AgentContextValue | null>(null);

const sharedBus = createEventBus();
const sharedEngine = new AgentEngine(null);

export function AgentProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    return sharedBus.subscribe((event) => {
      dispatch({ type: "EVENT", event });
    });
  }, []);

  // Resolve the AI provider once (backend key probe, no secrets involved).
  useEffect(() => {
    let mounted = true;
    resolveProvider()
      .then((provider) => {
        if (!mounted) {
          return;
        }
        if (provider === null) {
          dispatch({
            type: "PROVIDER",
            provider: { label: "AI", model: "unavailable", configured: false },
          });
          return;
        }
        sharedEngine.setProvider(provider);
        dispatch({
          type: "PROVIDER",
          provider: {
            label: provider.info.label,
            model: provider.info.model,
            configured: provider.info.configured,
          },
        });
      })
      .catch((error: unknown) => {
        if (mounted) {
          logger.error("ui", "Provider resolution failed.", { error });
          dispatch({
            type: "PROVIDER",
            provider: { label: "AI", model: "unavailable", configured: false },
          });
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  const setComposing = useCallback((composing: boolean) => {
    dispatch({ type: "COMPOSE", composing });
  }, []);

  const dismissError = useCallback(() => {
    dispatch({ type: "ERROR_DISMISS" });
  }, []);

  const resetSession = useCallback(() => {
    sharedEngine.cancel();
    dispatch({ type: "RESET" });
  }, []);

  const cancelRequest = useCallback(() => {
    sharedEngine.cancel();
  }, []);

  const submitRequest = useCallback(
    async (request: string): Promise<void> => {
      const text = request.trim();
      if (text.length === 0 || sharedEngine.isBusy) {
        return;
      }
      const task: AgentTask = {
        id: createTaskId(),
        request: text,
        createdAt: Date.now(),
        status: "thinking",
      };
      const pendingId = `${task.id}-assistant`;
      dispatch({
        type: "TASK_START",
        task,
        userMessage: {
          id: `${task.id}-user`,
          role: "user",
          text,
          timestamp: Date.now(),
        },
        pending: {
          id: pendingId,
          role: "assistant",
          text: "",
          timestamp: Date.now(),
          streaming: true,
        },
      });

      try {
        const reply = await sharedEngine.execute(task, {
          onEvent: (input) => {
            sharedBus.emit(input);
          },
          onStatus: (status) => {
            dispatch({ type: "STATUS", status });
          },
          onDelta: (delta) => {
            dispatch({ type: "STREAM_DELTA", id: pendingId, delta });
          },
        });
        dispatch({ type: "TASK_DONE", id: pendingId, text: reply });
      } catch (error) {
        if (error instanceof ProviderError && error.code === "cancelled") {
          dispatch({ type: "TASK_CANCELLED", id: pendingId });
          return;
        }
        const appError = toAppError(error, "agent");
        reportError(appError);
        dispatch({ type: "TASK_ERROR", id: pendingId, error: appError });
      }
    },
    [],
  );

  const value = useMemo<AgentContextValue>(() => {
    const restState =
      state.status === "idle" ||
      state.status === "completed" ||
      state.status === "cancelled";
    const displayStatus: AgentStatus =
      state.composing && restState ? "listening" : state.status;
    return {
      ...state,
      displayStatus,
      canSubmit: !sharedEngine.isBusy,
      canCancel: sharedEngine.isBusy,
      submitRequest,
      cancelRequest,
      setComposing,
      dismissError,
      resetSession,
    };
  }, [
    state,
    submitRequest,
    cancelRequest,
    setComposing,
    dismissError,
    resetSession,
  ]);

  return <AgentContext.Provider value={value}>{children}</AgentContext.Provider>;
}

export function useAgent(): AgentContextValue {
  const context = useContext(AgentContext);
  if (context === null) {
    throw new Error("useAgent must be used inside <AgentProvider>.");
  }
  return context;
}
