import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from "react";
import type { ReactNode } from "react";
import { MockAgent } from "@/agent/core/MockAgent";
import { createEventBus } from "@/agent/events/eventBus";
import type {
  AgentEvent,
  AgentStatus,
  AgentTask,
} from "@/agent/types/agent";
import { AppError, reportError, toAppError } from "@/lib/errors";
import type { ChatMessage } from "@/types/chat";

/**
 * Centralized assistant store (React context + reducer, no external deps).
 *
 * Owns: agent status, current task, transcript, activity timeline, error.
 * Voice input (Phase 2+) and real agent execution plug into `submitRequest`
 * and `setComposing` without changing this shape.
 */

interface AgentState {
  status: AgentStatus;
  /** True while the user is composing text (drives the `listening` preview). */
  composing: boolean;
  currentTask: AgentTask | null;
  messages: ChatMessage[];
  events: AgentEvent[];
  error: AppError | null;
  /** Monotonic counter for queue position display / debugging. */
  completedTasks: number;
}

type AgentAction =
  | { type: "COMPOSE"; composing: boolean }
  | { type: "TASK_START"; task: AgentTask; message: ChatMessage }
  | { type: "STATUS"; status: AgentStatus }
  | { type: "EVENT"; event: AgentEvent }
  | { type: "TASK_DONE"; reply: ChatMessage }
  | { type: "TASK_ERROR"; error: AppError }
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
};

const MAX_EVENTS = 100;

function reducer(state: AgentState, action: AgentAction): AgentState {
  switch (action.type) {
    case "COMPOSE":
      return { ...state, composing: action.composing };
    case "TASK_START":
      return {
        ...state,
        status: "thinking",
        currentTask: action.task,
        messages: [...state.messages, action.message],
        error: null,
      };
    case "STATUS":
      return { ...state, status: action.status };
    case "EVENT":
      return {
        ...state,
        events: [...state.events, action.event].slice(-MAX_EVENTS),
      };
    case "TASK_DONE":
      return {
        ...state,
        status: "completed",
        currentTask: state.currentTask
          ? { ...state.currentTask, status: "completed", result: action.reply.text }
          : null,
        messages: [...state.messages, action.reply],
        completedTasks: state.completedTasks + 1,
      };
    case "TASK_ERROR":
      return { ...state, status: "error", error: action.error };
    case "ERROR_DISMISS":
      return {
        ...state,
        error: null,
        status: state.status === "error" ? "idle" : state.status,
      };
    case "RESET":
      return { ...initialState, messages: state.messages, events: state.events };
    default:
      return state;
  }
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
  submitRequest: (request: string) => Promise<void>;
  setComposing: (composing: boolean) => void;
  dismissError: () => void;
  resetSession: () => void;
}

const AgentContext = createContext<AgentContextValue | null>(null);

const sharedBus = createEventBus();
const sharedAgent = new MockAgent();

export function AgentProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    return sharedBus.subscribe((event) => {
      dispatch({ type: "EVENT", event });
    });
  }, []);

  const setComposing = useCallback((composing: boolean) => {
    dispatch({ type: "COMPOSE", composing });
  }, []);

  const dismissError = useCallback(() => {
    dispatch({ type: "ERROR_DISMISS" });
  }, []);

  const resetSession = useCallback(() => {
    sharedAgent.cancel();
    dispatch({ type: "RESET" });
  }, []);

  const submitRequest = useCallback(
    async (request: string): Promise<void> => {
      const text = request.trim();
      if (text.length === 0 || sharedAgent.isBusy) {
        return;
      }
      const task: AgentTask = {
        id: createTaskId(),
        request: text,
        createdAt: Date.now(),
        status: "thinking",
      };
      dispatch({
        type: "TASK_START",
        task,
        message: {
          id: `${task.id}-user`,
          role: "user",
          text,
          timestamp: Date.now(),
        },
      });

      try {
        const reply = await sharedAgent.execute(task, {
          onEvent: (input) => {
            sharedBus.emit(input);
          },
          onStatus: (status) => {
            dispatch({ type: "STATUS", status });
          },
        });
        dispatch({
          type: "TASK_DONE",
          reply: {
            id: `${task.id}-assistant`,
            role: "assistant",
            text: reply,
            timestamp: Date.now(),
          },
        });
      } catch (error) {
        // Cancellation returns to idle silently; real failures surface.
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        const appError = toAppError(error, "agent");
        reportError(appError);
        dispatch({ type: "TASK_ERROR", error: appError });
      }
    },
    [],
  );

  const value = useMemo<AgentContextValue>(() => {
    const displayStatus: AgentStatus =
      state.composing &&
      (state.status === "idle" || state.status === "completed")
        ? "listening"
        : state.status;
    return {
      ...state,
      displayStatus,
      canSubmit: !sharedAgent.isBusy,
      submitRequest,
      setComposing,
      dismissError,
      resetSession,
    };
  }, [
    state,
    submitRequest,
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
