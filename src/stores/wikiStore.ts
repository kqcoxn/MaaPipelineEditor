import { create } from "zustand";
import {
  findWikiModuleMeta,
  getFirstWikiTarget,
  normalizeWikiTarget,
} from "../wiki/registry";
import type { WikiModule, WikiTarget } from "../wiki/types";
import { useWikiMemoryStore } from "./wikiMemoryStore";

type WikiModuleStatus = "idle" | "loading" | "ready" | "error";

interface WikiModuleLoadState {
  status: WikiModuleStatus;
  module?: WikiModule;
  error?: string;
}

interface WikiState {
  modalOpen: boolean;
  activeTarget?: WikiTarget;
  moduleCache: Record<string, WikiModuleLoadState>;
  openWiki: (target?: WikiTarget) => void;
  closeWiki: () => void;
  showHome: () => void;
  setTarget: (target: WikiTarget) => void;
  normalizeTarget: (target?: WikiTarget) => WikiTarget | undefined;
  loadModule: (
    entryId: string,
    moduleId: string,
  ) => Promise<WikiModule | undefined>;
}

function getModuleKey(entryId: string, moduleId: string): string {
  return `${entryId}/${moduleId}`;
}

function normalizeTarget(target?: WikiTarget): WikiTarget | undefined {
  const normalized = normalizeWikiTarget(target);
  if (!normalized && target?.entryId) {
    console.warn("[wikiStore] Unknown wiki entry:", target.entryId);
  }
  if (!normalized && target?.moduleId) {
    console.warn("[wikiStore] Unknown wiki module:", target);
  }
  return normalized;
}

export const useWikiStore = create<WikiState>((set, get) => ({
  modalOpen: false,
  moduleCache: {},

  openWiki: (target) =>
    set({
      modalOpen: true,
      activeTarget: normalizeTarget(target),
    }),

  closeWiki: () =>
    set((state) => {
      useWikiMemoryStore.getState().setLastTarget(state.activeTarget);
      return { modalOpen: false };
    }),

  showHome: () => set({ activeTarget: undefined }),

  setTarget: (target) => {
    const normalized = normalizeTarget(target) ?? getFirstWikiTarget();
    set({ activeTarget: normalized });
  },

  normalizeTarget,

  loadModule: async (entryId, moduleId) => {
    const key = getModuleKey(entryId, moduleId);
    const cached = get().moduleCache[key];
    if (cached?.status === "ready") return cached.module;
    if (cached?.status === "loading") return undefined;

    const moduleMeta = findWikiModuleMeta(entryId, moduleId);
    if (!moduleMeta) {
      set((state) => ({
        moduleCache: {
          ...state.moduleCache,
          [key]: {
            status: "error",
            error: "未找到 Wiki 模块",
          },
        },
      }));
      return undefined;
    }

    set((state) => ({
      moduleCache: {
        ...state.moduleCache,
        [key]: { status: "loading" },
      },
    }));

    try {
      const loaded = await moduleMeta.loader();
      set((state) => ({
        moduleCache: {
          ...state.moduleCache,
          [key]: {
            status: "ready",
            module: loaded.default,
          },
        },
      }));
      return loaded.default;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Wiki 模块加载失败";
      set((state) => ({
        moduleCache: {
          ...state.moduleCache,
          [key]: {
            status: "error",
            error: message,
          },
        },
      }));
      return undefined;
    }
  },
}));
