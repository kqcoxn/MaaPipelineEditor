import type { StateCreator } from "zustand";
import { cloneDeep } from "lodash";
import type { FlowStore, FlowGraphState, NodeType, EdgeType } from "../types";
import { NodeTypeEnum } from "../../../components/flow/nodes";
import { ensureGroupNodeOrder } from "../utils/nodeUtils";
import { fitFlowView } from "../utils/viewportUtils";
import { assignNodeOrder } from "../../fileStore";

export const createGraphSlice: StateCreator<
  FlowStore,
  [],
  [],
  FlowGraphState
> = (set, get) => ({
  // 初始状态
  pasteIdCounter: 1,

  // 替换节点与边
  replace(nodes: NodeType[], edges: EdgeType[], options) {
    const {
      isFitView = true,
      skipHistory = false,
      skipSave = false,
    } = options || {};

    set((state) => {
      let processedNodes = nodes.map((node) => ({ ...node }));
      const processedEdges = edges.map((edge) => ({ ...edge }));

      // 确保 Group 节点排在子节点之前
      processedNodes = ensureGroupNodeOrder(processedNodes);

      // 清空选择
      get().clearSelection();

      // 聚焦视图
      if (isFitView) {
        fitFlowView(state.instance, state.viewport);
      }

      return {
        nodes: processedNodes,
        edges: processedEdges,
      };
    });

    if (!skipHistory) {
      get().saveHistory(0);
    }
  },

  // 批量粘贴
  paste(nodes: NodeType[], edges: EdgeType[]) {
    if (nodes.length === 0) return;

    set((state) => {
      // 取消所有选中
      const originNodes = state.nodes.map((node) => ({
        ...node,
        selected: false,
      }));
      const originEdges = state.edges.map((edge) => ({
        ...edge,
        selected: false,
      }));

      // 克隆并更新节点数据
      nodes = cloneDeep(nodes);
      const pairs: Record<string, string> = {};
      let pasteCounter = state.pasteIdCounter;

      const existingLabels = new Set(
        [...originNodes, ...nodes].map((n) => n.data.label)
      );

      nodes.forEach((node) => {
        const newId = "paste_" + pasteCounter;
        pairs[node.id] = newId;
        node.id = newId;

        // 生成不重复的节点名
        let newLabel = node.data.label + "_副本" + pasteCounter;
        let labelCounter = pasteCounter;
        while (existingLabels.has(newLabel)) {
          labelCounter++;
          newLabel = node.data.label + "_副本" + labelCounter;
        }

        node.data.label = newLabel;
        existingLabels.add(newLabel);
        pasteCounter++;

        // 分配顺序号
        assignNodeOrder(newId);

        const position = node.position;
        node.position = {
          x: position.x + 100,
          y: position.y + 50,
        };
      });

      // 更新粘贴节点的 parentId 映射
      nodes.forEach((node) => {
        if ((node as any).parentId && pairs[(node as any).parentId]) {
          (node as any).parentId = pairs[(node as any).parentId];
        } else {
          (node as any).parentId = undefined;
        }
      });

      // 克隆并更新边数据
      edges = cloneDeep(edges);
      edges.forEach((edge) => {
        edge.source = pairs[edge.source];
        edge.target = pairs[edge.target];
        edge.id = `${edge.source}_${edge.sourceHandle}_${edge.target}`;
      });

      // 更新选择状态
      get().updateSelection(nodes, edges);

      // 自动聚焦（暂时硬编码）
      fitFlowView(state.instance, state.viewport, { focusNodes: nodes });

      return {
        nodes: ensureGroupNodeOrder([...originNodes, ...nodes]),
        edges: [...originEdges, ...edges],
        pasteIdCounter: pasteCounter,
      };
    });

    // 保存历史记录
    get().saveHistory(0);
  },

  // 重置粘贴计数器
  resetPasteCounter() {
    set({ pasteIdCounter: 1 });
  },

  // 移动节点
  shiftNodes(
    direction: "horizontal" | "vertical",
    delta: number,
    targetNodeIds?: string[]
  ) {
    set((state) => {
      if (state.nodes.length === 0) return {};

      // 确定要调整的节点
      const targetNodes = targetNodeIds
        ? state.nodes.filter((node) => targetNodeIds.includes(node.id))
        : state.nodes;
      if (targetNodes.length === 0) return {};

      // 找到最左上侧的节点位置作为基准点
      const positions = targetNodes.map((node) =>
        direction === "horizontal" ? node.position.x : node.position.y
      );
      const minPosition = Math.min(...positions);
      const targetNodeIdSet = new Set(targetNodes.map((n) => n.id));

      // 根据距离基准点的距离计算移动量
      const nodes = state.nodes.map((node) => {
        if (!targetNodeIdSet.has(node.id)) {
          return node;
        }

        const currentPosition =
          direction === "horizontal" ? node.position.x : node.position.y;
        const distanceFromBase = currentPosition - minPosition;

        const scaleFactor = distanceFromBase / 100;
        const offset = scaleFactor * delta;

        const newPosition = { ...node.position };
        if (direction === "horizontal") {
          newPosition.x += offset;
        } else {
          newPosition.y += offset;
        }
        return { ...node, position: newPosition };
      });
      return { nodes };
    });

    // 保存历史记录
    get().saveHistory(0);
  },
});
