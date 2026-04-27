import { create } from "zustand";
import { reduceDebugTrace, type DebugTraceSummary } from "../features/debug/traceReducer";
import type { DebugEvent } from "../features/debug/types";

interface DebugTraceState {
  events: DebugEvent[];
  eventIndex: Record<string, DebugEvent>;
  summary: DebugTraceSummary;
  appendEvent: (event: DebugEvent) => void;
  resetTrace: (sessionId?: string) => void;
}

function eventKey(event: DebugEvent): string {
  return `${event.sessionId}:${event.runId}:${event.seq}`;
}

export const useDebugTraceStore = create<DebugTraceState>((set, get) => ({
  events: [],
  eventIndex: {},
  summary: reduceDebugTrace({ events: [] }),

  appendEvent: (event) => {
    const key = eventKey(event);
    if (get().eventIndex[key]) return;

    set((state) => {
      const events = [...state.events, event].sort((a, b) => a.seq - b.seq);
      return {
        events,
        eventIndex: {
          ...state.eventIndex,
          [key]: event,
        },
        summary: reduceDebugTrace({ events }),
      };
    });
  },

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
      };
    }),
}));
