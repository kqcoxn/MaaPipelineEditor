import type { StateCreator } from "zustand";
import { cloneDeep } from "lodash";
import type { FlowStore, FlowGraphState, NodeType, EdgeType } from "../types";
import { NodeTypeEnum } from "../../../components/flow/nodes";
import { ensureGroupNodeOrder } from "../utils/nodeUtils";
import {
  getNodeAbsolutePosition,
  getNodeAbsoluteRect,
  toRelativePosition,
  toRelativePositionFromParentAbsolute,
} from "../utils/coordinateUtils";
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

    // 重建 anchor 引用索引
    get().rebuildAnchorReferenceIndex();

    if (!skipHistory) {
      get().saveHistory(0);
    }
  },

  // 批量粘贴
  paste(
    nodes: NodeType[],
    edges: EdgeType[],
    position?: { x: number; y: number },
  ) {
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
      const sourceNodes = ensureGroupNodeOrder([...cloneDeep(nodes), ...state.nodes]);
      const pairs: Record<string, string> = {};
      let pasteCounter = state.pasteIdCounter;

      const existingLabels = new Set(
        [...originNodes, ...nodes].map((n) => n.data.label),
      );

      let minLeft = Infinity;
      let minTop = Infinity;
      const sourceAbsolutePositions = new Map<string, { x: number; y: number }>();

      nodes.forEach((node) => {
        const originalId = node.id;
        const absolutePosition = getNodeAbsolutePosition(node, sourceNodes);
        sourceAbsolutePositions.set(originalId, absolutePosition);
        minLeft = Math.min(minLeft, absolutePosition.x);
        minTop = Math.min(minTop, absolutePosition.y);

        const newId = "paste_" + pasteCounter;
        pairs[originalId] = newId;
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
        (node as any)._originalId = originalId;
        (node as any)._originalParentId = (node as any).parentId;
      });

      const offset = position
        ? { x: position.x - minLeft, y: position.y - minTop }
        : { x: 100, y: 50 };
      const finalAbsolutePositions = new Map<string, { x: number; y: number }>();

      sourceAbsolutePositions.forEach((absolutePosition, originalId) => {
        finalAbsolutePositions.set(originalId, {
          x: absolutePosition.x + offset.x,
          y: absolutePosition.y + offset.y,
        });
      });

      // 处理parentId映射和最终位置
      const pastedNodeIds = new Set(nodes.map((n) => n.id));
      const existingGroups = state.nodes.filter(
        (n) => n.type === NodeTypeEnum.Group,
      );

      nodes.forEach((node) => {
        const originalId = (node as any)._originalId as string;
        const originalParentId = (node as any)._originalParentId;
        const finalAbsolutePosition =
          finalAbsolutePositions.get(originalId) ?? node.position;
        let shouldCheckGroupMembership = false;

        if (originalParentId) {
          const newParentId = pairs[originalParentId];

          if (newParentId && pastedNodeIds.has(newParentId)) {
            const parentAbsolutePosition =
              finalAbsolutePositions.get(originalParentId);
            if (parentAbsolutePosition) {
              (node as any).parentId = newParentId;
              node.position = toRelativePositionFromParentAbsolute(
                finalAbsolutePosition,
                parentAbsolutePosition,
              );
            } else {
              (node as any).parentId = undefined;
              node.position = { ...finalAbsolutePosition };
            }
          } else {
            (node as any).parentId = undefined;
            node.position = { ...finalAbsolutePosition };
            shouldCheckGroupMembership = true;
          }
        } else {
          (node as any).parentId = undefined;
          node.position = { ...finalAbsolutePosition };
        }

        // 检测是否应该加入现有组
        if (shouldCheckGroupMembership && existingGroups.length > 0) {
          // 检查与现有组的交集
          for (const groupNode of existingGroups) {
            const groupRect = getNodeAbsoluteRect(groupNode, state.nodes);
            const nodeRect = {
              ...finalAbsolutePosition,
              width: node.measured?.width ?? 200,
              height: node.measured?.height ?? 100,
            };

            // 检查节点中心是否在组内
            const cx = nodeRect.x + nodeRect.width / 2;
            const cy = nodeRect.y + nodeRect.height / 2;

            if (
              cx >= groupRect.x &&
              cy >= groupRect.y &&
              cx <= groupRect.x + groupRect.width &&
              cy <= groupRect.y + groupRect.height
            ) {
              // 节点中心在组内，自动加入该组
              (node as any).parentId = groupNode.id;
              node.position = toRelativePosition(
                finalAbsolutePosition,
                groupNode,
                state.nodes,
              );
              break;
            }
          }
        }

        // 清理临时属性
        delete (node as any)._originalId;
        delete (node as any)._originalParentId;
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
    targetNodeIds?: string[],
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
        direction === "horizontal" ? node.position.x : node.position.y,
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
