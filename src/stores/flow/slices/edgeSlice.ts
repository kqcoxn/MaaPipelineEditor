import type { StateCreator } from "zustand";
import {
  applyEdgeChanges,
  addEdge as addEdgeRF,
  type EdgeChange,
  type Connection,
} from "@xyflow/react";
import type { FlowStore, FlowEdgeState, EdgeType } from "../types";
import { SourceHandleTypeEnum } from "../../../components/flow/nodes";
import {
  findEdgeById,
  calcuLinkOrder,
  getSelectedEdges,
} from "../utils/edgeUtils";

export const createEdgeSlice: StateCreator<FlowStore, [], [], FlowEdgeState> = (
  set,
  get
) => ({
  // 初始状态
  edges: [],
  edgeControlResetKey: 0,

  // 更新边
  updateEdges(changes: EdgeChange[]) {
    set((state) => {
      let edges = [...state.edges];

      // 更新前处理
      changes.forEach((change) => {
        if (change.type === "remove") {
          const removedEdge = findEdgeById(edges, change.id);
          if (removedEdge) {
            // 检查被删除的边是否属于 next/jumpback 组
            const removedIsNextGroup =
              removedEdge.sourceHandle === SourceHandleTypeEnum.Next ||
              removedEdge.sourceHandle === SourceHandleTypeEnum.JumpBack;

            edges.forEach((edge) => {
              if (edge.source === removedEdge.source) {
                // 检查是否属于同一组
                const edgeIsNextGroup =
                  edge.sourceHandle === SourceHandleTypeEnum.Next ||
                  edge.sourceHandle === SourceHandleTypeEnum.JumpBack;

                const isSameGroup = removedIsNextGroup
                  ? edgeIsNextGroup
                  : edge.sourceHandle === removedEdge.sourceHandle;

                if (isSameGroup && edge.label > removedEdge.label) {
                  edge.label--;
                }
              }
            });
          }
        }
      });

      // 应用变更
      const updatedEdges = applyEdgeChanges(changes, edges);
      const newEdges = updatedEdges as EdgeType[];
      const selectedEdges = getSelectedEdges(updatedEdges as EdgeType[]);
      get().updateSelection(state.selectedNodes, selectedEdges);
      return { edges: newEdges };
    });

    // 保存历史记录
    const hasRemove = changes.some((change) => change.type === "remove");
    if (hasRemove) {
      get().saveHistory(0);
    }
  },

  // 更新边数据
  setEdgeData(id: string, key: string, value: any) {
    set((state) => {
      const edgeIndex = state.edges.findIndex((e) => e.id === id);
      if (edgeIndex < 0) return {};

      const edges = [...state.edges];
      const targetEdge = { ...edges[edgeIndex] };

      // 更新 attributes
      if (!targetEdge.attributes) {
        targetEdge.attributes = {};
      }

      if (value === undefined || value === null || value === false) {
        // 删除属性
        delete targetEdge.attributes[key as keyof typeof targetEdge.attributes];
        // attributes为空
        if (Object.keys(targetEdge.attributes).length === 0) {
          delete targetEdge.attributes;
        }
      } else {
        // 设置属性
        (targetEdge.attributes as any)[key] = value;
      }

      edges[edgeIndex] = targetEdge;

      // 更新选中边列表
      const selectedEdges = getSelectedEdges(edges);
      get().updateSelection(state.selectedNodes, selectedEdges);

      return { edges };
    });

    // 保存历史记录
    get().saveHistory(500);
  },

  // 更新边顺序
  setEdgeLabel(id: string, newLabel: number) {
    set((state) => {
      const edgeIndex = state.edges.findIndex((e) => e.id === id);
      if (edgeIndex < 0) return {};

      const edges = [...state.edges];
      const targetEdge = edges[edgeIndex];
      const oldLabel = targetEdge.label as number;

      if (newLabel === oldLabel) return {};

      // 检查是否是 next/jumpback 组
      const isNextGroup =
        targetEdge.sourceHandle === SourceHandleTypeEnum.Next ||
        targetEdge.sourceHandle === SourceHandleTypeEnum.JumpBack;

      // 更新其他同源同类型边的顺序
      edges.forEach((edge, index) => {
        if (edge.source === targetEdge.source) {
          // 检查是否属于同一组
          const edgeIsNextGroup =
            edge.sourceHandle === SourceHandleTypeEnum.Next ||
            edge.sourceHandle === SourceHandleTypeEnum.JumpBack;

          const isSameGroup = isNextGroup
            ? edgeIsNextGroup
            : edge.sourceHandle === targetEdge.sourceHandle;

          if (isSameGroup) {
            const label = edge.label as number;
            if (newLabel < oldLabel) {
              // 向前移动
              if (label >= newLabel && label < oldLabel) {
                edges[index] = { ...edge, label: label + 1 };
              }
            } else {
              // 向后移动
              if (label > oldLabel && label <= newLabel) {
                edges[index] = { ...edge, label: label - 1 };
              }
            }
          }
        }
      });

      // 更新目标边的顺序
      edges[edgeIndex] = { ...targetEdge, label: newLabel };

      // 更新选中边列表
      const selectedEdges = getSelectedEdges(edges);
      get().updateSelection(state.selectedNodes, selectedEdges);

      return { edges };
    });

    // 保存历史记录
    get().saveHistory(500);
  },

  // 添加边
  addEdge(co: Connection, options) {
    const { isCheck = true } = options || {};

    set((state) => {
      // 检查冲突项
      if (isCheck) {
        const edges = state.edges;
        let crash = null;

        switch (co.sourceHandle) {
          case SourceHandleTypeEnum.Next:
            // next-on_error
            crash = edges.find(
              (edge) =>
                edge.source === co.source &&
                edge.target === co.target &&
                edge.sourceHandle === SourceHandleTypeEnum.Error
            );
            // next-jumpback
            if (!crash) {
              crash = edges.find(
                (edge) =>
                  edge.source === co.source &&
                  edge.target === co.target &&
                  edge.sourceHandle === SourceHandleTypeEnum.JumpBack
              );
            }
            break;
          case SourceHandleTypeEnum.JumpBack:
            // jumpback-on_error
            crash = edges.find(
              (edge) =>
                edge.source === co.source &&
                edge.target === co.target &&
                edge.sourceHandle === SourceHandleTypeEnum.Error
            );
            // jumpback-next
            if (!crash) {
              crash = edges.find(
                (edge) =>
                  edge.source === co.source &&
                  edge.target === co.target &&
                  edge.sourceHandle === SourceHandleTypeEnum.Next
              );
            }
            break;
          case SourceHandleTypeEnum.Error:
            if (
              co.source === co.target &&
              co.sourceHandle === SourceHandleTypeEnum.Error
            ) {
              crash = true;
              break;
            }
            // on_error-next
            crash = edges.find(
              (edge) =>
                edge.source === co.source &&
                edge.target === co.target &&
                edge.sourceHandle === SourceHandleTypeEnum.Next
            );
            // on_error-jumpback
            if (!crash) {
              crash = edges.find(
                (edge) =>
                  edge.source === co.source &&
                  edge.target === co.target &&
                  edge.sourceHandle === SourceHandleTypeEnum.JumpBack
              );
            }
            break;
        }

        if (crash) return {};
      }

      // 计算链接次序
      const order = calcuLinkOrder(
        state.edges,
        co.source,
        co.sourceHandle as SourceHandleTypeEnum
      );

      const newEdge = {
        type: "marked",
        label: order,
        ...co,
      } as EdgeType;

      const newEdges = addEdgeRF(newEdge, state.edges);
      return { edges: newEdges };
    });

    // 保存历史记录
    get().saveHistory(0);
  },

  // 设置边列表
  setEdges(edges: EdgeType[]) {
    set({ edges });
  },

  // 重置所有边的控制点
  resetEdgeControls() {
    set((state) => ({ edgeControlResetKey: state.edgeControlResetKey + 1 }));
  },
});
