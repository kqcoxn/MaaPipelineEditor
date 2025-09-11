import { create } from "zustand";
import {
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type NodeChange,
  type EdgeChange,
  type Connection,
  type ReactFlowInstance,
  type Viewport,
} from "@xyflow/react";
import { cloneDeep } from "lodash";

import { ErrorTypeEnum, findErrorsByType, useErrorStore } from "./errorStore";
import { SourceHandleTypeEnum, NodeTypeEnum } from "../components/flow/nodes";
import { useConfigStore } from "./configStore";
import { useFileStore } from "./fileStore";
import { recoParamKeys, actionParamKeys } from "../core/fields";

export type EdgeType = {
  id: string;
  source: string;
  sourceHandle: SourceHandleTypeEnum;
  target: string;
  targetHandle: "target";
  label: number;
  type: "marked";
};

type XYWH = [number, number, number, number];
export type RecognitionParamType = {
  roi?: XYWH | string;
  roi_offset?: XYWH;
  template?: string[];
  threshold?: number[];
  order_by?: string;
  index?: number;
  method?: number;
  green_mask?: boolean;
  count?: number;
  detector?: string;
  ratio?: number;
  lower?: number[][];
  upper?: number[][];
  connected?: boolean;
  expected?: string[] | number[];
  replace?: [string, string][];
  only_rec?: boolean;
  model?: string;
  labels?: string[];
  custom_recognition?: string;
  custom_recognition_param?: any;
  [key: string]: any;
};
export type ActionParamType = {
  target?: XYWH | boolean | string;
  target_offset?: XYWH;
  duration?: number;
  begin?: XYWH;
  begin_offset?: XYWH;
  end?: XYWH;
  end_offset?: XYWH;
  swipes?: any[];
  key?: number;
  input_text?: string;
  package?: string;
  exec?: string;
  args?: string[];
  detach?: boolean;
  custom_action?: string;
  custom_action_param?: any;
  [key: string]: any;
};
export type OtherParamType = {
  rate_limit?: number;
  timeout?: number;
  inverse?: boolean;
  enabled?: boolean;
  pre_delay?: number;
  post_delay?: number;
  pre_wait_freezes?: any;
  postWaitFreezes?: any;
  focus?: any;
  [key: string]: any;
};
export type ParamType = RecognitionParamType & ActionParamType & OtherParamType;
export type PipelineNodeDataType = {
  label: string;
  recognition: {
    type: string;
    param: RecognitionParamType;
  };
  action: {
    type: string;
    param: ActionParamType;
  };
  others: OtherParamType;
  extras?: any;
  type?: NodeTypeEnum;
};
export type ExternalNodeDataType = {
  label: string;
};
export type PositionType = {
  x: number;
  y: number;
};
export interface PipelineNodeType {
  id: string;
  type: NodeTypeEnum;
  data: PipelineNodeDataType;
  position: PositionType;
  dragging?: boolean;
  selected?: boolean;
  measured?: {
    width: number;
    height: number;
  };
}
export interface ExternalNodeType {
  id: string;
  type: NodeTypeEnum;
  data: ExternalNodeDataType;
  position: PositionType;
  dragging?: boolean;
  selected?: boolean;
  measured?: {
    width: number;
    height: number;
  };
}
export type NodeType = PipelineNodeType | ExternalNodeType;

/**工具函数 */
// 聚焦
export function fitFlowView(options?: {
  focusNodes?: any[];
  interpolate?: "linear" | "smooth" | undefined;
  duration?: number;
  minZoom?: number;
  maxZoom?: number;
}) {
  setTimeout(() => {
    const state = useFlowStore.getState();
    const fitView = state.instance?.fitView;
    if (!fitView) return;
    const viewport = state.viewport;
    const {
      focusNodes,
      interpolate = "linear",
      duration = 500,
      minZoom = viewport.zoom,
      maxZoom = viewport.zoom,
    } = options || {};
    fitView({
      nodes: focusNodes,
      interpolate,
      duration,
      minZoom,
      maxZoom,
    });
  }, 100);
}
// 创建模板节点
export function createPipelineNode(
  id: string,
  options?: {
    label?: string;
    position?: PositionType;
    select?: boolean;
    datas?: any;
  }
): PipelineNodeType {
  const {
    label = id,
    position = { x: 0, y: 0 },
    select = false,
    datas = {},
  } = options ?? {};
  const node: PipelineNodeType = {
    id,
    type: NodeTypeEnum.Pipeline,
    data: {
      label,
      recognition: {
        type: "DirectHit",
        param: {},
      },
      action: {
        type: "DoNothing",
        param: {},
      },
      others: {},
      extras: {},
      ...datas,
    },
    position,
    selected: select,
  };
  return node;
}
export function createExternalNode(
  id: string,
  options?: {
    label?: string;
    position?: PositionType;
    select?: boolean;
    datas?: any;
  }
): ExternalNodeType {
  const {
    label = id,
    position = { x: 0, y: 0 },
    select = false,
    datas = {},
  } = options ?? {};
  const node: ExternalNodeType = {
    id,
    type: NodeTypeEnum.External,
    data: { label, ...datas },
    position,
    selected: select,
  };
  return node;
}
// 查找节点
export function findNodeById(id: string): PipelineNodeType {
  return useFlowStore.getState().nodes.find((node) => node.id === id);
}
export function findNodeIndexById(id: string) {
  return useFlowStore.getState().nodes.findIndex((node) => node.id === id);
}
export function findNodeLabelById(id: string) {
  return findNodeById(id)?.data?.label;
}
function findNodeByLabel(label: string) {
  return useFlowStore
    .getState()
    .nodes.find((node) => node.data.label === label);
}
// 筛选选中的节点
function getSelectedNodes(nodes: any[]): PipelineNodeType[] {
  return nodes.filter((node) => node.selected);
}
// 取消所有节点选中
function getUnselectedNodes(params?: {
  nodes?: PipelineNodeType[];
  selectedNodes?: PipelineNodeType[];
}): PipelineNodeType[] {
  const state = useFlowStore.getState();
  let { nodes = state.nodes, selectedNodes = state.selectedNodes } =
    params || {};
  const changes = selectedNodes.map((node) => ({
    id: node.id,
    selected: false,
    type: "select",
  }));
  nodes = applyNodeChanges(changes as NodeChange[], nodes);
  return nodes;
}
// 查找同名节点
export function checkRepateNodeLabelList(): string[] {
  // 获取当前配置
  let prefix = useFileStore.getState().currentFile.config.prefix;
  const configs = useConfigStore.getState().configs;
  const nodes = useFlowStore.getState().nodes as NodeType[];
  const repates: string[] = [];
  const isAddPrefix = configs.isExportConfig && prefix;
  if (isAddPrefix) prefix += "_";
  // 查重
  const counter: Record<string, number> = {};
  for (const node of nodes) {
    let label = node.data.label;
    if (isAddPrefix && node.type === NodeTypeEnum.Pipeline)
      label = prefix + label;
    counter[label] = (counter[label] ?? 0) + 1;
    if (counter[label] == 2) {
      repates.push(label);
    }
  }
  // 添加错误提示
  useErrorStore.getState().setError(ErrorTypeEnum.NodeNameRepeat, () => {
    return repates.map((label) => ({
      type: ErrorTypeEnum.NodeNameRepeat,
      msg: label,
    }));
  });

  return repates;
}

// 计算新节点位置
function calcuNodePosition(): PositionType {
  const state = useFlowStore.getState();
  // 有选中节点
  const selectedNodes = state.selectedNodes;
  if (selectedNodes.length > 0) {
    let rightestPosition = { x: -Infinity, y: -Infinity };
    selectedNodes.forEach((node) => {
      if ((node as PipelineNodeType).position.x > rightestPosition.x) {
        rightestPosition = (node as PipelineNodeType).position;
      }
    });
    return {
      x: rightestPosition.x + 260,
      y: rightestPosition.y,
    };
  }
  // 无选中节点
  else {
    const viewport = state.viewport;
    const size = state.size;
    return {
      x: -((viewport.x - size.width) / viewport.zoom + 260),
      y: -((viewport.y - size.height / 2) / viewport.zoom + 80),
    };
  }
}
// 获取节点
function findEdgeById(id: string): EdgeType {
  return useFlowStore.getState().edges.find((edge) => edge.id === id);
}
// 筛选选中的边
function getSelectedEdges(edges?: any[]): EdgeType[] {
  if (!edges) edges = useFlowStore.getState().edges;
  return edges.filter((edge) => edge.selected);
}
// 取消所有边选中
function getUnselectedEdges(params?: {
  edges?: EdgeType[];
  selectedEdges?: EdgeType[];
}): EdgeType[] {
  const state = useFlowStore.getState();
  let { edges = state.edges, selectedEdges = state.selectedEdges } =
    params || {};
  const changes = selectedEdges.map((edge) => ({
    id: edge.id,
    selected: false,
    type: "select",
  }));
  edges = applyNodeChanges(changes as NodeChange[], edges);
  return edges;
}
// 计算链接次序
function calcuLinkOrder(source: string, type: SourceHandleTypeEnum): number {
  const edges = useFlowStore.getState().edges as EdgeType[];
  let order = 1;
  edges.forEach((edge) => {
    if (edge.source === source && edge.sourceHandle === type) order++;
  });
  return order;
}
// 缓冲存储
const buTimeout: Record<string, number> = {};
function buData(key: string, data: any) {
  if (buTimeout[key]) clearTimeout(buTimeout[key]);
  buTimeout[key] = setTimeout(() => {
    useFlowStore.setState(() => ({ [key]: data }));
  }, 400);
}

/**Flow仓库 */
let nodeIdCounter = 1;
let pasteIdCounter = 1;
interface FlowState {
  instance: ReactFlowInstance | null;
  viewport: Viewport;
  size: { width: number; height: number };
  nodes: any[];
  selectedNodes: any[];
  bfSelectedNodes: any[];
  targetNode: any;
  bfTargetNode: any;
  edges: any[];
  selectedEdges: any[];
  bfSelectedEdges: any[];
  updateInstance: (instance: ReactFlowInstance) => void;
  updateViewport: (viewport: Viewport) => void;
  updateSize: (width: number, height: number) => void;
  updateNodes: (changes: NodeChange[]) => void;
  addNode: (options?: {
    type?: NodeTypeEnum;
    data?: any;
    position?: PositionType;
    select?: boolean;
    link?: boolean;
    focus?: boolean;
  }) => void;
  updateEdges: (changes: EdgeChange[]) => void;
  addEdge: (co: Connection, options?: { isCheck?: Boolean }) => void;
  setNodeData: (id: string, type: string, key: string, value: any) => void;
  replace: (nodes: NodeType[], edges: EdgeType[]) => void;
  paste: (nodes: NodeType[], edges: EdgeType[]) => void;
}
export const useFlowStore = create<FlowState>()((set) => ({
  instance: null,
  viewport: { x: 0, y: 0, zoom: 1 },
  size: { width: 0, height: 0 },
  nodes: [],
  selectedNodes: [],
  bfSelectedNodes: [],
  targetNode: null,
  bfTargetNode: null,
  edges: [],
  selectedEdges: [],
  bfSelectedEdges: [],

  /**工作流全局 */
  updateInstance(instance) {
    set(() => ({ instance }));
  },
  updateViewport(viewport) {
    set(() => ({ viewport }));
  },
  updateSize(width, height) {
    set(() => ({ size: { width, height } }));
  },

  /**节点操作 */
  // 更新节点
  updateNodes(changes) {
    set((state) => {
      // 筛选选中的节点
      const nodes = applyNodeChanges(changes, state.nodes);
      const selectedNodes = getSelectedNodes(nodes);
      const setter: any = { nodes, selectedNodes };
      // 缓冲存储
      buData("bfSelectedNodes", selectedNodes);
      // 选中节点
      if (selectedNodes.length !== 1) {
        setter.targetNode = null;
      } else if (!selectedNodes[0].dragging) {
        setter.targetNode = selectedNodes[0];
      }
      if ("targetNode" in setter) {
        buData("bfTargetNode", setter.targetNode);
      }
      return setter;
    });
    // 检查重复
    if (
      changes.some((change) => change.type === "remove") &&
      findErrorsByType(ErrorTypeEnum.NodeNameRepeat).length > 0
    )
      checkRepateNodeLabelList();
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
      let nodes = select ? getUnselectedNodes() : [...state.nodes];
      // 创建节点
      let id = String(nodeIdCounter++);
      let labelBase;
      switch (type) {
        case NodeTypeEnum.Pipeline:
          labelBase = "新建节点";
          break;
        case NodeTypeEnum.External:
          labelBase = "外部节点";
          break;
      }
      let label = labelBase + id;
      while (findNodeByLabel(label)) {
        id = String(nodeIdCounter++);
        label = labelBase + id;
      }
      const nodeOptions = {
        label,
        position: position ?? calcuNodePosition(),
        datas: data,
        select,
      };
      let newNode: any;
      switch (type) {
        case NodeTypeEnum.Pipeline:
          newNode = createPipelineNode(id, nodeOptions);
          break;
        case NodeTypeEnum.External:
          newNode = createExternalNode(id, nodeOptions);
          break;
      }
      // 添加连接
      if (link && selectedNodes.length > 0) {
        selectedNodes.forEach((node) => {
          if ((node as NodeType).type === NodeTypeEnum.External) return;
          state.addEdge({
            source: (node as PipelineNodeType).id,
            sourceHandle: SourceHandleTypeEnum.Next,
            target: id,
            targetHandle: "target",
          });
        });
      }
      // 添加节点
      nodes.push(newNode);
      const setter: any = { nodes };
      if (select) setter.selectedNodes = [newNode];
      // 聚焦
      if (focus && useConfigStore.getState().configs.isAutoFocus)
        fitFlowView({ focusNodes: [newNode] });
      return setter;
    });
  },
  // 更新节点数据
  setNodeData(id, type, key, value) {
    set((state) => {
      // 获取节点索引
      const nodeIndex = findNodeIndexById(id);
      if (nodeIndex < 0) return {};
      let nodes = state.nodes;
      let targetNode = { ...nodes[nodeIndex] };

      // 数据处理
      if (Array.isArray(value)) value = [...value];

      // 更新节点数据
      // 识别与动作字段
      if (type === "recognition" || type === "action") {
        if (value == "__mpe_delete") {
          delete targetNode.data[type].param[key];
        } else {
          targetNode.data[type].param[key] = value;
        }
      }
      // 识别与动作类型
      else if (type === "type") {
        const field = targetNode.data[key];
        field.type = value;
        const fieldParamKeys =
          key === "recognition" ? recoParamKeys[value] : actionParamKeys[value];
        // 删除不存在的字段
        const curKeys = Object.keys(field.param);
        curKeys.forEach((key) => {
          fieldParamKeys.all.includes(key) || delete field.param[key];
        });
        // 添加必选字段
        fieldParamKeys.requires.forEach((req, index) => {
          req in field.param ||
            (field.param[req] = fieldParamKeys.required_default[index]);
        });
      }
      // 其他字段
      else if (type === "others") {
        if (value == "__mpe_delete") {
          delete targetNode.data.others[key];
        } else {
          targetNode.data.others[key] = value;
        }
      }
      // 其他类型
      else {
        targetNode.data[key] = value;
      }

      nodes[nodeIndex] = targetNode;
      buData("bfTargetNode", targetNode);
      return { nodes, targetNode };
    });
    // 检查重复
    if (key === "label") checkRepateNodeLabelList();
  },

  /**边操作 */
  // 更新边
  updateEdges(changes) {
    set((state) => {
      // 更新前处理
      const edges = state.edges as EdgeType[];
      changes.forEach((change) => {
        switch (change.type) {
          case "remove":
            const removedEdge = findEdgeById(change.id);
            edges.forEach((edge) => {
              if (
                edge.source === removedEdge.source &&
                edge.sourceHandle === removedEdge.sourceHandle &&
                edge.label > removedEdge.label
              )
                edge.label--;
            });
            break;
        }
      });
      // 更新数据
      const newEdges = applyEdgeChanges(changes, edges);
      const selectedEdges = getSelectedEdges(newEdges);
      buData("bfSelectedEdges", selectedEdges);
      return { edges: newEdges, selectedEdges };
    });
  },
  // 添加边
  addEdge(co, options) {
    const { isCheck = true } = options || {};
    set((state) => {
      // 检查冲突项
      if (isCheck) {
        const edges = state.edges as EdgeType[];
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
            crash = state.edges.find(
              (edge) =>
                edge.source === co.source &&
                edge.target === co.target &&
                edge.sourceHandle === SourceHandleTypeEnum.Next
            );
            break;
        }
        if (crash) return {};
      }
      // 更新边属性
      const order = calcuLinkOrder(
        co.source,
        co.sourceHandle as SourceHandleTypeEnum
      );
      const newEdge = {
        type: "marked",
        label: order,
        ...co,
      };
      const newEdges = addEdge(newEdge, state.edges);
      return { edges: newEdges };
    });
  },

  /**整体更新 */
  // 替换新的节点与边
  replace(nodes: NodeType[], edges: EdgeType[]) {
    set(() => {
      const setter = {
        nodes,
        edges,
        selectedNodes: [],
        bfSelectedNodes: [],
        targetNode: null,
        bfTargetNode: null,
      };
      fitFlowView();
      return setter;
    });
  },

  // 批量拷贝
  paste(nodes, edges) {
    if (nodes.length === 0) return;
    set(() => {
      // 获取未选中状态
      const originNodes = getUnselectedNodes();
      const originEdges = getUnselectedEdges();

      // 更新节点数据
      nodes = cloneDeep(nodes);
      const pairs: Record<string, string> = {};
      nodes.forEach((node) => {
        const newId = "paste_" + pasteIdCounter;
        pairs[node.id] = newId;
        node.id = newId;
        node.data.label = node.data.label + "_副本" + pasteIdCounter++;
        const position = node.position;
        node.position = {
          x: position.x + 100,
          y: position.y + 50,
        };
      });

      // 更新边数据
      edges = cloneDeep(edges);
      edges.forEach((edge) => {
        edge.source = pairs[edge.source];
        edge.target = pairs[edge.target];
        edge.id = `${edge.source}_${edge.sourceHandle}_${edge.target}`;
      });

      return {
        nodes: [...originNodes, ...nodes],
        selectedNodes: nodes,
        bfSelectedNodes: nodes,
        edges: [...originEdges, ...edges],
        selectedEdges: edges,
        bfSelectedEdges: edges,
        targetNode: null,
        bfTargetNode: null,
      };
    });
    // 自动聚焦
    if (useConfigStore.getState().configs.isAutoFocus)
      fitFlowView({ focusNodes: nodes });
  },
}));
