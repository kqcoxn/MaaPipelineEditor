import { create } from "zustand";
import {
  reduceDebugTrace,
  reduceDebugTraceForReplay,
  type DebugTraceSummary,
} from "../features/debug/traceReducer";
import type {
  DebugEvent,
  DebugPerformanceSummary,
  DebugTraceReplayStatus,
} from "../features/debug/types";

interface DebugTraceState {
  events: DebugEvent[];
  eventIndex: Record<string, DebugEvent>;
  summary: DebugTraceSummary;
  liveSummary: DebugTraceSummary;
  replayStatus?: DebugTraceReplayStatus;
  performanceSummary?: DebugPerformanceSummary;
  appendEvent: (event: DebugEvent) => void;
  applyTraceSnapshot: (events: DebugEvent[]) => void;
  setTraceReplayStatus: (status: DebugTraceReplayStatus) => void;
  stopTraceReplay: () => void;
  setPerformanceSummary: (summary: DebugPerformanceSummary) => void;
  resetTrace: (sessionId?: string) => void;
}

function eventKey(event: DebugEvent): string {
  return `${event.sessionId}:${event.runId}:${event.seq}`;
}

export const useDebugTraceStore = create<DebugTraceState>((set, get) => ({
  events: [],
  eventIndex: {},
  summary: reduceDebugTrace({ events: [] }),
  liveSummary: reduceDebugTrace({ events: [] }),

  appendEvent: (event) => {
    const key = eventKey(event);
    if (get().eventIndex[key]) return;

    set((state) => {
      const events = [...state.events, event].sort((a, b) => a.seq - b.seq);
      const liveSummary = reduceDebugTrace({ events });
      const summary = state.replayStatus?.active
        ? reduceDebugTraceForReplay(
            { events },
            {
              active: true,
              cursorSeq: state.replayStatus.cursorSeq,
              runId: state.replayStatus.runId,
              nodeId: state.replayStatus.nodeId,
            },
          )
        : liveSummary;
      return {
        events,
        eventIndex: {
          ...state.eventIndex,
          [key]: event,
        },
        summary,
        liveSummary,
      };
    });
  },

  applyTraceSnapshot: (events) =>
    set((state) => {
      const sorted = [...events].sort((a, b) => a.seq - b.seq);
      const eventIndex = Object.fromEntries(
        sorted.map((event) => [eventKey(event), event]),
      );
      const liveSummary = reduceDebugTrace({ events: sorted });
      const summary = state.replayStatus?.active
        ? reduceDebugTraceForReplay(
            { events: sorted },
            {
              active: true,
              cursorSeq: state.replayStatus.cursorSeq,
              runId: state.replayStatus.runId,
              nodeId: state.replayStatus.nodeId,
            },
          )
        : liveSummary;
      return { events: sorted, eventIndex, summary, liveSummary };
    }),

  setTraceReplayStatus: (replayStatus) =>
    set((state) => {
      const liveSummary = reduceDebugTrace({ events: state.events });
      const summary = replayStatus.active
        ? reduceDebugTraceForReplay(
            { events: state.events },
            {
              active: true,
              cursorSeq: replayStatus.cursorSeq,
              runId: replayStatus.runId,
              nodeId: replayStatus.nodeId,
            },
          )
        : liveSummary;
      return { replayStatus, summary, liveSummary };
    }),

  stopTraceReplay: () =>
    set((state) => {
      const liveSummary = reduceDebugTrace({ events: state.events });
      return {
        replayStatus: state.replayStatus
          ? { ...state.replayStatus, active: false, playing: false }
          : undefined,
        summary: liveSummary,
        liveSummary,
      };
    }),

  setPerformanceSummary: (performanceSummary) => set({ performanceSummary }),

  resetTrace: (sessionId) =>
    set((state) => {
      const events = sessionId
        ? state.events.filter((event) => event.sessionId !== sessionId)
        : [];
      const eventIndex = Object.fromEntries(
        events.map((event) => [eventKey(event), event]),
      );
      return {
        events,
        eventIndex,
        summary: reduceDebugTrace({ events }),
        liveSummary: reduceDebugTrace({ events }),
        replayStatus:
          sessionId && state.replayStatus?.sessionId === sessionId
            ? undefined
            : state.replayStatus,
        performanceSummary:
          sessionId && state.performanceSummary?.sessionId === sessionId
            ? undefined
            : state.performanceSummary,
      };
    }),
}));
