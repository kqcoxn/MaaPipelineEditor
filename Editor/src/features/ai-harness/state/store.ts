import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import {
  DEFAULT_SESSION_TITLE,
  MAX_EVENTS_PER_RUN,
  MAX_MESSAGES_PER_SESSION,
  MAX_RUNS_PER_SESSION,
} from "./constants";
import type {
  HarnessRun,
  HarnessRunStatus,
  HarnessSession,
  HarnessSessionMessage,
  RunEvent,
} from "../core/types";

interface AIHarnessState {
  sessions: HarnessSession[];
  activeSessionId: string;
  runs: Record<string, HarnessRun>;
  events: Record<string, RunEvent[]>;
  activeRunId: string | null;
  pendingRunSessionId: string | null;
  streamingText: string;
  streamingReasoning: string;
}

interface AIHarnessActions {
  createSession: (title?: string) => string;
  switchSession: (sessionId: string) => boolean;
  clearSession: (sessionId?: string) => boolean;
  deleteSession: (sessionId: string) => boolean;
  addRun: (run: HarnessRun) => void;
  tryReserveRun: (sessionId: string) => boolean;
  releaseRunReservation: (sessionId: string) => void;
  updateRun: (runId: string, patch: Partial<HarnessRun>) => void;
  appendEvent: (event: RunEvent) => void;
  appendMessage: (sessionId: string, message: HarnessSessionMessage) => void;
  setSessionContextSummary: (sessionId: string, contextSummary: string) => boolean;
  replaceSessionContext: (
    sessionId: string,
    messages: HarnessSessionMessage[],
    contextSummary: string,
  ) => boolean;
  setStreamingText: (text: string) => void;
  appendStreamingText: (delta: string) => void;
  setStreamingReasoning: (text: string) => void;
  appendStreamingReasoning: (delta: string) => void;
  cancelRun: (runId: string, status?: HarnessRunStatus) => void;
  reset: () => void;
}

export type AIHarnessStore = AIHarnessState & AIHarnessActions;

let sequence = 0;
function createId(prefix: string): string {
  sequence += 1;
  return `${prefix}_${Date.now()}_${sequence}`;
}

function createSessionData(title = DEFAULT_SESSION_TITLE): HarnessSession {
  const timestamp = Date.now();
  return {
    id: createId("session"),
    title: title.trim() || DEFAULT_SESSION_TITLE,
    createdAt: timestamp,
    updatedAt: timestamp,
    runIds: [],
    messages: [],
  };
}

const initialSession = createSessionData();
const createInitialState = (): AIHarnessState => ({
  sessions: [initialSession],
  activeSessionId: initialSession.id,
  runs: {},
  events: {},
  activeRunId: null,
  pendingRunSessionId: null,
  streamingText: "",
  streamingReasoning: "",
});

export const useAIHarnessStore = create<AIHarnessStore>()(
  subscribeWithSelector((set, get) => ({
    ...createInitialState(),

    createSession(title) {
      const session = createSessionData(title);
      set((state) => ({
        sessions: [session, ...state.sessions],
        activeSessionId: session.id,
      }));
      return session.id;
    },

    switchSession(sessionId) {
      if (!get().sessions.some((session) => session.id === sessionId)) {
        return false;
      }
      set({
        activeSessionId: sessionId,
        streamingText: "",
        streamingReasoning: "",
      });
      return true;
    },

    clearSession(sessionId = get().activeSessionId) {
      const session = get().sessions.find((item) => item.id === sessionId);
      if (!session) return false;
      if (get().pendingRunSessionId === sessionId) return false;
      if (
        session.runIds.some((runId) =>
          ["queued", "running", "waiting_tool"].includes(
            get().runs[runId]?.status ?? "",
          ),
        )
      ) {
        return false;
      }
      const runIds = new Set(session.runIds);
      set((state) => ({
        sessions: state.sessions.map((item) =>
          item.id === sessionId
            ? {
                ...item,
                runIds: [],
                messages: [],
                contextSummary: undefined,
                updatedAt: Date.now(),
              }
            : item,
        ),
        runs: Object.fromEntries(
          Object.entries(state.runs).filter(([id]) => !runIds.has(id)),
        ),
        events: Object.fromEntries(
          Object.entries(state.events).filter(([id]) => !runIds.has(id)),
        ),
        activeRunId: runIds.has(state.activeRunId ?? "")
          ? null
          : state.activeRunId,
        streamingText: runIds.has(state.activeRunId ?? "")
          ? ""
          : state.streamingText,
        streamingReasoning: runIds.has(state.activeRunId ?? "")
          ? ""
          : state.streamingReasoning,
      }));
      return true;
    },

    deleteSession(sessionId) {
      const state = get();
      if (state.sessions.length <= 1) return false;
      const session = state.sessions.find((item) => item.id === sessionId);
      if (!session) return false;
      if (state.pendingRunSessionId === sessionId) return false;
      if (
        session.runIds.some((runId) =>
          ["queued", "running", "waiting_tool"].includes(
            state.runs[runId]?.status ?? "",
          ),
        )
      ) {
        return false;
      }
      const runIds = new Set(session.runIds);
      const sessions = state.sessions.filter((item) => item.id !== sessionId);
      set({
        sessions,
        activeSessionId:
          state.activeSessionId === sessionId
            ? sessions[0].id
            : state.activeSessionId,
        runs: Object.fromEntries(
          Object.entries(state.runs).filter(([id]) => !runIds.has(id)),
        ),
        events: Object.fromEntries(
          Object.entries(state.events).filter(([id]) => !runIds.has(id)),
        ),
        activeRunId: runIds.has(state.activeRunId ?? "")
          ? null
          : state.activeRunId,
        streamingText: runIds.has(state.activeRunId ?? "")
          ? ""
          : state.streamingText,
        streamingReasoning: runIds.has(state.activeRunId ?? "")
          ? ""
          : state.streamingReasoning,
      });
      return true;
    },

    addRun(run) {
      set((state) => {
        const session = state.sessions.find((item) => item.id === run.sessionId);
        if (!session) throw new Error(`Session 不存在: ${run.sessionId}`);
        const runIds = [...session.runIds, run.id];
        const evictedRunIds = runIds.slice(0, -MAX_RUNS_PER_SESSION);
        const keptRunIds = runIds.slice(-MAX_RUNS_PER_SESSION);
        const runs = { ...state.runs, [run.id]: run };
        const events = { ...state.events, [run.id]: [] };
        evictedRunIds.forEach((id) => {
          delete runs[id];
          delete events[id];
        });
        return {
          sessions: state.sessions.map((item) =>
            item.id === run.sessionId
              ? { ...item, runIds: keptRunIds, updatedAt: Date.now() }
              : item,
          ),
          runs,
          events,
          activeRunId: run.id,
          pendingRunSessionId: null,
          streamingText: "",
          streamingReasoning: "",
        };
      });
    },

    tryReserveRun(sessionId) {
      let reserved = false;
      set((state) => {
        if (
          state.pendingRunSessionId ||
          !state.sessions.some((session) => session.id === sessionId)
        ) {
          return {};
        }
        const activeStatus = state.activeRunId
          ? state.runs[state.activeRunId]?.status
          : undefined;
        if (
          activeStatus &&
          ["queued", "running", "waiting_tool"].includes(activeStatus)
        ) {
          return {};
        }
        reserved = true;
        return { pendingRunSessionId: sessionId };
      });
      return reserved;
    },

    releaseRunReservation(sessionId) {
      set((state) =>
        state.pendingRunSessionId === sessionId
          ? { pendingRunSessionId: null }
          : {},
      );
    },

    updateRun(runId, patch) {
      set((state) => {
        const run = state.runs[runId];
        return run
          ? { runs: { ...state.runs, [runId]: { ...run, ...patch } } }
          : {};
      });
    },

    appendEvent(event) {
      set((state) => ({
        events: {
          ...state.events,
          [event.runId]: [
            ...(state.events[event.runId] ?? []),
            event,
          ].slice(-MAX_EVENTS_PER_RUN),
        },
      }));
    },

    appendMessage(sessionId, message) {
      set((state) => ({
        sessions: state.sessions.map((session) => {
          if (session.id !== sessionId) return session;
          const title =
            session.title === DEFAULT_SESSION_TITLE && message.role === "user"
              ? message.content.trim().slice(0, 32) || DEFAULT_SESSION_TITLE
              : session.title;
          return {
            ...session,
            title,
            updatedAt: Date.now(),
            messages: [...session.messages, message].slice(
              -MAX_MESSAGES_PER_SESSION,
            ),
          };
        }),
      }));
    },

    setSessionContextSummary(sessionId, contextSummary) {
      let updated = false;
      set((state) => ({
        sessions: state.sessions.map((session) => {
          if (session.id !== sessionId) return session;
          updated = true;
          return {
            ...session,
            contextSummary: contextSummary.trim() || undefined,
            updatedAt: Date.now(),
          };
        }),
      }));
      return updated;
    },

    replaceSessionContext(sessionId, messages, contextSummary) {
      let replaced = false;
      set((state) => ({
        sessions: state.sessions.map((session) => {
          if (session.id !== sessionId) return session;
          replaced = true;
          return {
            ...session,
            messages: messages.slice(-MAX_MESSAGES_PER_SESSION),
            contextSummary: contextSummary.trim() || undefined,
            updatedAt: Date.now(),
          };
        }),
      }));
      return replaced;
    },

    setStreamingText(streamingText) {
      set({ streamingText });
    },

    appendStreamingText(delta) {
      set((state) => ({ streamingText: state.streamingText + delta }));
    },

    setStreamingReasoning(streamingReasoning) {
      set({ streamingReasoning });
    },

    appendStreamingReasoning(delta) {
      set((state) => ({
        streamingReasoning: state.streamingReasoning + delta,
      }));
    },

    cancelRun(runId, status = "cancelled") {
      const run = get().runs[runId];
      if (!run || !["queued", "running", "waiting_tool"].includes(run.status)) {
        return;
      }
      get().updateRun(runId, { status, finishedAt: Date.now() });
      set((state) => ({
        activeRunId: state.activeRunId === runId ? null : state.activeRunId,
      }));
    },

    reset() {
      const session = createSessionData();
      set({
        sessions: [session],
        activeSessionId: session.id,
        runs: {},
        events: {},
        activeRunId: null,
        pendingRunSessionId: null,
        streamingText: "",
        streamingReasoning: "",
      });
    },
  })),
);
