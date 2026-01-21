import { create } from "zustand";

export interface LogEntry {
  id: string;
  level: "INFO" | "WARN" | "ERROR";
  module: string;
  message: string;
  timestamp: string;
}

interface LoggerState {
  logs: LogEntry[];
  expanded: boolean;
  maxLogs: number;
  addLog: (entry: Omit<LogEntry, "id">) => void;
  clearLogs: () => void;
  toggleExpanded: () => void;
  setExpanded: (value: boolean) => void;
}

export const useLoggerStore = create<LoggerState>((set) => ({
  logs: [],
  expanded: false,
  maxLogs: 100,

  addLog: (entry) =>
    set((state) => {
      const newLog: LogEntry = {
        ...entry,
        id: `${entry.timestamp}-${Math.random().toString(36).slice(2, 9)}`,
      };
      const newLogs = [...state.logs, newLog];
      // 保持队列长度不超过 maxLogs
      if (newLogs.length > state.maxLogs) {
        return { logs: newLogs.slice(-state.maxLogs) };
      }
      return { logs: newLogs };
    }),

  clearLogs: () => set({ logs: [] }),

  toggleExpanded: () => set((state) => ({ expanded: !state.expanded })),

  setExpanded: (value) => set({ expanded: value }),
}));
