import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import {
  type EmbedCapabilities,
  type EmbedAnchorDefinition,
  type EmbedHostInfo,
  type EmbedUIConfig,
  DEFAULT_CAPABILITIES,
  DEFAULT_UI,
} from "@/utils/embedBridge";

/**
 * 嵌入模式全局状态
 * 集中管理 capabilities、UI 配置、ready 状态、当前文件名
 */

export type EmbedOperationStatus =
  | "idle"
  | "pending"
  | "success"
  | "error"
  | "conflict";

export interface EmbedOperationState {
  status: EmbedOperationStatus;
  requestId: string | null;
  error: string | null;
}

interface EmbedState {
  isReady: boolean;
  capabilities: EmbedCapabilities;
  ui: EmbedUIConfig;
  host: EmbedHostInfo | null;
  currentFileName: string | null;
  anchorDefinitions: EmbedAnchorDefinition[];
  cleanPipeline: string | null;
  isDirty: boolean;
  saveOperation: EmbedOperationState;
  reloadOperation: EmbedOperationState;
  pendingSavePipeline: string | null;

  // actions
  initConfig: (
    capabilities: Partial<EmbedCapabilities>,
    ui: Partial<EmbedUIConfig>,
    host?: EmbedHostInfo | null,
  ) => void;
  setReady: (ready: boolean) => void;
  setFileName: (fileName: string | null) => void;
  setAnchorDefinitions: (definitions: EmbedAnchorDefinition[]) => void;
  markClean: (pipeline: string) => void;
  setDirty: (dirty: boolean) => void;
  beginSave: (requestId: string) => void;
  captureSavePipeline: (requestId: string | undefined, pipeline: string) => void;
  beginSaveConflict: (requestId: string | undefined) => void;
  finishSave: (
    requestId: string | undefined,
    success: boolean,
    currentPipeline: string,
    error?: string,
  ) => void;
  acknowledgeSaveResult: () => void;
  beginReload: (requestId: string) => void;
  finishReload: (
    requestId: string | undefined,
    success: boolean,
    error?: string,
  ) => void;
  acknowledgeReloadResult: () => void;
  reset: () => void;
  isCapabilityAllowed: (cap: keyof EmbedCapabilities) => boolean;
  isPanelHidden: (panelId: string) => boolean;
}

const idleOperation = (): EmbedOperationState => ({
  status: "idle",
  requestId: null,
  error: null,
});

export const useEmbedStore = create<EmbedState>()(
  subscribeWithSelector((set, get) => ({
    isReady: false,
    capabilities: { ...DEFAULT_CAPABILITIES },
    ui: { ...DEFAULT_UI },
    host: null,
    currentFileName: null,
    anchorDefinitions: [],
    cleanPipeline: null,
    isDirty: false,
    saveOperation: idleOperation(),
    reloadOperation: idleOperation(),
    pendingSavePipeline: null,

    initConfig(partialCaps, partialUi, host) {
      set((state) => ({
        capabilities: {
          ...state.capabilities,
          ...partialCaps,
          hostNodeNavigation: partialCaps.hostNodeNavigation === true,
        },
        ui: { ...state.ui, ...partialUi },
        host: host === undefined ? state.host : host,
      }));
    },

    setReady(ready) {
      set({ isReady: ready });
    },

    setFileName(fileName) {
      set({ currentFileName: fileName });
    },

    setAnchorDefinitions(anchorDefinitions) {
      set({ anchorDefinitions });
    },

    markClean(pipeline) {
      set({ cleanPipeline: pipeline, isDirty: false });
    },

    setDirty(isDirty) {
      set({ isDirty });
    },

    beginSave(requestId) {
      set({
        saveOperation: { status: "pending", requestId, error: null },
        pendingSavePipeline: null,
      });
    },

    captureSavePipeline(requestId, pipeline) {
      if (!requestId || get().saveOperation.requestId !== requestId) return;
      set({ pendingSavePipeline: pipeline });
    },

    beginSaveConflict(requestId) {
      if (!requestId || get().saveOperation.requestId !== requestId) return;
      set({
        saveOperation: { status: "conflict", requestId: null, error: null },
        pendingSavePipeline: null,
      });
    },

    finishSave(requestId, success, currentPipeline, error) {
      const state = get();
      if (!requestId || state.saveOperation.requestId !== requestId) return;

      if (!success) {
        set({
          saveOperation: {
            status: "error",
            requestId: null,
            error: error ?? "宿主保存失败",
          },
        });
        return;
      }

      const savedPipeline = state.pendingSavePipeline;
      set({
        cleanPipeline: savedPipeline ?? state.cleanPipeline,
        isDirty: savedPipeline ? currentPipeline !== savedPipeline : state.isDirty,
        pendingSavePipeline: null,
        saveOperation: { status: "success", requestId: null, error: null },
      });
    },

    acknowledgeSaveResult() {
      if (get().saveOperation.status === "pending") return;
      set({ saveOperation: idleOperation() });
    },

    beginReload(requestId) {
      set({
        reloadOperation: { status: "pending", requestId, error: null },
      });
    },

    finishReload(requestId, success, error) {
      const operation = get().reloadOperation;
      if (!requestId || operation.requestId !== requestId) return;
      set({
        reloadOperation: success
          ? { status: "success", requestId: null, error: null }
          : {
              status: "error",
              requestId: null,
              error: error ?? "从宿主同步失败",
            },
      });
    },

    acknowledgeReloadResult() {
      if (get().reloadOperation.status === "pending") return;
      set({ reloadOperation: idleOperation() });
    },

    reset() {
      set({
        isReady: false,
        capabilities: { ...DEFAULT_CAPABILITIES },
        ui: { ...DEFAULT_UI },
        host: null,
        currentFileName: null,
        anchorDefinitions: [],
        cleanPipeline: null,
        isDirty: false,
        saveOperation: idleOperation(),
        reloadOperation: idleOperation(),
        pendingSavePipeline: null,
      });
    },

    isCapabilityAllowed(cap) {
      return get().capabilities[cap];
    },

    isPanelHidden(panelId) {
      const { ui } = get();
      if (panelId === "header" && ui.hideHeader) return true;
      if (panelId === "toolbar" && ui.hideToolbar) return true;
      return ui.hiddenPanels.includes(panelId);
    },
  })),
);
