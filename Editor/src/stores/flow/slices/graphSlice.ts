import type { StateCreator } from "zustand";
import { cloneDeep } from "lodash";
import type { FlowStore, FlowGraphState, NodeType, EdgeType } from "../types";
import { NodeTypeEnum } from "../../../components/flow/nodes";
import { ensureGroupNodeOrder } from "../utils/nodeUtils";
import {
  getNodeAbsolutePosition,
  getNodeAbsoluteRect,
  toRelativePositionFromParentAbsolute,
} from "../utils/coordinateUtils";
import { fitFlowView } from "../utils/viewportUtils";
import { assignNodeOrders } from "@/stores/project/fileStore";
import {
  buildEdgeIndexes,
  buildNodeIndexes,
  bumpGraphRevisions,
  createNodeIndexPatches,
  patchNodeIndexes,
} from "../utils/graphIndex";
import {
  allocateNodeId,
  getNextNodeIdCounter,
} from "../utils/nodeId";
import {
  allocateEdgeId,
  getNextEdgeIdCounter,
} from "../utils/edgeId";
import {
  runWithProcess,
  shouldShowBulkProcess,
  type ProcessUpdate,
  yieldToBrowserPaint,
} from "@/stores/ui/processStore";

function createCopyLabel(
  sourceLabel: string,
  existingLabels: Set<string>,
): string {
  let suffix = 1;
  let label = `${sourceLabel}_副本${suffix}`;

  while (existingLabels.has(label)) {
    suffix += 1;
    label = `${sourceLabel}_副本${suffix}`;
  }

  existingLabels.add(label);
  return label;
}

export const createGraphSlice: StateCreator<
  FlowStore,
  [],
  [],
  FlowGraphState
> = (set, get) => ({
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

      // 聚焦视图
      if (isFitView) {
        fitFlowView(state.instance, state.viewport);
      }

      return {
        nodes: processedNodes,
        edges: processedEdges,
        ...buildNodeIndexes(processedNodes),
        ...buildEdgeIndexes(processedEdges),
        ...bumpGraphRevisions(state, {
          layout: true,
          topology: true,
          semantic: true,
        }),
        nodeIdCounter: getNextNodeIdCounter(
          processedNodes.map((node) => node.id),
          state.nodeIdCounter,
        ),
        edgeIdCounter: getNextEdgeIdCounter(
          processedEdges.map((edge) => edge.id),
          state.edgeIdCounter,
        ),
      };
    });
    get().clearSelection();

    if (!skipHistory) {
      get().saveHistory(0, {
        category: "graph",
        action: "replace",
        description: "替换画布",
      });
    }
  },

  // 批量粘贴
  async paste(
    sourceNodesToPaste: NodeType[],
    sourceEdgesToPaste: EdgeType[],
    position?: { x: number; y: number },
    skipProcessFeedback = false,
  ) {
    if (sourceNodesToPaste.length === 0) return [];

    const executePaste = async (
      updateProcess?: (update: ProcessUpdate) => void,
    ): Promise<NodeType[]> => {
      const state = get();
      const totalNodes = sourceNodesToPaste.length;

      // 取消所有选中
      const originNodes = state.nodes.map((node) => ({
        ...node,
        selected: false,
      }));
      const originEdges = state.edges.map((edge) => ({
        ...edge,
        selected: false,
      }));

      const pastedNodes = cloneDeep(sourceNodesToPaste);

      const sourceNodes = ensureGroupNodeOrder([
        ...pastedNodes,
        ...state.nodes,
      ]);
      const sourceNodeById = new Map(
        sourceNodes.map((node) => [node.id, node]),
      );
      const pairs: Record<string, string> = {};
      let nodeIdCounter = state.nodeIdCounter;
      let edgeIdCounter = state.edgeIdCounter;

      const existingLabels = new Set(
        [...originNodes, ...pastedNodes].map((node) => node.data.label),
      );
      const existingIds = new Set(originNodes.map((node) => node.id));
      let minLeft = Infinity;
      let minTop = Infinity;
      const sourceAbsolutePositions = new Map<
        string,
        { x: number; y: number }
      >();

      pastedNodes.forEach((node) => {
        const originalId = node.id;
        node.selected = true;
        const absolutePosition = getNodeAbsolutePosition(
          node,
          sourceNodeById,
        );
        sourceAbsolutePositions.set(originalId, absolutePosition);
        minLeft = Math.min(minLeft, absolutePosition.x);
        minTop = Math.min(minTop, absolutePosition.y);

        const idAllocation = allocateNodeId(
          (nodeId) => existingIds.has(nodeId),
          nodeIdCounter,
        );
        nodeIdCounter = idAllocation.nextCounter;
        existingIds.add(idAllocation.id);
        pairs[originalId] = idAllocation.id;
        node.id = idAllocation.id;

        const isReplica =
          node.type === NodeTypeEnum.External ||
          node.type === NodeTypeEnum.Anchor;
        if (!isReplica) {
          node.data.label = createCopyLabel(
            node.data.label,
            existingLabels,
          );
        }

        (node as any)._originalId = originalId;
        (node as any)._originalParentId = (node as any).parentId;
      });
      assignNodeOrders(pastedNodes.map((node) => node.id));

      const offset = position
        ? { x: position.x - minLeft, y: position.y - minTop }
        : { x: 100, y: 50 };
      const finalAbsolutePositions = new Map<
        string,
        { x: number; y: number }
      >();
      sourceAbsolutePositions.forEach((absolutePosition, originalId) => {
        finalAbsolutePositions.set(originalId, {
          x: absolutePosition.x + offset.x,
          y: absolutePosition.y + offset.y,
        });
      });

      const pastedNodeIds = new Set(pastedNodes.map((node) => node.id));
      const existingGroupRects = state.nodes
        .filter((node) => node.type === NodeTypeEnum.Group)
        .map((groupNode) => ({
          groupNode,
          rect: getNodeAbsoluteRect(groupNode, state.nodeById),
        }));

      pastedNodes.forEach((node) => {
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

        if (shouldCheckGroupMembership) {
          for (const { groupNode, rect } of existingGroupRects) {
            const width = node.measured?.width ?? 200;
            const height = node.measured?.height ?? 100;
            const centerX = finalAbsolutePosition.x + width / 2;
            const centerY = finalAbsolutePosition.y + height / 2;
            if (
              centerX >= rect.x &&
              centerY >= rect.y &&
              centerX <= rect.x + rect.width &&
              centerY <= rect.y + rect.height
            ) {
              (node as any).parentId = groupNode.id;
              node.position = toRelativePositionFromParentAbsolute(
                finalAbsolutePosition,
                rect,
              );
              break;
            }
          }
        }

        delete (node as any)._originalId;
        delete (node as any)._originalParentId;
      });

      const pastedEdges = cloneDeep(sourceEdgesToPaste);
      const existingEdgeIds = new Set(originEdges.map((edge) => edge.id));
      pastedEdges.forEach((edge) => {
        const idAllocation = allocateEdgeId(
          (edgeId) => existingEdgeIds.has(edgeId),
          edgeIdCounter,
        );
        edgeIdCounter = idAllocation.nextCounter;
        existingEdgeIds.add(idAllocation.id);
        edge.selected = true;
        edge.source = pairs[edge.source];
        edge.target = pairs[edge.target];
        edge.id = idAllocation.id;
      });

      updateProcess?.({ detail: "正在刷新画布", progress: 90 });
      if (updateProcess) await yieldToBrowserPaint();

      fitFlowView(state.instance, state.viewport, { focusNodes: pastedNodes });
      const nextNodes = ensureGroupNodeOrder([...originNodes, ...pastedNodes]);
      const nextEdges = [...originEdges, ...pastedEdges];
      set({
        nodes: nextNodes,
        edges: nextEdges,
        ...buildNodeIndexes(nextNodes),
        ...buildEdgeIndexes(nextEdges),
        ...bumpGraphRevisions(state, {
          layout: true,
          topology: true,
          semantic: true,
        }),
        nodeIdCounter,
        edgeIdCounter,
      });

      get().updateSelection(pastedNodes, pastedEdges);
      get().saveHistory(0, {
        category: "graph",
        action: "paste",
        description: `粘贴 ${totalNodes} 个节点`,
      });
      return pastedNodes;
    };

    if (
      shouldShowBulkProcess(sourceNodesToPaste.length) &&
      !skipProcessFeedback
    ) {
      return runWithProcess(
        "正在粘贴节点",
        executePaste,
        {
          detail: `正在复制 ${sourceNodesToPaste.length} 个节点`,
          progress: 28,
        },
      );
    }
    return executePaste();
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
      const patches = createNodeIndexPatches(state.nodes, nodes).map(
        (patch) => ({ ...patch, semanticChanged: false }),
      );
      return {
        nodes,
        ...patchNodeIndexes(state, patches),
        ...bumpGraphRevisions(state, { layout: true }),
      };
    });

    // 保存历史记录
    get().saveHistory(0, {
      category: "graph",
      action: "shift",
      description: "调整节点间距",
    });
  },
});
