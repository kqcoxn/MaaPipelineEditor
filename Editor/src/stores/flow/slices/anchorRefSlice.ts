import type { StateCreator } from "zustand";
import type { FlowStore, FlowAnchorRefState } from "../types";

export const createAnchorRefSlice: StateCreator<
  FlowStore,
  [],
  [],
  FlowAnchorRefState
> = (set, get) => ({
  // 初始状态
  anchorRefHighlightedNodeIds: new Set(),
  selectedAnchorName: null,

  // 设置选中的 anchor 名称
  setSelectedAnchorName(anchorName: string | null) {
    if (anchorName === get().selectedAnchorName) return;

    const index = get().anchorReferenceIndex;
    let highlightedIds: Set<string>;
    if (anchorName) {
      const found = index.get(anchorName);
      highlightedIds = found ? new Set(found) : new Set();
    } else {
      highlightedIds = new Set();
    }

    set({
      selectedAnchorName: anchorName,
      anchorRefHighlightedNodeIds: highlightedIds,
    });
  },

  // 获取使用指定 anchor 的节点 ID 列表
  getNodesUsingAnchor(anchorName: string): string[] {
    const index = get().anchorReferenceIndex;
    const nodeIds = index.get(anchorName);
    return nodeIds ? Array.from(nodeIds) : [];
  },
});
