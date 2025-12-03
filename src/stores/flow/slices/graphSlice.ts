import type { StateCreator } from "zustand";
import {
  applyNodeChanges,
  applyEdgeChanges,
  addEdge as addEdgeRF,
  type NodeChange,
  type EdgeChange,
  type Connection,
} from "@xyflow/react";
import { cloneDeep } from "lodash";
import type { FlowStore, FlowGraphState, NodeType, EdgeType } from "../types";
import {
  NodeTypeEnum,
  SourceHandleTypeEnum,
} from "../../../components/flow/nodes";
import { recoParamKeys, actionParamKeys } from "../../../core/fields";
import {
  createPipelineNode,
  createExternalNode,
  createAnchorNode,
  findNodeByLabel,
  findNodeIndexById,
  getSelectedNodes,
  calcuNodePosition,
} from "../utils/nodeUtils";
import {
  findEdgeById,
  calcuLinkOrder,
  getSelectedEdges,
} from "../utils/edgeUtils";
import { fitFlowView } from "../utils/viewportUtils";

export const createGraphSlice: StateCreator<
  FlowStore,
  [],
  [],
  FlowGraphState
> = (set, get) => ({
  // 初始状态
  nodes: [],
  edges: [],
  idCounters: {
    node: 1,
    paste: 1,
  },
  // 更新节点
  updateNodes(changes: NodeChange[]) {
    set((state) => {
      const updatedNodes = applyNodeChanges(changes, state.nodes);
      const nodes = updatedNodes as NodeType[];
      const selectedNodes = getSelectedNodes(updatedNodes as NodeType[]);
      get().updateSelection(selectedNodes, state.selectedEdges);
      return { nodes };
    });

    // 保存历史记录
    const hasRemove = changes.some((change) => change.type === "remove");
    const hasPosition = changes.some((change) => change.type === "position");
    if (hasRemove) {
      get().saveHistory(0);
    } else if (hasPosition) {
      get().saveHistory(500);
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
      let id = String(state.idCounters.node);
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
      }

      let label = labelBase + id;
      let counter = state.idCounters.node;

      while (findNodeByLabel(nodes, label)) {
        counter++;
        id = String(counter);
        label = labelBase + id;
      }

      // 创建节点
      const nodeOptions = {
        label,
        position:
          position ??
          calcuNodePosition(selectedNodes, state.viewport, state.size),
        datas: data,
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
        default:
          throw new Error(`Unknown node type: ${type}`);
      }

      // 添加连接
      if (link && selectedNodes.length > 0) {
        selectedNodes.forEach((node) => {
          if (
            node.type === NodeTypeEnum.External ||
            node.type === NodeTypeEnum.Anchor
          )
            return;
          get().addEdge({
            source: node.id,
            sourceHandle: SourceHandleTypeEnum.Next,
            target: id,
            targetHandle: "target",
          });
        });
      }

      // 添加节点
      nodes.push(newNode);

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
        idCounters: {
          ...state.idCounters,
          node: counter + 1,
        },
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
      let targetNode = { ...nodes[nodeIndex] } as any;

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
      if (state.targetNode?.id === id) {
        get().setTargetNode(targetNode);
      }

      return { nodes };
    });

    // 保存历史记录
    get().saveHistory(1000);
  },

  // 更新边
  updateEdges(changes: EdgeChange[]) {
    set((state) => {
      let edges = [...state.edges];

      // 更新前处理
      changes.forEach((change) => {
        if (change.type === "remove") {
          const removedEdge = findEdgeById(edges, change.id);
          if (removedEdge) {
            edges.forEach((edge) => {
              if (
                edge.source === removedEdge.source &&
                edge.sourceHandle === removedEdge.sourceHandle &&
                edge.label > removedEdge.label
              ) {
                edge.label--;
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
            crash = edges.find(
              (edge) =>
                edge.source === co.source &&
                edge.target === co.target &&
                edge.sourceHandle === SourceHandleTypeEnum.Error
            );
            break;
          case SourceHandleTypeEnum.Error:
            if (
              co.source === co.target &&
              co.sourceHandle === SourceHandleTypeEnum.Error
            ) {
              crash = true;
              break;
            }
            crash = edges.find(
              (edge) =>
                edge.source === co.source &&
                edge.target === co.target &&
                edge.sourceHandle === SourceHandleTypeEnum.Next
            );
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

  // 替换节点与边
  replace(nodes: NodeType[], edges: EdgeType[], options) {
    const {
      isFitView = true,
      skipHistory = false,
      skipSave = false,
    } = options || {};

    set((state) => {
      const processedNodes = nodes.map((node) => ({ ...node }));
      const processedEdges = edges.map((edge) => ({ ...edge }));

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
      let pasteCounter = state.idCounters.paste;

      nodes.forEach((node) => {
        const newId = "paste_" + pasteCounter;
        pairs[node.id] = newId;
        node.id = newId;
        node.data.label = node.data.label + "_副本" + pasteCounter;
        pasteCounter++;

        const position = node.position;
        node.position = {
          x: position.x + 100,
          y: position.y + 50,
        };
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
        nodes: [...originNodes, ...nodes],
        edges: [...originEdges, ...edges],
        idCounters: {
          ...state.idCounters,
          paste: pasteCounter,
        },
      };
    });

    // 保存历史记录
    get().saveHistory(0);
  },

  // 重置计数器
  resetCounters() {
    set({
      idCounters: {
        node: 1,
        paste: 1,
      },
    });
  },
});
