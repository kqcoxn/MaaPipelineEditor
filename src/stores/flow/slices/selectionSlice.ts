import type { StateCreator } from "zustand";
import type {
  FlowStore,
  FlowSelectionState,
  NodeType,
  EdgeType,
} from "../types";

// 全局防抖定时器
let debounceTimeout: NodeJS.Timeout | null = null;

export const createSelectionSlice: StateCreator<
  FlowStore,
  [],
  [],
  FlowSelectionState
> = (set, get) => ({
  // 初始状态
  selectedNodes: [],
  selectedEdges: [],
  targetNode: null,
  debouncedSelectedNodes: [],
  debouncedSelectedEdges: [],
  debouncedTargetNode: null,
  debounceTimeouts: {},

  // 更新选择状态
  updateSelection(nodes: NodeType[], edges: EdgeType[]) {
    set((state) => {
      const newState: Partial<FlowSelectionState> = {
        selectedNodes: nodes,
        selectedEdges: edges,
      };

      // 更新目标节点
      if (nodes.length !== 1) {
        newState.targetNode = null;
      } else if (!nodes[0].dragging) {
        newState.targetNode = nodes[0];
      }

      // 清除旧的防抖定时器
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }

      // 设置新的防抖定时器
      debounceTimeout = setTimeout(() => {
        const currentState = get();
        set({
          debouncedSelectedNodes: currentState.selectedNodes,
          debouncedSelectedEdges: currentState.selectedEdges,
          debouncedTargetNode: currentState.targetNode,
        });
      }, 400);

      return newState;
    });
  },

  // 设置目标节点
  setTargetNode(node: NodeType | null) {
    set({ targetNode: node });

    // 清除旧的防抖定时器
    if (debounceTimeout) {
      clearTimeout(debounceTimeout);
    }

    // 设置新的防抖定时器
    debounceTimeout = setTimeout(() => {
      set({ debouncedTargetNode: get().targetNode });
    }, 400);
  },

  // 清空选择
  clearSelection() {
    // 清除防抖定时器
    if (debounceTimeout) {
      clearTimeout(debounceTimeout);
      debounceTimeout = null;
    }

    set({
      selectedNodes: [],
      selectedEdges: [],
      targetNode: null,
      debouncedSelectedNodes: [],
      debouncedSelectedEdges: [],
      debouncedTargetNode: null,
      debounceTimeouts: {},
    });
  },
});
