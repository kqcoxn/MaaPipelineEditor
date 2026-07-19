import { arrayMove } from "@dnd-kit/sortable";
import { create } from "zustand";

export type EditorTab =
  | { kind: "pipeline"; path: string; key: string }
  | { kind: "document"; path: string; key: string };

export function pipelineTabKey(path: string): string {
  return `pipeline:${normalizeProjectPath(path)}`;
}

export function documentTabKey(path: string): string {
  return `document:${normalizeProjectPath(path)}`;
}

export function createPipelineTab(path: string): EditorTab {
  const normalized = normalizeProjectPath(path);
  return { kind: "pipeline", path: normalized, key: pipelineTabKey(normalized) };
}

export function createDocumentTab(path: string): EditorTab {
  const normalized = normalizeProjectPath(path);
  return { kind: "document", path: normalized, key: documentTabKey(normalized) };
}

interface ProjectSessionState {
  tabs: EditorTab[];
  activeKey: string | null;
  openPipeline: (path: string) => string;
  openDocument: (path: string) => string;
  activateTab: (key: string) => boolean;
  closeTab: (key: string) => string | null;
  reorderTab: (activeKey: string, overKey: string) => void;
  syncPipelineTabs: (paths: string[]) => void;
  clear: () => void;
}

function openTab(
  set: (updater: (state: ProjectSessionState) => Partial<ProjectSessionState>) => void,
  tab: EditorTab,
): string {
  set((state) => ({
    tabs: state.tabs.some((item) => item.key === tab.key)
      ? state.tabs
      : [...state.tabs, tab],
    activeKey: tab.key,
  }));
  return tab.key;
}

export const useProjectSessionStore = create<ProjectSessionState>()((set, get) => ({
  tabs: [],
  activeKey: null,
  openPipeline(path) {
    return openTab(set, createPipelineTab(path));
  },
  openDocument(path) {
    return openTab(set, createDocumentTab(path));
  },
  activateTab(key) {
    if (!get().tabs.some((tab) => tab.key === key)) return false;
    set({ activeKey: key });
    return true;
  },
  closeTab(key) {
    const { tabs, activeKey } = get();
    const index = tabs.findIndex((tab) => tab.key === key);
    if (index < 0) return activeKey;
    const nextTabs = tabs.filter((tab) => tab.key !== key);
    const nextActiveKey =
      activeKey === key
        ? (nextTabs[Math.min(index, nextTabs.length - 1)]?.key ?? null)
        : activeKey;
    set({ tabs: nextTabs, activeKey: nextActiveKey });
    return nextActiveKey;
  },
  reorderTab(activeKey, overKey) {
    set((state) => {
      const activeIndex = state.tabs.findIndex((tab) => tab.key === activeKey);
      const overIndex = state.tabs.findIndex((tab) => tab.key === overKey);
      if (activeIndex < 0 || overIndex < 0 || activeIndex === overIndex) return state;
      return { tabs: arrayMove(state.tabs, activeIndex, overIndex) };
    });
  },
  syncPipelineTabs(paths) {
    const pipelineTabs = paths.map(createPipelineTab);
    const pipelineByKey = new Map(pipelineTabs.map((tab) => [tab.key, tab]));
    set((state) => {
      const nextTabs = state.tabs
        .filter((tab) => tab.kind === "document" || pipelineByKey.has(tab.key))
        .map((tab) => (tab.kind === "pipeline" ? pipelineByKey.get(tab.key)! : tab));
      const existing = new Set(nextTabs.map((tab) => tab.key));
      pipelineTabs.forEach((tab) => {
        if (!existing.has(tab.key)) nextTabs.push(tab);
      });
      const activeKey = nextTabs.some((tab) => tab.key === state.activeKey)
        ? state.activeKey
        : (nextTabs[0]?.key ?? null);
      return { tabs: nextTabs, activeKey };
    });
  },
  clear() {
    set({ tabs: [], activeKey: null });
  },
}));

function normalizeProjectPath(path: string): string {
  return path.replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
}
