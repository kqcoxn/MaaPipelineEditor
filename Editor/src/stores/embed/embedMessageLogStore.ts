import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

export type EmbedMessageDirection = "incoming" | "outgoing";

export interface EmbedMessageLog {
  id: string;
  timestamp: number;
  direction: EmbedMessageDirection;
  type: string;
  version: string;
  requestId?: string;
  origin: string;
  payload: unknown;
}

interface EmbedMessageLogState {
  logs: EmbedMessageLog[];
}

interface EmbedMessageLogActions {
  addLog: (entry: Omit<EmbedMessageLog, "id" | "timestamp">) => void;
  clearLogs: () => void;
}

type EmbedMessageLogStore = EmbedMessageLogState & EmbedMessageLogActions;

const MAX_LOGS = 200;
let nextLogId = 1;

export const useEmbedMessageLogStore = create<EmbedMessageLogStore>()(
  subscribeWithSelector((set) => ({
    logs: [],

    addLog(entry) {
      const log: EmbedMessageLog = {
        ...entry,
        id: `embed-message-${nextLogId++}`,
        timestamp: Date.now(),
      };
      set((state) => ({ logs: [...state.logs, log].slice(-MAX_LOGS) }));
    },

    clearLogs() {
      set({ logs: [] });
    },
  })),
);
