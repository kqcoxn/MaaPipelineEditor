import type { StateCreator } from "zustand";
import {
  addEdge as addEdgeRF,
  applyNodeChanges,
  type NodeChange,
} from "@xyflow/react";
import type {
  EdgeType,
  FlowStore,
  FlowNodeState,
  NodeType,
} from "../types";
import {
  NodeTypeEnum,
  SourceHandleTypeEnum,
  TargetHandleTypeEnum,
} from "../../../components/flow/nodes";
import {
  createPipelineNode,
  createExternalNode,
  createAnchorNode,
  createStickerNode,
  createGroupNode,
  findNodeByLabel,
  findNodeIndexById,
  calcuNodePosition,
  ensureGroupNodeOrder,
} from "../utils/nodeUtils";
import {
  getNodeAbsolutePosition,
  toRelativePosition,
} from "../utils/coordinateUtils";
import { fitFlowView } from "../utils/viewportUtils";
import { assignNodeOrder, removeNodeOrder } from "@/stores/project/fileStore";
import { useConfigStore } from "@/stores/app/configStore";
import { checkRepeatNodeLabelList } from "../index";
import { calcuLinkOrder } from "../utils/edgeUtils";
import { applyNodeDataUpdates } from "../utils/nodeDataUtils";
import { allocateNodeId } from "../utils/nodeId";
import { createEdgeIdAllocator } from "../utils/edgeId";
import {
  buildNodeIndexes,
  buildSelectionIndexUpdate,
  bumpGraphRevisions,
  createNodeIndexPatches,
  createNodeIndexPatchesForIds,
  createEdgeIndexPatches,
  patchEdgeIndexes,
  patchNodeIndexes,
} from "../utils/graphIndex";

function getNodeChangeId(change: NodeChange): string {
  return change.type === "add" ? change.item.id : change.id;
}

export const createNodeSlice: StateCreator<FlowStore, [], [], FlowNodeState> = (
  set,
  get,
) => ({
  // 初始状态
  nodes: [],
  nodeIdCounter: 1,

  // 更新节点
  updateNodes(changes: NodeChange[]) {
    // 收集被删除的节点 ID
    const removedIds = new Set<string>();
    changes.forEach((change) => {
      if (change.type === "remove") {
        removedIds.add(change.id);
      }
    });
    // React Flow emits one position change for every pointer move. The nodes
    // array is the live layout source during the drag; defer the full node
    // index replacement until the final (dragging: false) change.
    const isActivePositionUpdate =
      changes.length > 0 &&
      changes.every(
        (change) => change.type === "position" && change.dragging === true,
      );

    set((state) => {
      if (isActivePositionUpdate) {
        const nodes = applyNodeChanges(changes, state.nodes) as NodeType[];
        return {
          nodes,
          graphRevision: state.graphRevision + 1,
          layoutRevision: state.layoutRevision + 1,
        };
      }

      const affectedNodeIds = new Set(changes.map(getNodeChangeId));
      // 如果删除的节点中包含 Group 节点，先将其子节点脱离
      if (removedIds.size > 0) {
        const groupsToRemove = state.nodes.filter(
          (n) => removedIds.has(n.id) && n.type === NodeTypeEnum.Group,
        );
        if (groupsToRemove.length > 0) {
          const groupIds = new Set(groupsToRemove.map((g) => g.id));
          // 在 apply 之前先脱离子节点
          state = {
            ...state,
            nodes: state.nodes.map((node) => {
              const parentId = (node as any).parentId;
              if (parentId && groupIds.has(parentId)) {
                affectedNodeIds.add(node.id);
                return {
                  ...node,
                  parentId: undefined,
                  position: getNodeAbsolutePosition(node, state.nodeById),
                };
              }
              return node;
            }),
          };
        }
      }

      const updatedNodes = applyNodeChanges(changes, state.nodes);
      const nodes = updatedNodes as NodeType[];
      const semanticNodeIds = new Set(
        changes
          .filter(
            (change) =>
              change.type === "add" ||
              change.type === "remove" ||
              change.type === "replace",
          )
          .map(getNodeChangeId),
      );
      const patches = createNodeIndexPatchesForIds(
        state.nodeById,
        nodes,
        affectedNodeIds,
        semanticNodeIds,
      );
      const hasTopologyChange = changes.some(
        (change) =>
          change.type === "add" ||
          change.type === "remove" ||
          change.type === "replace",
      );
      const hasSemanticChange = patches.some(
        (patch) =>
          patch.previous !== undefined &&
          patch.next !== undefined &&
          (patch.previous.type !== patch.next.type ||
            patch.previous.data !== patch.next.data),
      );
      const hasLayoutChange = changes.some(
        (change) =>
          change.type === "add" ||
          change.type === "remove" ||
          change.type === "replace" ||
          change.type === "position" ||
          change.type === "dimensions",
      );

      const updates: Partial<typeof state> = {
        nodes,
        ...patchNodeIndexes(state, patches),
        ...bumpGraphRevisions(state, {
          layout: hasLayoutChange,
          topology: hasTopologyChange,
          semantic: hasSemanticChange,
        }),
      };

      // 清理被删除节点的选中状态
      if (removedIds.size > 0) {
        // 检查 targetNode 是否被删除
        if (state.targetNode && removedIds.has(state.targetNode.id)) {
          updates.targetNode = null;
          updates.debouncedTargetNode = null;
        }

        // 清理 selectedNodes 中被删除的节点
        const filteredSelectedNodes = state.selectedNodes.filter(
          (node) => !removedIds.has(node.id),
        );
        if (filteredSelectedNodes.length !== state.selectedNodes.length) {
          updates.selectedNodes = filteredSelectedNodes;
          updates.debouncedSelectedNodes = filteredSelectedNodes;
          Object.assign(
            updates,
            buildSelectionIndexUpdate(
              state,
              filteredSelectedNodes,
              state.selectedEdges,
            ),
          );
        }
      }

      return updates;
    });

    // 清理删除节点的顺序
    removedIds.forEach((id) => {
      removeNodeOrder(id);
    });

    // 保存历史记录
    const hasRemove = changes.some((change) => change.type === "remove");
    const hasPosition = changes.some((change) => change.type === "position");
    const hasReplace = changes.some((change) => change.type === "replace");
    const hasAdd = changes.some((change) => change.type === "add");
    const hasFinishedResize = changes.some(
      (change) => change.type === "dimensions" && change.resizing === false,
    );
    const isDragging = changes.some(
      (change) => change.type === "position" && change.dragging,
    );

    if (hasRemove) {
      get().saveHistory(0, {
        category: "node",
        action: "delete",
        description: "删除节点",
        targetIds: Array.from(removedIds),
      });
      // 检查重名
      checkRepeatNodeLabelList();
    } else if (hasPosition && !isDragging) {
      get().saveHistory(0, {
        category: "node",
        action: "move",
        description: "移动节点",
      });
    } else if (hasReplace || hasAdd) {
      get().saveHistory(0, {
        category: "node",
        action: hasAdd ? "add" : "update",
        description: hasAdd ? "添加节点" : "更新节点",
      });
    } else if (hasFinishedResize) {
      get().saveHistory(0, {
        category: "group",
        action: "update",
        description: "调整分组尺寸",
      });
    }
  },

  // 添加节点
  addNode(options) {
    const {
      type = NodeTypeEnum.Pipeline,
      data,
      position,
      select = false,
      link = false,
      focus = false,
    } = options || {};

    // 获取当前状态以生成 ID
    const state = get();
    const idAllocation = allocateNodeId(
      (nodeId) => state.nodeById.has(nodeId),
      state.nodeIdCounter,
    );
    const id = idAllocation.id;
    let labelBase;
    let useNumberSuffix = true;

    switch (type) {
      case NodeTypeEnum.Pipeline:
        labelBase = "新建节点";
        break;
      case NodeTypeEnum.External:
        labelBase = "外部节点";
        break;
      case NodeTypeEnum.Anchor:
        labelBase = "重定向节点";
        break;
      case NodeTypeEnum.Sticker:
        labelBase = "便签";
        useNumberSuffix = false;
        break;
      case NodeTypeEnum.Group:
        labelBase = "分组";
        useNumberSuffix = false;
        break;
    }

    let labelCounter = idAllocation.sequence;
    let label = useNumberSuffix ? labelBase + labelCounter : labelBase;

    // 节点名称独立于内部 ID 生成，避免把创建来源或 ID 格式带入名称。
    if (useNumberSuffix) {
      while (findNodeByLabel(state.nodes, label)) {
        labelCounter += 1;
        label = labelBase + labelCounter;
      }
    }

    const finalId = id;
    let createdNode: NodeType | undefined;

    set((state) => {
      const selectedNodes = state.selectedNodes;
      let nodes = [...state.nodes];

      // 取消所有选中
      if (select) {
        nodes = nodes.map((node) => ({ ...node, selected: false }));
      }

      // 创建节点
      // 获取默认节点方向
      const defaultHandleDirection =
        useConfigStore.getState().configs.defaultHandleDirection;
      const handleDirection =
        defaultHandleDirection === "left-right"
          ? undefined
          : defaultHandleDirection;

      const nodeOptions = {
        label,
        position:
          position ??
          calcuNodePosition(selectedNodes, state.viewport, state.size, nodes),
        datas: {
          ...data,
          handleDirection,
        },
        select,
      };

      let newNode: NodeType;
      switch (type) {
        case NodeTypeEnum.Pipeline:
          newNode = createPipelineNode(finalId, nodeOptions);
          break;
        case NodeTypeEnum.External:
          newNode = createExternalNode(finalId, nodeOptions);
          break;
        case NodeTypeEnum.Anchor:
          newNode = createAnchorNode(finalId, nodeOptions);
          break;
        case NodeTypeEnum.Sticker:
          newNode = createStickerNode(finalId, {
            label,
            position: nodeOptions.position,
            select: nodeOptions.select,
            datas: data,
          });
          break;
        case NodeTypeEnum.Group:
          newNode = createGroupNode(finalId, {
            label,
            position: nodeOptions.position,
            select: nodeOptions.select,
            datas: data,
          });
          break;
        default:
          throw new Error(`Unknown node type: ${type}`);
      }

      let edges = state.edges;
      const edgeIdAllocator = createEdgeIdAllocator(
        edges.map((edge) => edge.id),
        state.edgeIdCounter,
      );
      // 添加连接
      if (
        link &&
        type !== NodeTypeEnum.Sticker &&
        type !== NodeTypeEnum.Group &&
        selectedNodes.length > 0
      ) {
        selectedNodes.forEach((node) => {
          if (
            node.type === NodeTypeEnum.External ||
            node.type === NodeTypeEnum.Anchor ||
            node.type === NodeTypeEnum.Sticker
          )
            return;
          const newEdge = {
            id: edgeIdAllocator.allocate().id,
            type: "marked",
            label: calcuLinkOrder(
              edges,
              node.id,
              SourceHandleTypeEnum.Next,
            ),
            source: node.id,
            sourceHandle: SourceHandleTypeEnum.Next,
            target: finalId,
            targetHandle: TargetHandleTypeEnum.Target,
          } as EdgeType;
          edges = addEdgeRF(newEdge, edges) as EdgeType[];
        });
      }

      // 添加节点
      nodes.push(newNode);
      createdNode = newNode;

      // 分配顺序号
      assignNodeOrder(finalId);

      // 聚焦
      if (focus) {
        fitFlowView(state.instance, state.viewport, { focusNodes: [newNode] });
      }

      return {
        nodes,
        ...(edges !== state.edges
          ? {
              edges,
              edgeIdCounter: edgeIdAllocator.getNextCounter(),
              ...patchEdgeIndexes(
                state,
                createEdgeIndexPatches(state.edges, edges),
              ),
            }
          : {}),
        ...patchNodeIndexes(state, [
          { next: newNode, semanticChanged: true },
        ]),
        ...bumpGraphRevisions(state, {
          layout: true,
          topology: true,
        }),
        nodeIdCounter: idAllocation.nextCounter,
      };
    });

    if (select && createdNode) {
      get().updateSelection([createdNode], []);
    }

    // 保存历史记录
    get().saveHistory(0, {
      category: "node",
      action: "add",
      description: `创建节点 ${label}`,
      targetIds: [finalId],
    });

    return finalId;
  },

  // 更新节点数据
  setNodeData(id: string, type: string, key: string, value: any) {
    set((state) => {
      const nodeIndex = findNodeIndexById(state.nodes, id);
      if (nodeIndex < 0) return {};

      const nodes = [...state.nodes];
      const originalNode = nodes[nodeIndex];
      const targetNode = applyNodeDataUpdates(originalNode, [
        { type, key, value },
      ]);

      nodes[nodeIndex] = targetNode;

      // 更新目标节点
      const updates: any = { nodes };
      Object.assign(
        updates,
        patchNodeIndexes(state, [
          {
            previous: originalNode,
            next: targetNode,
            semanticChanged: true,
          },
        ]),
        bumpGraphRevisions(state, { semantic: true }),
      );
      if (state.targetNode?.id === id) {
        updates.targetNode = targetNode;
      }

      return updates;
    });

    // 检查节点名重复
    checkRepeatNodeLabelList();

    // 保存历史记录
    const nodeLabel =
      get().nodeSemanticById.get(id)?.label ?? id;
    get().saveHistory(1000, {
      category: "node",
      action: "update",
      description: `修改 ${nodeLabel} 的 ${key}`,
      targetIds: [id],
    });
  },

  // 设置节点列表
  setNodes(nodes: NodeType[]) {
    set((state) => ({
      nodes,
      ...buildNodeIndexes(nodes),
      ...bumpGraphRevisions(state, {
        layout: true,
        topology: true,
        semantic: true,
      }),
    }));
  },

  // 批量更新节点数据
  batchSetNodeData(
    id: string,
    updates: Array<{ type: string; key: string; value: any }>,
  ) {
    set((state) => {
      const nodeIndex = findNodeIndexById(state.nodes, id);
      if (nodeIndex < 0) return {};

      const nodes = [...state.nodes];
      const originalNode = nodes[nodeIndex];
      const targetNode = applyNodeDataUpdates(originalNode, updates);

      nodes[nodeIndex] = targetNode;

      // 更新目标节点
      const result: any = { nodes };
      Object.assign(
        result,
        patchNodeIndexes(state, [
          {
            previous: originalNode,
            next: targetNode,
            semanticChanged: true,
          },
        ]),
        bumpGraphRevisions(state, { semantic: true }),
      );
      if (state.targetNode?.id === id) {
        result.targetNode = targetNode;
      }

      return result;
    });

    // 检查节点名重复
    checkRepeatNodeLabelList();

    // 保存历史记录
    const batchNodeLabel =
      get().nodeSemanticById.get(id)?.label ?? id;
    get().saveHistory(1000, {
      category: "node",
      action: "update",
      description: `批量修改 ${batchNodeLabel}`,
      targetIds: [id],
    });
  },

  // 重置节点计数器
  resetNodeCounter() {
    set({ nodeIdCounter: 1 });
  },

  // 将选中节点创建为分组
  groupSelectedNodes() {
    set((state) => {
      const selected = state.selectedNodes.filter(
        (n) => n.type !== NodeTypeEnum.Group,
      );
      if (selected.length === 0) return {};

      // 计算选中节点包围盒
      const PADDING = 40;
      const HEADER_HEIGHT = 36;
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      selected.forEach((node) => {
        const w = node.measured?.width ?? 200;
        const h = node.measured?.height ?? 100;
        // 获取绝对坐标
        const absPos = getNodeAbsolutePosition(node, state.nodeById);
        minX = Math.min(minX, absPos.x);
        minY = Math.min(minY, absPos.y);
        maxX = Math.max(maxX, absPos.x + w);
        maxY = Math.max(maxY, absPos.y + h);
      });

      const groupX = minX - PADDING;
      const groupY = minY - PADDING - HEADER_HEIGHT;
      const groupW = maxX - minX + PADDING * 2;
      const groupH = maxY - minY + PADDING * 2 + HEADER_HEIGHT;

      const idAllocation = allocateNodeId(
        (nodeId) => state.nodeById.has(nodeId),
        state.nodeIdCounter,
      );
      const groupId = idAllocation.id;

      const groupNode = createGroupNode(groupId, {
        label: "分组",
        position: { x: groupX, y: groupY },
        style: { width: groupW, height: groupH },
      });

      assignNodeOrder(groupId);

      // 将选中节点设为 Group 子节点，位置转为相对坐标
      const selectedIds = new Set(selected.map((n) => n.id));
      let nodes = state.nodes.map((node) => {
        if (!selectedIds.has(node.id)) return node;
        // 获取绝对位置
        const absPos = getNodeAbsolutePosition(node, state.nodeById);
        return {
          ...node,
          parentId: groupId,
          position: toRelativePosition(absPos, groupNode),
        };
      });

      nodes.push(groupNode);

      // 确保 Group 节点在子节点之前
      nodes = ensureGroupNodeOrder(nodes);
      const patches = createNodeIndexPatches(state.nodes, nodes).map(
        (patch) => ({
          ...patch,
          semanticChanged: !patch.previous || !patch.next,
        }),
      );

      return {
        nodes,
        ...patchNodeIndexes(state, patches),
        ...bumpGraphRevisions(state, {
          layout: true,
          topology: true,
        }),
        nodeIdCounter: idAllocation.nextCounter,
      };
    });

    get().saveHistory(0, {
      category: "group",
      action: "add",
      description: "创建分组",
    });
  },

  // 解散分组
  ungroupNodes(groupId: string) {
    set((state) => {
      const groupNode = state.nodeById.get(groupId);
      if (!groupNode || groupNode.type !== NodeTypeEnum.Group) return {};

      // 将子节点的位置转为绝对坐标，清除 parentId
      const nodes = state.nodes
        .filter((n) => n.id !== groupId)
        .map((node) => {
          if ((node as any).parentId !== groupId) return node;
          return {
            ...node,
            parentId: undefined,
            position: getNodeAbsolutePosition(node, state.nodeById),
          };
        });

      // 清理被删除节点的选中状态
      const updates: any = { nodes };
      const patches = createNodeIndexPatches(state.nodes, nodes).map(
        (patch) => ({
          ...patch,
          semanticChanged: !patch.previous || !patch.next,
        }),
      );
      Object.assign(
        updates,
        patchNodeIndexes(state, patches),
        bumpGraphRevisions(state, { layout: true, topology: true }),
      );
      if (state.targetNode?.id === groupId) {
        updates.targetNode = null;
        updates.debouncedTargetNode = null;
      }

      return updates;
    });

    removeNodeOrder(groupId);
    get().saveHistory(0, {
      category: "group",
      action: "delete",
      description: "解散分组",
      targetIds: [groupId],
    });
  },

  // 将节点加入分组
  attachNodeToGroup(nodeId: string, groupId: string) {
    set((state) => {
      const groupNode = state.nodeById.get(groupId);
      if (!groupNode || groupNode.type !== NodeTypeEnum.Group) return {};

      let nodes = state.nodes.map((node) => {
        if (node.id !== nodeId) return node;
        const absolutePosition = getNodeAbsolutePosition(node, state.nodeById);
        // 转为相对坐标
        return {
          ...node,
          parentId: groupId,
          position: toRelativePosition(
            absolutePosition,
            groupNode,
            state.nodeById,
          ),
        };
      });

      nodes = ensureGroupNodeOrder(nodes);
      const patches = createNodeIndexPatches(state.nodes, nodes).map(
        (patch) => ({ ...patch, semanticChanged: false }),
      );
      return {
        nodes,
        ...patchNodeIndexes(state, patches),
        ...bumpGraphRevisions(state, { layout: true }),
      };
    });

    get().saveHistory(0, {
      category: "group",
      action: "update",
      description: "加入分组",
      targetIds: [nodeId],
    });
  },

  // 将节点从分组中移出
  detachNodeFromGroup(nodeId: string) {
    set((state) => {
      const node = state.nodeById.get(nodeId);
      if (!node || !(node as any).parentId) return {};

      const nodes = state.nodes.map((n) => {
        if (n.id !== nodeId) return n;
        return {
          ...n,
          parentId: undefined,
          position: getNodeAbsolutePosition(n, state.nodeById),
        };
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

    get().saveHistory(0, {
      category: "group",
      action: "update",
      description: "移出分组",
      targetIds: [nodeId],
    });
  },
});
