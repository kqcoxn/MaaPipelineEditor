import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

/**
 * WebSocket 连接状态 Store
 * 用于管理 WebSocket 的运行时连接状态
 */
interface WSState {
  /** 是否已连接 */
  connected: boolean;
  /** 是否正在连接中 */
  connecting: boolean;
}

interface WSActions {
  /** 设置连接状态 */
  setConnected: (connected: boolean) => void;
  /** 设置连接中状态 */
  setConnecting: (connecting: boolean) => void;
}

type WSStore = WSState & WSActions;

export const useWSStore = create<WSStore>()(
  subscribeWithSelector((set) => ({
    connected: false,
    connecting: false,
    setConnected: (connected) => set({ connected }),
    setConnecting: (connecting) => set({ connecting }),
  })),
);
