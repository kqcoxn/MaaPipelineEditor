import { create } from "zustand";

interface WikiState {
  /** 当前活跃的文档路径（鼠标悬浮的面板对应的文档页） */
  activePath: string | null;
  /** 设置当前活跃路径 */
  setActivePath: (path: string) => void;
  /** 清除活跃路径（仅当 path 匹配时才清除，防止快速切换时误清） */
  clearActivePath: (path: string) => void;
}

export const useWikiStore = create<WikiState>((set, get) => ({
  activePath: null,
  setActivePath: (path) => set({ activePath: path }),
  clearActivePath: (path) => {
    if (get().activePath === path) {
      set({ activePath: null });
    }
  },
}));
