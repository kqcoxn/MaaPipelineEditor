import type { StateCreator } from "zustand";
import type { FlowStore, FlowHistoryState, NodeType, EdgeType } from "../types";
import {
  useOperationLogStore,
  type OperationDescriptor,
} from "../../operationLogStore";

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
    attributes: edge.attributes,
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
  saveHistory(delay: number = 500, opDescriptor?: OperationDescriptor) {
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

      // 写入操作日志（仅在有实际变化时）
      if (opDescriptor) {
        useOperationLogStore.getState().addLog({
          category: opDescriptor.category,
          action: opDescriptor.action,
          description: opDescriptor.description,
          targetIds: opDescriptor.targetIds,
        });
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

  // 导入历史记录（追加模式，保留撤销能力）
  // 与 initHistory 不同，此方法不清空历史栈，
  // 而是将导入前状态和导入后状态依次追加，使 undo 可以回到导入前
  importHistory(nodes: NodeType[], edges: EdgeType[]) {
    const state = get();

    // 清除待保存的超时
    if (state.saveTimeout) {
      clearTimeout(state.saveTimeout);
    }

    const importSnapshotStr = serializeState(nodes, edges);
    const importSnapshot = {
      nodes: fastClone(nodes),
      edges: fastClone(edges),
    };

    set((state) => {
      let newStack = [...state.historyStack];
      let newIndex = state.historyIndex;

      // 如果历史栈为空，直接初始化（与 initHistory 行为一致）
      if (newStack.length === 0) {
        return {
          historyStack: [importSnapshot],
          historyIndex: 0,
          lastSnapshot: importSnapshotStr,
          saveTimeout: null,
        };
      }

      // 截断 redo 分支
      if (newIndex < newStack.length - 1) {
        newStack = newStack.slice(0, newIndex + 1);
      }

      // 如果当前画布有内容，且与栈顶不同，先把当前状态（导入前）压入栈
      // 这样 undo 可以回到导入前的状态
      if (state.nodes.length > 0) {
        const currentStr = serializeState(state.nodes, state.edges);
        if (currentStr !== state.lastSnapshot) {
          const currentSnapshot = {
            nodes: fastClone(state.nodes),
            edges: fastClone(state.edges),
          };
          newStack.push(currentSnapshot);
          if (newStack.length > 100) {
            newStack.shift();
          } else {
            newIndex++;
          }
        }
      }

      // 添加导入后的状态
      newStack.push(importSnapshot);
      if (newStack.length > 100) {
        newStack.shift();
      } else {
        newIndex++;
      }

      return {
        historyStack: newStack,
        historyIndex: newIndex,
        lastSnapshot: importSnapshotStr,
        saveTimeout: null,
      };
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
