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

      // 先处理基本的节点信息
      const allNodes = [...state.nodes];

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

        // 处理坐标系统转换
        let finalPosition = { ...node.position };
        let finalParentId = (node as any).parentId;

        // 组内节点
        if (finalParentId) {
          // 查找原来的父节点以获取其绝对位置
          const originalParent = allNodes.find((n) => n.id === finalParentId);
          if (originalParent) {
            // 将相对坐标转换为绝对坐标用于粘贴
            finalPosition = {
              x: node.position.x + originalParent.position.x,
              y: node.position.y + originalParent.position.y,
            };
            // 在粘贴时决定是否保持组关系
          } else {
            // 父节点不存在，清除parentId
            finalParentId = undefined;
          }
        }

        // 保存处理后的信息
        (node as any)._processedPosition = finalPosition;
        (node as any)._processedParentId = finalParentId;
        (node as any)._originalParentId = (node as any).parentId;
      });

      // 处理parentId映射和最终位置
      const pastedNodeIds = new Set(nodes.map((n) => n.id));
      const existingGroups = state.nodes.filter(
        (n) => n.type === NodeTypeEnum.Group
      );

      nodes.forEach((node) => {
        const originalParentId = (node as any)._originalParentId;
        const processedPosition = (node as any)._processedPosition;

        let shouldCheckGroupMembership = false;
        let finalPosition = { ...processedPosition };

        if (originalParentId) {
          const newParentId = pairs[originalParentId];

          if (newParentId && pastedNodeIds.has(newParentId)) {
            (node as any).parentId = newParentId;
            // 转换回相对坐标
            const newParentNode = nodes.find((n) => n.id === newParentId);
            if (newParentNode) {
              node.position = {
                x: processedPosition.x - newParentNode.position.x,
                y: processedPosition.y - newParentNode.position.y,
              };
            } else {
              node.position = { ...processedPosition };
            }
          } else {
            // 父节点没有被粘贴
            (node as any).parentId = undefined;
            finalPosition = {
              x: processedPosition.x + 100,
              y: processedPosition.y + 50,
            };
            node.position = { ...finalPosition };
            shouldCheckGroupMembership = true;
          }
        } else {
          // 普通节点
          finalPosition = {
            x: processedPosition.x + 100,
            y: processedPosition.y + 50,
          };
          node.position = { ...finalPosition };
        }

        // 检测是否应该加入现有组
        if (shouldCheckGroupMembership && existingGroups.length > 0) {
          // 模拟节点对象用于组检测
          const simulatedNode = {
            ...node,
            position: finalPosition,
            measured: node.measured || { width: 200, height: 100 },
          };

          // 检查与现有组的交集
          for (const groupNode of existingGroups) {
            const pw =
              (groupNode as any).style?.width ??
              groupNode.measured?.width ??
              400;
            const ph =
              (groupNode as any).style?.height ??
              groupNode.measured?.height ??
              300;
            const nx = finalPosition.x;
            const ny = finalPosition.y;
            const nw = simulatedNode.measured?.width ?? 200;
            const nh = simulatedNode.measured?.height ?? 100;

            // 检查节点中心是否在组内
            const cx = nx + nw / 2;
            const cy = ny + nh / 2;

            if (
              cx >= groupNode.position.x &&
              cy >= groupNode.position.y &&
              cx <= groupNode.position.x + pw &&
              cy <= groupNode.position.y + ph
            ) {
              // 节点中心在组内，自动加入该组
              (node as any).parentId = groupNode.id;
              // 转换为相对坐标
              node.position = {
                x: finalPosition.x - groupNode.position.x,
                y: finalPosition.y - groupNode.position.y,
              };
              break;
            }
          }
        }

        // 清理临时属性
        delete (node as any)._processedPosition;
        delete (node as any)._processedParentId;
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
