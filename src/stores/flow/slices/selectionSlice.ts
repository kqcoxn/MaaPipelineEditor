import type { StateCreator } from "zustand";
import type {
  FlowStore,
  FlowSelectionState,
  NodeType,
  EdgeType,
} from "../types";
import { NodeTypeEnum } from "../../../components/flow/nodes";

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
        // 多选或无选择时清空目标节点
        newState.targetNode = null;
      } else {
        const selectedNode = nodes[0];
        // 只有在非拖拽状态下才更新目标节点
        if (!selectedNode.dragging || state.targetNode === null) {
          // 从最新的 nodes 数组中获取节点数据
          const latestNode = state.nodes.find((n) => n.id === selectedNode.id);
          newState.targetNode = latestNode || selectedNode;
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
      }, 400);

      return newState;
    });

    // 单选 Anchor 节点时，高亮引用该 anchor 的节点
    if (nodes.length === 1 && nodes[0].type === NodeTypeEnum.Anchor) {
      const anchorLabel = nodes[0].data.label;
      get().setSelectedAnchorName(anchorLabel);
    } else {
      // 非单选 Anchor 节点时清除高亮
      get().setSelectedAnchorName(null);
    }
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
