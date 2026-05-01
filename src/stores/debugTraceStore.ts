import { create } from "zustand";
import {
  reduceDebugTrace,
  reduceDebugTraceForReplay,
  type DebugTraceSummary,
} from "../features/debug/traceReducer";
import type {
  DebugEvent,
  DebugPerformanceSummary,
  DebugRunMode,
  DebugTraceReplayStatus,
} from "../features/debug/types";

export interface DebugTraceDisplaySession {
  id: string;
  sessionId: string;
  runId: string;
  mode?: DebugRunMode;
  status?: string;
  startedAt?: string;
  completedAt?: string;
  firstSeq: number;
  lastSeq: number;
  eventCount: number;
}

interface DebugTraceState {
  events: DebugEvent[];
  displayEvents: DebugEvent[];
  eventIndex: Record<string, DebugEvent>;
  displaySessions: DebugTraceDisplaySession[];
  selectedDisplaySessionIds: string[];
  latestDisplaySessionId?: string;
  summary: DebugTraceSummary;
  liveSummary: DebugTraceSummary;
  replayStatus?: DebugTraceReplayStatus;
  performanceSummaries: Record<string, DebugPerformanceSummary>;
  selectedPerformanceSummaries: DebugPerformanceSummary[];
  performanceSummary?: DebugPerformanceSummary;
  appendEvent: (event: DebugEvent) => void;
  applyTraceSnapshot: (
    events: DebugEvent[],
    sessionId?: string,
    runId?: string,
  ) => void;
  setTraceReplayStatus: (status: DebugTraceReplayStatus) => void;
  stopTraceReplay: () => void;
  setPerformanceSummary: (summary: DebugPerformanceSummary) => void;
  selectDisplaySessions: (sessionIds: string[]) => void;
  selectLatestDisplaySession: () => void;
  selectAllDisplaySessions: () => void;
  resetTrace: (sessionId?: string) => void;
}

function eventKey(event: DebugEvent): string {
  return `${event.sessionId}:${event.runId}:${event.seq}`;
}

function displaySessionId(sessionId: string, runId: string): string {
  return `${sessionId}:${runId}`;
}

function displaySessionIdForEvent(event: DebugEvent): string {
  return displaySessionId(event.sessionId, event.runId);
}

function displaySessionIdForSummary(summary: DebugPerformanceSummary): string {
  return displaySessionId(summary.sessionId, summary.runId);
}

function timestampValue(timestamp?: string): number {
  if (!timestamp) return 0;
  const parsed = Date.parse(timestamp);
  return Number.isFinite(parsed) ? parsed : 0;
}

function compareEvents(a: DebugEvent, b: DebugEvent): number {
  const timeDiff = timestampValue(a.timestamp) - timestampValue(b.timestamp);
  if (timeDiff !== 0) return timeDiff;
  const sessionDiff = a.sessionId.localeCompare(b.sessionId);
  if (sessionDiff !== 0) return sessionDiff;
  const runDiff = a.runId.localeCompare(b.runId);
  if (runDiff !== 0) return runDiff;
  return a.seq - b.seq;
}

function sortEvents(events: DebugEvent[]): DebugEvent[] {
  return [...events].sort(compareEvents);
}

function statusFromEvent(event: DebugEvent): string | undefined {
  return event.status ?? event.phase;
}

function modeFromEvent(event: DebugEvent): DebugRunMode | undefined {
  return typeof event.data?.mode === "string"
    ? (event.data.mode as DebugRunMode)
    : undefined;
}

function isTerminalSessionEvent(event: DebugEvent): boolean {
  if (event.kind !== "session") return false;
  return (
    event.phase === "completed" ||
    event.phase === "failed" ||
    event.status === "completed" ||
    event.status === "failed" ||
    event.status === "stopped"
  );
}

function shouldFocusDisplaySession(event: DebugEvent, existed: boolean): boolean {
  if (!existed) return true;
  if (event.kind !== "session") return false;
  return event.phase === "starting" || isTerminalSessionEvent(event);
}

function buildDisplaySessions(events: DebugEvent[]): DebugTraceDisplaySession[] {
  const sessions = new Map<string, DebugTraceDisplaySession>();

  for (const event of sortEvents(events)) {
    const id = displaySessionIdForEvent(event);
    const current = sessions.get(id);
    const mode = modeFromEvent(event);
    const status = statusFromEvent(event);

    if (!current) {
      sessions.set(id, {
        id,
        sessionId: event.sessionId,
        runId: event.runId,
        mode,
        status,
        startedAt: event.timestamp,
        completedAt: isTerminalSessionEvent(event) ? event.timestamp : undefined,
        firstSeq: event.seq,
        lastSeq: event.seq,
        eventCount: 1,
      });
      continue;
    }

    current.eventCount += 1;
    current.lastSeq = event.seq;
    if (!current.mode && mode) current.mode = mode;
    if (status) current.status = status;
    if (isTerminalSessionEvent(event)) current.completedAt = event.timestamp;
  }

  return [...sessions.values()].sort(
    (a, b) =>
      timestampValue(b.completedAt ?? b.startedAt) -
        timestampValue(a.completedAt ?? a.startedAt) ||
      b.lastSeq - a.lastSeq,
  );
}

function normalizeSelectedDisplaySessionIds(
  selectedIds: string[],
  displaySessions: DebugTraceDisplaySession[],
): string[] {
  const validIds = new Set(displaySessions.map((session) => session.id));
  const selected = [...new Set(selectedIds)].filter((id) => validIds.has(id));
  if (selected.length > 0) return selected;
  const latest = displaySessions[0]?.id;
  return latest ? [latest] : [];
}

function replayAppliesToDisplaySessions(
  replayStatus: DebugTraceReplayStatus | undefined,
  selectedIds: string[],
): replayStatus is DebugTraceReplayStatus {
  if (!replayStatus?.active) return false;
  if (replayStatus.runId) {
    return selectedIds.includes(
      displaySessionId(replayStatus.sessionId, replayStatus.runId),
    );
  }
  const sessionPrefix = `${replayStatus.sessionId}:`;
  return selectedIds.some((id) => id.startsWith(sessionPrefix));
}

function selectDisplayEvents(
  events: DebugEvent[],
  selectedIds: string[],
): DebugEvent[] {
  if (selectedIds.length === 0) return [];
  const selected = new Set(selectedIds);
  return sortEvents(
    events.filter((event) => selected.has(displaySessionIdForEvent(event))),
  );
}

function selectPerformanceSummaries(
  performanceSummaries: Record<string, DebugPerformanceSummary>,
  displaySessions: DebugTraceDisplaySession[],
  selectedIds: string[],
): DebugPerformanceSummary[] {
  const selected = new Set(selectedIds);
  return displaySessions
    .filter((session) => selected.has(session.id))
    .map((session) => performanceSummaries[session.id])
    .filter((summary): summary is DebugPerformanceSummary => Boolean(summary));
}

function buildTraceView({
  events,
  performanceSummaries,
  replayStatus,
  selectedDisplaySessionIds,
}: Pick<
  DebugTraceState,
  | "events"
  | "performanceSummaries"
  | "replayStatus"
  | "selectedDisplaySessionIds"
>): Pick<
  DebugTraceState,
  | "displayEvents"
  | "displaySessions"
  | "latestDisplaySessionId"
  | "liveSummary"
  | "performanceSummary"
  | "selectedDisplaySessionIds"
  | "selectedPerformanceSummaries"
  | "summary"
> {
  const displaySessions = buildDisplaySessions(events);
  const latestDisplaySessionId = displaySessions[0]?.id;
  const selectedIds = normalizeSelectedDisplaySessionIds(
    selectedDisplaySessionIds,
    displaySessions,
  );
  const displayEvents = selectDisplayEvents(events, selectedIds);
  const liveSummary = reduceDebugTrace({ events: displayEvents });
  const summary = replayAppliesToDisplaySessions(replayStatus, selectedIds)
    ? reduceDebugTraceForReplay(
        { events: displayEvents },
        {
          active: true,
          cursorSeq: replayStatus.cursorSeq,
          runId: replayStatus.runId,
          nodeId: replayStatus.nodeId,
        },
      )
    : liveSummary;
  const selectedPerformanceSummaries = selectPerformanceSummaries(
    performanceSummaries,
    displaySessions,
    selectedIds,
  );

  return {
    displayEvents,
    displaySessions,
    latestDisplaySessionId,
    liveSummary,
    performanceSummary: selectedPerformanceSummaries[0],
    selectedDisplaySessionIds: selectedIds,
    selectedPerformanceSummaries,
    summary,
  };
}

export const useDebugTraceStore = create<DebugTraceState>((set, get) => ({
  events: [],
  displayEvents: [],
  eventIndex: {},
  displaySessions: [],
  selectedDisplaySessionIds: [],
  summary: reduceDebugTrace({ events: [] }),
  liveSummary: reduceDebugTrace({ events: [] }),
  performanceSummaries: {},
  selectedPerformanceSummaries: [],

  appendEvent: (event) => {
    const key = eventKey(event);
    if (get().eventIndex[key]) return;

    set((state) => {
      const focusedSessionId = displaySessionIdForEvent(event);
      const existed = state.displaySessions.some(
        (session) => session.id === focusedSessionId,
      );
      const events = sortEvents([...state.events, event]);
      const selectedDisplaySessionIds = shouldFocusDisplaySession(event, existed)
        ? [focusedSessionId]
        : state.selectedDisplaySessionIds;
      return {
        events,
        eventIndex: {
          ...state.eventIndex,
          [key]: event,
        },
        ...buildTraceView({
          events,
          performanceSummaries: state.performanceSummaries,
          replayStatus: state.replayStatus,
          selectedDisplaySessionIds,
        }),
      };
    });
  },

  applyTraceSnapshot: (events, sessionId, runId) =>
    set((state) => {
      const sorted = sortEvents(events);
      const merged = sessionId
        ? sortEvents([
            ...state.events.filter((event) =>
              runId
                ? event.sessionId !== sessionId || event.runId !== runId
                : event.sessionId !== sessionId,
            ),
            ...sorted,
          ])
        : sorted;
      const eventIndex = Object.fromEntries(
        merged.map((event) => [eventKey(event), event]),
      );
      return {
        events: merged,
        eventIndex,
        ...buildTraceView({
          events: merged,
          performanceSummaries: state.performanceSummaries,
          replayStatus: state.replayStatus,
          selectedDisplaySessionIds: state.selectedDisplaySessionIds,
        }),
      };
    }),

  setTraceReplayStatus: (replayStatus) =>
    set((state) => {
      return {
        replayStatus,
        ...buildTraceView({
          events: state.events,
          performanceSummaries: state.performanceSummaries,
          replayStatus,
          selectedDisplaySessionIds: state.selectedDisplaySessionIds,
        }),
      };
    }),

  stopTraceReplay: () =>
    set((state) => {
      const replayStatus = state.replayStatus
        ? { ...state.replayStatus, active: false, playing: false }
        : undefined;
      return {
        replayStatus,
        ...buildTraceView({
          events: state.events,
          performanceSummaries: state.performanceSummaries,
          replayStatus,
          selectedDisplaySessionIds: state.selectedDisplaySessionIds,
        }),
      };
    }),

  setPerformanceSummary: (performanceSummary) =>
    set((state) => {
      const performanceSummaries = {
        ...state.performanceSummaries,
        [displaySessionIdForSummary(performanceSummary)]: performanceSummary,
      };
      return {
        performanceSummaries,
        ...buildTraceView({
          events: state.events,
          performanceSummaries,
          replayStatus: state.replayStatus,
          selectedDisplaySessionIds: state.selectedDisplaySessionIds,
        }),
      };
    }),

  selectDisplaySessions: (sessionIds) =>
    set((state) =>
      buildTraceView({
        events: state.events,
        performanceSummaries: state.performanceSummaries,
        replayStatus: state.replayStatus,
        selectedDisplaySessionIds: sessionIds,
      }),
    ),

  selectLatestDisplaySession: () =>
    set((state) =>
      buildTraceView({
        events: state.events,
        performanceSummaries: state.performanceSummaries,
        replayStatus: state.replayStatus,
        selectedDisplaySessionIds: state.latestDisplaySessionId
          ? [state.latestDisplaySessionId]
          : [],
      }),
    ),

  selectAllDisplaySessions: () =>
    set((state) =>
      buildTraceView({
        events: state.events,
        performanceSummaries: state.performanceSummaries,
        replayStatus: state.replayStatus,
        selectedDisplaySessionIds: state.displaySessions.map(
          (session) => session.id,
        ),
      }),
    ),

  resetTrace: (sessionId) =>
    set((state) => {
      const events = sessionId
        ? state.events.filter((event) => event.sessionId !== sessionId)
        : [];
      const eventIndex = Object.fromEntries(
        events.map((event) => [eventKey(event), event]),
      );
      const performanceSummaries = sessionId
        ? Object.fromEntries(
            Object.entries(state.performanceSummaries).filter(
              ([, summary]) => summary.sessionId !== sessionId,
            ),
          )
        : {};
      const replayStatus =
        sessionId && state.replayStatus?.sessionId === sessionId
          ? undefined
          : state.replayStatus;
      return {
        events,
        eventIndex,
        performanceSummaries,
        replayStatus,
        ...buildTraceView({
          events,
          performanceSummaries,
          replayStatus,
          selectedDisplaySessionIds: state.selectedDisplaySessionIds,
        }),
      };
    }),
}));
