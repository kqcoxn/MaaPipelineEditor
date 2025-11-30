import type { StateCreator } from "zustand";
import type { FlowStore, FlowHistoryState, NodeType, EdgeType } from "../types";

// 快速序列化状态（排除 UI 状态）
function serializeState(nodes: NodeType[], edges: EdgeType[]): string {
  const cleanNodes = nodes.map((node) => ({
    id: node.id,
    type: node.type,
    data: node.data,
    position: node.position,
    measured: node.measured,
  }));
  const cleanEdges = edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    sourceHandle: edge.sourceHandle,
    target: edge.target,
    targetHandle: edge.targetHandle,
    label: edge.label,
  }));
  return JSON.stringify({ nodes: cleanNodes, edges: cleanEdges });
}

// 快速克隆
function fastClone<T>(data: T): T {
  if (typeof structuredClone !== "undefined") {
    try {
      return structuredClone(data);
    } catch (e) {
      // 降级到 JSON 方式
    }
  }
  return JSON.parse(JSON.stringify(data));
}

export const createHistorySlice: StateCreator<
  FlowStore,
  [],
  [],
  FlowHistoryState
> = (set, get) => ({
  // 初始状态
  historyStack: [],
  historyIndex: -1,
  saveTimeout: null,
  lastSnapshot: null,

  // 保存历史记录
  saveHistory(delay: number = 500) {
    const state = get();

    // 清除旧的超时
    if (state.saveTimeout) {
      clearTimeout(state.saveTimeout);
    }

    const timeout = setTimeout(() => {
      const currentState = get();
      
      // 获取历史限制配置
      const limit = 100;

      // 差异检测
      const currentStateStr = serializeState(
        currentState.nodes,
        currentState.edges
      );
      if (currentState.lastSnapshot === currentStateStr) {
        set({ saveTimeout: null });
        return;
      }

      const snapshot = {
        nodes: fastClone(currentState.nodes),
        edges: fastClone(currentState.edges),
      };

      set((state) => {
        let newStack = [...state.historyStack];
        let newIndex = state.historyIndex;

        // 如果当前不在栈顶，删除后面的记录
        if (newIndex < newStack.length - 1) {
          newStack = newStack.slice(0, newIndex + 1);
        }

        // 添加新记录
        newStack.push(snapshot);

        // 限制历史记录数量
        if (newStack.length > limit) {
          newStack.shift();
        } else {
          newIndex++;
        }

        return {
          historyStack: newStack,
          historyIndex: newIndex,
          lastSnapshot: currentStateStr,
          saveTimeout: null,
        };
      });
    }, delay) as unknown as number;

    set({ saveTimeout: timeout });
  },

  // 撤销
  undo() {
    const state = get();
    if (state.historyIndex <= 0) return false;

    // 清除保存超时
    if (state.saveTimeout) {
      clearTimeout(state.saveTimeout);
      set({ saveTimeout: null });
    }

    const newIndex = state.historyIndex - 1;
    const snapshot = state.historyStack[newIndex];

    // 清除选中状态
    const nodes = fastClone(snapshot.nodes).map((node: NodeType) => ({
      ...node,
      selected: false,
    }));
    const edges = fastClone(snapshot.edges).map((edge: EdgeType) => ({
      ...edge,
      selected: false,
    }));

    // 更新状态
    const newSnapshot = serializeState(nodes, edges);
    set({
      historyIndex: newIndex,
      lastSnapshot: newSnapshot,
    });

    // 调用 replace 更新图数据（不保存历史）
    get().replace(nodes, edges, {
      isFitView: false,
      skipHistory: true,
    });

    return true;
  },

  // 重做
  redo() {
    const state = get();
    if (state.historyIndex >= state.historyStack.length - 1) return false;

    // 清除保存超时
    if (state.saveTimeout) {
      clearTimeout(state.saveTimeout);
      set({ saveTimeout: null });
    }

    const newIndex = state.historyIndex + 1;
    const snapshot = state.historyStack[newIndex];

    // 清除选中状态
    const nodes = fastClone(snapshot.nodes).map((node: NodeType) => ({
      ...node,
      selected: false,
    }));
    const edges = fastClone(snapshot.edges).map((edge: EdgeType) => ({
      ...edge,
      selected: false,
    }));

    // 更新状态
    const newSnapshot = serializeState(nodes, edges);
    set({
      historyIndex: newIndex,
      lastSnapshot: newSnapshot,
    });

    // 调用 replace 更新图数据（不保存历史）
    get().replace(nodes, edges, {
      isFitView: false,
      skipHistory: true,
    });

    return true;
  },

  // 初始化历史记录
  initHistory(nodes: NodeType[], edges: EdgeType[]) {
    const snapshot = {
      nodes: fastClone(nodes),
      edges: fastClone(edges),
    };
    const snapshotStr = serializeState(nodes, edges);

    set({
      historyStack: [snapshot],
      historyIndex: 0,
      lastSnapshot: snapshotStr,
      saveTimeout: null,
    });
  },

  // 清空历史记录
  clearHistory() {
    const state = get();
    if (state.saveTimeout) {
      clearTimeout(state.saveTimeout);
    }

    set({
      historyStack: [],
      historyIndex: -1,
      lastSnapshot: null,
      saveTimeout: null,
    });
  },

  // 获取历史状态
  getHistoryState() {
    const state = get();
    return {
      canUndo: state.historyIndex > 0,
      canRedo: state.historyIndex < state.historyStack.length - 1,
    };
  },
});
