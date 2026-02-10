import type { StateCreator } from "zustand";
import { applyNodeChanges, type NodeChange } from "@xyflow/react";
import type {
  FlowStore,
  FlowNodeState,
  NodeType,
  PipelineNodeType,
  GroupNodeType,
} from "../types";
import {
  NodeTypeEnum,
  SourceHandleTypeEnum,
  TargetHandleTypeEnum,
} from "../../../components/flow/nodes";
import { recoParamKeys, actionParamKeys } from "../../../core/fields";
import {
  createPipelineNode,
  createExternalNode,
  createAnchorNode,
  createStickerNode,
  createGroupNode,
  findNodeByLabel,
  findNodeById,
  findNodeIndexById,
  calcuNodePosition,
  checkRepeatNodeLabelList as checkRepeatNodeLabelListUtil,
  ensureGroupNodeOrder,
} from "../utils/nodeUtils";
import { fitFlowView } from "../utils/viewportUtils";
import { assignNodeOrder, removeNodeOrder } from "../../fileStore";
import { ErrorTypeEnum, useErrorStore } from "../../errorStore";
import { useConfigStore } from "../../configStore";
import { useFileStore } from "../../fileStore";

export const createNodeSlice: StateCreator<FlowStore, [], [], FlowNodeState> = (
  set,
  get
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

    set((state) => {
      // 如果删除的节点中包含 Group 节点，先将其子节点脱离
      if (removedIds.size > 0) {
        const groupsToRemove = state.nodes.filter(
          (n) => removedIds.has(n.id) && n.type === NodeTypeEnum.Group
        );
        if (groupsToRemove.length > 0) {
          const groupIds = new Set(groupsToRemove.map((g) => g.id));
          const groupPosMap = new Map(
            groupsToRemove.map((g) => [g.id, g.position])
          );
          // 在 apply 之前先脱离子节点
          state = {
            ...state,
            nodes: state.nodes.map((node) => {
              const parentId = (node as any).parentId;
              if (parentId && groupIds.has(parentId)) {
                const groupPos = groupPosMap.get(parentId)!;
                return {
                  ...node,
                  parentId: undefined,
                  position: {
                    x: node.position.x + groupPos.x,
                    y: node.position.y + groupPos.y,
                  },
                };
              }
              return node;
            }),
          };
        }
      }

      const updatedNodes = applyNodeChanges(changes, state.nodes);
      const nodes = updatedNodes as NodeType[];

      const updates: Partial<typeof state> = { nodes };

      // 清理被删除节点的选中状态
      if (removedIds.size > 0) {
        // 检查 targetNode 是否被删除
        if (state.targetNode && removedIds.has(state.targetNode.id)) {
          updates.targetNode = null;
          updates.debouncedTargetNode = null;
        }

        // 清理 selectedNodes 中被删除的节点
        const filteredSelectedNodes = state.selectedNodes.filter(
          (node) => !removedIds.has(node.id)
        );
        if (filteredSelectedNodes.length !== state.selectedNodes.length) {
          updates.selectedNodes = filteredSelectedNodes;
          updates.debouncedSelectedNodes = filteredSelectedNodes;
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
    const isDragging = changes.some(
      (change) => change.type === "position" && change.dragging
    );

    if (hasRemove) {
      get().saveHistory(0);
    } else if (hasPosition) {
      get().saveHistory(isDragging ? 1000 : 0);
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

    set((state) => {
      const selectedNodes = state.selectedNodes;
      let nodes = [...state.nodes];

      // 取消所有选中
      if (select) {
        nodes = nodes.map((node) => ({ ...node, selected: false }));
      }

      // 生成 ID 和 label
      let id = String(state.nodeIdCounter);
      let labelBase;
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
          break;
        case NodeTypeEnum.Group:
          labelBase = "分组";
          break;
      }

      let label = labelBase + id;
      let counter = state.nodeIdCounter;

      while (findNodeByLabel(nodes, label) || findNodeById(nodes, id)) {
        counter++;
        id = String(counter);
        label = labelBase + id;
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
          calcuNodePosition(selectedNodes, state.viewport, state.size),
        datas: {
          ...data,
          handleDirection,
        },
        select,
      };

      let newNode: NodeType;
      switch (type) {
        case NodeTypeEnum.Pipeline:
          newNode = createPipelineNode(id, nodeOptions);
          break;
        case NodeTypeEnum.External:
          newNode = createExternalNode(id, nodeOptions);
          break;
        case NodeTypeEnum.Anchor:
          newNode = createAnchorNode(id, nodeOptions);
          break;
        case NodeTypeEnum.Sticker:
          newNode = createStickerNode(id, {
            label,
            position: nodeOptions.position,
            select: nodeOptions.select,
            datas: data,
          });
          break;
        case NodeTypeEnum.Group:
          newNode = createGroupNode(id, {
            label,
            position: nodeOptions.position,
            select: nodeOptions.select,
            datas: data,
          });
          break;
        default:
          throw new Error(`Unknown node type: ${type}`);
      }

      // 添加连接
      if (link && type !== NodeTypeEnum.Sticker && type !== NodeTypeEnum.Group && selectedNodes.length > 0) {
        selectedNodes.forEach((node) => {
          if (
            node.type === NodeTypeEnum.External ||
            node.type === NodeTypeEnum.Anchor ||
            node.type === NodeTypeEnum.Sticker
          )
            return;
          get().addEdge({
            source: node.id,
            sourceHandle: SourceHandleTypeEnum.Next,
            target: id,
            targetHandle: TargetHandleTypeEnum.Target,
          });
        });
      }

      // 添加节点
      nodes.push(newNode);

      // 分配顺序号
      assignNodeOrder(id);

      // 更新选择状态
      if (select) {
        get().updateSelection([newNode], []);
      }

      // 聚焦
      if (focus) {
        fitFlowView(state.instance, state.viewport, { focusNodes: [newNode] });
      }

      return {
        nodes,
        nodeIdCounter: counter + 1,
      };
    });

    // 保存历史记录
    get().saveHistory(0);
  },

  // 更新节点数据
  setNodeData(id: string, type: string, key: string, value: any) {
    set((state) => {
      const nodeIndex = findNodeIndexById(state.nodes, id);
      if (nodeIndex < 0) return {};

      let nodes = [...state.nodes];
      const originalNode = nodes[nodeIndex] as any;

      // 深拷贝节点
      let targetNode = {
        ...originalNode,
        data: {
          ...originalNode.data,
          recognition: originalNode.data.recognition
            ? {
                ...originalNode.data.recognition,
                param: { ...originalNode.data.recognition.param },
              }
            : undefined,
          action: originalNode.data.action
            ? {
                ...originalNode.data.action,
                param: { ...originalNode.data.action.param },
              }
            : undefined,
          others: originalNode.data.others
            ? { ...originalNode.data.others }
            : undefined,
        },
      };

      // 数据处理
      if (Array.isArray(value)) value = [...value];

      // 更新节点数据
      if (type === "recognition" || type === "action") {
        // 识别与动作字段
        if (value === "__mpe_delete") {
          delete targetNode.data[type].param[key];
        } else {
          targetNode.data[type].param[key] = value;
        }
      } else if (type === "type") {
        // 识别与动作类型
        const field = targetNode.data[key];
        field.type = value;
        const fieldParamKeys =
          key === "recognition" ? recoParamKeys[value] : actionParamKeys[value];

        // 删除不存在的字段
        const curKeys = Object.keys(field.param);
        curKeys.forEach((paramKey) => {
          if (!fieldParamKeys.all.includes(paramKey)) {
            delete field.param[paramKey];
          }
        });

        // 添加必选字段
        fieldParamKeys.requires.forEach((req, index) => {
          if (!(req in field.param)) {
            field.param[req] = fieldParamKeys.required_default[index];
          }
        });
      } else if (type === "others") {
        // 其他字段
        if (value === "__mpe_delete") {
          delete targetNode.data.others[key];
        } else {
          targetNode.data.others[key] = value;
        }
      } else {
        // 其他类型
        targetNode.data[key] = value;
      }

      nodes[nodeIndex] = targetNode;

      // 更新目标节点
      const updates: any = { nodes };
      if (state.targetNode?.id === id) {
        updates.targetNode = targetNode;
      }

      return updates;
    });

    // 检查节点名重复
    const configs = useConfigStore.getState().configs;
    const fileConfig = useFileStore.getState().currentFile.config;
    const nodes = get().nodes;
    const repeats = checkRepeatNodeLabelListUtil(nodes, {
      isExportConfig: configs.isExportConfig,
      prefix: fileConfig.prefix,
    });
    useErrorStore.getState().setError(ErrorTypeEnum.NodeNameRepeat, () => {
      return repeats.map((label) => ({
        type: ErrorTypeEnum.NodeNameRepeat,
        msg: label,
      }));
    });

    // 保存历史记录
    get().saveHistory(1000);
  },

  // 设置节点列表
  setNodes(nodes: NodeType[]) {
    set({ nodes });
  },

  // 批量更新节点数据
  batchSetNodeData(
    id: string,
    updates: Array<{ type: string; key: string; value: any }>
  ) {
    set((state) => {
      const nodeIndex = findNodeIndexById(state.nodes, id);
      if (nodeIndex < 0) return {};

      let nodes = [...state.nodes];
      const originalNode = nodes[nodeIndex] as PipelineNodeType;

      // 深拷贝节点
      let targetNode: PipelineNodeType = {
        ...originalNode,
        data: {
          ...originalNode.data,
          recognition: originalNode.data.recognition
            ? {
                ...originalNode.data.recognition,
                param: { ...originalNode.data.recognition.param },
              }
            : { type: "DirectHit", param: {} },
          action: originalNode.data.action
            ? {
                ...originalNode.data.action,
                param: { ...originalNode.data.action.param },
              }
            : { type: "DoNothing", param: {} },
          others: originalNode.data.others
            ? { ...originalNode.data.others }
            : {},
        },
      };

      // 应用所有更新
      for (const update of updates) {
        const { type, key, value } = update;
        let processedValue = value;
        if (Array.isArray(value)) processedValue = [...value];

        if (type === "recognition" || type === "action") {
          // 识别与动作字段
          if (processedValue === "__mpe_delete") {
            delete targetNode.data[type].param[key];
          } else {
            targetNode.data[type].param[key] = processedValue;
          }
        } else if (type === "type") {
          // 识别与动作类型
          const field = targetNode.data[key as "recognition" | "action"];
          field.type = processedValue;
          const fieldParamKeys =
            key === "recognition"
              ? recoParamKeys[processedValue]
              : actionParamKeys[processedValue];

          // 删除不存在的字段
          const curKeys = Object.keys(field.param);
          curKeys.forEach((paramKey) => {
            if (!fieldParamKeys.all.includes(paramKey)) {
              delete field.param[paramKey];
            }
          });

          // 添加必选字段
          fieldParamKeys.requires.forEach((req: string, index: number) => {
            if (!(req in field.param)) {
              field.param[req] = fieldParamKeys.required_default[index];
            }
          });
        } else if (type === "others") {
          // 其他字段
          if (!targetNode.data.others) {
            targetNode.data.others = {};
          }
          if (processedValue === "__mpe_delete") {
            delete targetNode.data.others[key];
          } else {
            targetNode.data.others[key] = processedValue;
          }
        } else {
          // 其他类型
          (targetNode.data as any)[key] = processedValue;
        }
      }

      nodes[nodeIndex] = targetNode;

      // 更新目标节点
      const result: any = { nodes };
      if (state.targetNode?.id === id) {
        result.targetNode = targetNode;
      }

      return result;
    });

    // 检查节点名重复
    const configs = useConfigStore.getState().configs;
    const fileConfig = useFileStore.getState().currentFile.config;
    const nodes = get().nodes;
    const repeats = checkRepeatNodeLabelListUtil(nodes, {
      isExportConfig: configs.isExportConfig,
      prefix: fileConfig.prefix,
    });
    useErrorStore.getState().setError(ErrorTypeEnum.NodeNameRepeat, () => {
      return repeats.map((label) => ({
        type: ErrorTypeEnum.NodeNameRepeat,
        msg: label,
      }));
    });

    // 保存历史记录
    get().saveHistory(1000);
  },

  // 重置节点计数器
  resetNodeCounter() {
    set({ nodeIdCounter: 1 });
  },

  // 将选中节点创建为分组
  groupSelectedNodes() {
    set((state) => {
      const selected = state.selectedNodes.filter(
        (n) => n.type !== NodeTypeEnum.Group
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
        // 如果节点有 parentId，需转换为绝对坐标
        const absPos = { ...node.position };
        if ((node as any).parentId) {
          const parent = state.nodes.find(
            (n) => n.id === (node as any).parentId
          );
          if (parent) {
            absPos.x += parent.position.x;
            absPos.y += parent.position.y;
          }
        }
        minX = Math.min(minX, absPos.x);
        minY = Math.min(minY, absPos.y);
        maxX = Math.max(maxX, absPos.x + w);
        maxY = Math.max(maxY, absPos.y + h);
      });

      const groupX = minX - PADDING;
      const groupY = minY - PADDING - HEADER_HEIGHT;
      const groupW = maxX - minX + PADDING * 2;
      const groupH = maxY - minY + PADDING * 2 + HEADER_HEIGHT;

      // 生成 Group ID
      let counter = state.nodeIdCounter;
      let groupId = "group_" + counter;
      while (findNodeById(state.nodes, groupId)) {
        counter++;
        groupId = "group_" + counter;
      }

      const groupNode = createGroupNode(groupId, {
        label: "分组" + counter,
        position: { x: groupX, y: groupY },
        style: { width: groupW, height: groupH },
      });

      assignNodeOrder(groupId);

      // 将选中节点设为 Group 子节点，位置转为相对坐标
      const selectedIds = new Set(selected.map((n) => n.id));
      let nodes = state.nodes.map((node) => {
        if (!selectedIds.has(node.id)) return node;
        // 计算绝对位置
        const absPos = { ...node.position };
        if ((node as any).parentId) {
          const parent = state.nodes.find(
            (n) => n.id === (node as any).parentId
          );
          if (parent) {
            absPos.x += parent.position.x;
            absPos.y += parent.position.y;
          }
        }
        return {
          ...node,
          parentId: groupId,
          position: {
            x: absPos.x - groupX,
            y: absPos.y - groupY,
          },
        };
      });

      nodes.push(groupNode);

      // 确保 Group 节点在子节点之前
      nodes = ensureGroupNodeOrder(nodes);

      return {
        nodes,
        nodeIdCounter: counter + 1,
      };
    });

    get().saveHistory(0);
  },

  // 解散分组
  ungroupNodes(groupId: string) {
    set((state) => {
      const groupNode = findNodeById(state.nodes, groupId);
      if (!groupNode || groupNode.type !== NodeTypeEnum.Group) return {};

      const groupPos = groupNode.position;

      // 将子节点的位置转为绝对坐标，清除 parentId
      const nodes = state.nodes
        .filter((n) => n.id !== groupId)
        .map((node) => {
          if ((node as any).parentId !== groupId) return node;
          return {
            ...node,
            parentId: undefined,
            position: {
              x: node.position.x + groupPos.x,
              y: node.position.y + groupPos.y,
            },
          };
        });

      // 清理被删除节点的选中状态
      const updates: any = { nodes };
      if (state.targetNode?.id === groupId) {
        updates.targetNode = null;
        updates.debouncedTargetNode = null;
      }

      return updates;
    });

    removeNodeOrder(groupId);
    get().saveHistory(0);
  },

  // 将节点加入分组
  attachNodeToGroup(nodeId: string, groupId: string) {
    set((state) => {
      const groupNode = findNodeById(state.nodes, groupId);
      if (!groupNode || groupNode.type !== NodeTypeEnum.Group) return {};

      let nodes = state.nodes.map((node) => {
        if (node.id !== nodeId) return node;
        // 转为相对坐标
        return {
          ...node,
          parentId: groupId,
          position: {
            x: node.position.x - groupNode.position.x,
            y: node.position.y - groupNode.position.y,
          },
        };
      });

      nodes = ensureGroupNodeOrder(nodes);
      return { nodes };
    });

    get().saveHistory(0);
  },

  // 将节点从分组中移出
  detachNodeFromGroup(nodeId: string) {
    set((state) => {
      const node = findNodeById(state.nodes, nodeId);
      if (!node || !(node as any).parentId) return {};

      const parentId = (node as any).parentId;
      const parentNode = findNodeById(state.nodes, parentId);
      if (!parentNode) return {};

      const nodes = state.nodes.map((n) => {
        if (n.id !== nodeId) return n;
        return {
          ...n,
          parentId: undefined,
          position: {
            x: n.position.x + parentNode.position.x,
            y: n.position.y + parentNode.position.y,
          },
        };
      });

      return { nodes };
    });

    get().saveHistory(0);
  },
});
