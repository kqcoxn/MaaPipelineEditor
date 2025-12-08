import { create } from "zustand";

/**
 * WebSocket 连接状态 Store
 * 用于管理 WebSocket 的运行时连接状态
 */
type WSState = {
  /** 是否已连接 */
  connected: boolean;
  /** 是否正在连接中 */
  connecting: boolean;
  /** 设置连接状态 */
  setConnected: (connected: boolean) => void;
  /** 设置连接中状态 */
  setConnecting: (connecting: boolean) => void;
};

export const useWSStore = create<WSState>()((set) => ({
  connected: false,
  connecting: false,
  setConnected: (connected) => set({ connected }),
  setConnecting: (connecting) => set({ connecting }),
}));
