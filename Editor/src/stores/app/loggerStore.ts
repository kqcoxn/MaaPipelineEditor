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
  importantLogs: LogEntry[];
  expanded: boolean;
  maxLogs: number;
  maxImportantLogs: number;
  addLog: (entry: Omit<LogEntry, "id">) => void;
  clearLogs: () => void;
  toggleExpanded: () => void;
  setExpanded: (value: boolean) => void;
}

export const useLoggerStore = create<LoggerState>((set) => ({
  logs: [],
  importantLogs: [],
  expanded: false,
  maxLogs: 1000,
  maxImportantLogs: 500,

  addLog: (entry) =>
    set((state) => {
      const newLog: LogEntry = {
        ...entry,
        id: `${entry.timestamp}-${Math.random().toString(36).slice(2, 9)}`,
      };
      const newLogs = [...state.logs, newLog];
      // 保持队列长度不超过 maxLogs
      const logs = newLogs.length > state.maxLogs
        ? newLogs.slice(-state.maxLogs)
        : newLogs;
      const importantLogs = entry.level === "INFO"
        ? state.importantLogs
        : [...state.importantLogs, newLog].slice(-state.maxImportantLogs);
      return { logs, importantLogs };
    }),

  clearLogs: () => set({ logs: [], importantLogs: [] }),

  toggleExpanded: () => set((state) => ({ expanded: !state.expanded })),

  setExpanded: (value) => set({ expanded: value }),
}));
