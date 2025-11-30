import type { StateCreator } from "zustand";
import type { FlowStore, FlowSelectionState, NodeType, EdgeType } from "../types";

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

      // 防抖更新
      const timeouts = { ...state.debounceTimeouts };
      
      // 清除旧的超时
      if (timeouts.selectedNodes) clearTimeout(timeouts.selectedNodes);
      if (timeouts.selectedEdges) clearTimeout(timeouts.selectedEdges);
      if (timeouts.targetNode) clearTimeout(timeouts.targetNode);

      // 设置新的超时
      timeouts.selectedNodes = setTimeout(() => {
        set({ debouncedSelectedNodes: get().selectedNodes });
      }, 400) as unknown as number;

      timeouts.selectedEdges = setTimeout(() => {
        set({ debouncedSelectedEdges: get().selectedEdges });
      }, 400) as unknown as number;

      if ("targetNode" in newState) {
        timeouts.targetNode = setTimeout(() => {
          set({ debouncedTargetNode: get().targetNode });
        }, 400) as unknown as number;
      }

      newState.debounceTimeouts = timeouts;

      return newState;
    });
  },

  // 设置目标节点
  setTargetNode(node: NodeType | null) {
    set((state) => {
      const timeouts = { ...state.debounceTimeouts };
      
      if (timeouts.targetNode) clearTimeout(timeouts.targetNode);

      timeouts.targetNode = setTimeout(() => {
        set({ debouncedTargetNode: get().targetNode });
      }, 400) as unknown as number;

      return {
        targetNode: node,
        debounceTimeouts: timeouts,
      };
    });
  },

  // 清空选择
  clearSelection() {
    set((state) => {
      // 清除所有防抖超时
      Object.values(state.debounceTimeouts).forEach((timeout) => {
        if (timeout) clearTimeout(timeout);
      });

      return {
        selectedNodes: [],
        selectedEdges: [],
        targetNode: null,
        debouncedSelectedNodes: [],
        debouncedSelectedEdges: [],
        debouncedTargetNode: null,
        debounceTimeouts: {},
      };
    });
  },
});
