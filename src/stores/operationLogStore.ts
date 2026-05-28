import { create } from "zustand";

/** 操作日志分类 */
export type OperationCategory = "node" | "edge" | "graph" | "group";

/** 操作描述符（由 saveHistory 调用方传入） */
export interface OperationDescriptor {
  category: OperationCategory;
  action: string;
  description: string;
  targetIds?: string[];
}

/** 操作日志条目 */
export interface OperationLog {
  id: string;
  timestamp: number;
  category: OperationCategory;
  action: string;
  description: string;
  targetIds?: string[];
  meta?: Record<string, unknown>;
}

interface OperationLogState {
  logs: OperationLog[];
  maxLogs: number;
  addLog: (entry: Omit<OperationLog, "id" | "timestamp">) => void;
  clearLogs: () => void;
}

export const useOperationLogStore = create<OperationLogState>((set) => ({
  logs: [],
  maxLogs: 200,

  addLog: (entry) =>
    set((state) => {
      const newLog: OperationLog = {
        ...entry,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        timestamp: Date.now(),
      };
      const newLogs = [...state.logs, newLog];
      if (newLogs.length > state.maxLogs) {
        return { logs: newLogs.slice(-state.maxLogs) };
      }
      return { logs: newLogs };
    }),

  clearLogs: () => set({ logs: [] }),
}));
