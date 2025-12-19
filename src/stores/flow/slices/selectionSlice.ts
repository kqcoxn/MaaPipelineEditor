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
    console.log("[SelectionSlice] updateSelection called:", {
      nodesCount: nodes.length,
      edgesCount: edges.length,
      nodes: nodes.map((n) => ({
        id: n.id,
        type: n.type,
        dragging: n.dragging,
      })),
    });

    set((state) => {
      const newState: Partial<FlowSelectionState> = {
        selectedNodes: nodes,
        selectedEdges: edges,
      };

      // 更新目标节点
      if (nodes.length !== 1) {
        // 多选或无选择时清空目标节点
        newState.targetNode = null;
        console.log(
          "[SelectionSlice] targetNode cleared (multiple or no selection)"
        );
      } else {
        const selectedNode = nodes[0];
        // 只有在非拖拽状态下才更新目标节点
        if (!selectedNode.dragging || state.targetNode === null) {
          newState.targetNode = selectedNode;
          console.log("[SelectionSlice] targetNode updated:", {
            id: selectedNode.id,
            type: selectedNode.type,
            label: selectedNode.data?.label,
            dragging: selectedNode.dragging,
          });
        } else {
          console.log(
            "[SelectionSlice] targetNode not updated (node is dragging)"
          );
        }
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
        console.log("[SelectionSlice] debounced state updated");
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
