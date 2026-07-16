import { create } from "zustand";
import {
  type EmbedCapabilities,
  type EmbedUIConfig,
  DEFAULT_CAPABILITIES,
  DEFAULT_UI,
} from "../utils/embedBridge";

/**
 * 嵌入模式全局状态
 * 集中管理 capabilities、UI 配置、ready 状态、当前文件名
 */

interface EmbedState {
  isReady: boolean;
  capabilities: EmbedCapabilities;
  ui: EmbedUIConfig;
  currentFileName: string | null;

  // actions
  initConfig: (
    capabilities: Partial<EmbedCapabilities>,
    ui: Partial<EmbedUIConfig>,
  ) => void;
  setReady: (ready: boolean) => void;
  setFileName: (fileName: string | null) => void;
  isCapabilityAllowed: (cap: keyof EmbedCapabilities) => boolean;
  isPanelHidden: (panelId: string) => boolean;
}

export const useEmbedStore = create<EmbedState>()((set, get) => ({
  isReady: false,
  capabilities: { ...DEFAULT_CAPABILITIES },
  ui: { ...DEFAULT_UI },
  currentFileName: null,

  initConfig(partialCaps, partialUi) {
    set((state) => ({
      capabilities: { ...state.capabilities, ...partialCaps },
      ui: { ...state.ui, ...partialUi },
    }));
  },

  setReady(ready) {
    set({ isReady: ready });
  },

  setFileName(fileName) {
    set({ currentFileName: fileName });
  },

  isCapabilityAllowed(cap) {
    return get().capabilities[cap];
  },

  isPanelHidden(panelId) {
    return get().ui.hiddenPanels.includes(panelId);
  },
}));
