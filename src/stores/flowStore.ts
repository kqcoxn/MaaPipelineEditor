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

import { SourceHandleTypeEnum, NodeTypeEnum } from "../components/flow/nodes";

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
export type ParamType = RecognitionParamType | ActionParamType | OtherParamType;

export type NodeDataType = {
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
};

export interface NodeType {
  id: string;
  type: string;
  data: NodeDataType;
  position: { x: number; y: number };
  dragging?: boolean;
  selected?: boolean;
}

// 查找节点
export function findNodeById(id: string) {
  return useFlowStore
    .getState()
    .nodes.find((node) => node.id === id) as NodeType;
}
export function findNodeIndexById(id: string) {
  return useFlowStore.getState().nodes.findIndex((node) => node.id === id);
}
// 查找选中的节点
function getSelectedNodes(nodes: any[]) {
  return nodes.filter((node) => node.selected) as NodeType[];
}
// 取消所有节点选中
function getUnselectedNodes(params?: {
  nodes?: NodeType[];
  selectedNodes?: NodeType[];
}): NodeType[] {
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
// 计算新节点位置
function calcuNodePosition(): { x: number; y: number } {
  const state = useFlowStore.getState();
  // 有选中节点
  const selectedNodes = state.selectedNodes;
  if (selectedNodes.length > 0) {
    let rightestPosition = { x: -Infinity, y: -Infinity };
    selectedNodes.forEach((node) => {
      if ((node as NodeType).position.x > rightestPosition.x) {
        rightestPosition = (node as NodeType).position;
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

/**仓库 */
let nodeIdCounter = 1;
interface FlowState {
  instance: ReactFlowInstance | null;
  viewport: Viewport;
  size: { width: number; height: number };
  nodes: any[];
  selectedNodes: any[];
  targetNode: any;
  edges: any[];
  updateInstance: (instance: ReactFlowInstance) => void;
  updateViewport: (viewport: Viewport) => void;
  updateSize: (width: number, height: number) => void;
  updateNodes: (changes: NodeChange[]) => void;
  addNode: (options?: {
    type?: NodeTypeEnum;
    data?: any;
    position?: { x: number; y: number };
    select?: boolean;
    link?: boolean;
    focus?: boolean;
  }) => void;
  updateEdges: (changes: EdgeChange[]) => void;
  addEdge: (co: Connection, options?: { isCheck?: Boolean }) => void;
  setNodeData: (id: string, type: string, key: string, value: any) => void;
}
export const useFlowStore = create<FlowState>()((set) => ({
  instance: null,
  viewport: { x: 0, y: 0, zoom: 1 },
  size: { width: 0, height: 0 },
  nodes: [],
  selectedNodes: [],
  targetNode: null,
  edges: [],

  // 更新视口
  updateInstance(instance) {
    set(() => ({ instance }));
  },
  updateViewport(viewport) {
    set(() => ({ viewport }));
  },
  updateSize(width, height) {
    set(() => ({ size: { width, height } }));
  },

  // 更新节点
  updateNodes(changes) {
    set((state) => {
      const nodes = applyNodeChanges(changes, state.nodes);
      // 筛选选中的节点
      const selectedNodes = getSelectedNodes(nodes);
      const setter: any = { nodes, selectedNodes };
      if (selectedNodes.length !== 1) {
        setter.targetNode = null;
      } else if (!selectedNodes[0].dragging) {
        setter.targetNode = selectedNodes[0];
      }
      return setter;
    });
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
      const id = String(nodeIdCounter++);
      const newNode = {
        id,
        type,
        data: {
          label: "新建节点" + id,
          recognition: {
            type: "DirectHit",
            param: {},
          },
          action: {
            type: "DoNothing",
            param: {},
          },
          others: {},
          ...data,
        },
        position: position ?? calcuNodePosition(),
        selected: select,
      };
      // 添加连接
      if (link && selectedNodes.length > 0) {
        selectedNodes.forEach((node) => {
          state.addEdge({
            source: (node as NodeType).id,
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
      if (focus) {
        const viewport = state.viewport;
        setTimeout(() => {
          state.instance?.fitView({
            nodes: [newNode],
            interpolate: "linear",
            duration: 500,
            minZoom: viewport.zoom,
            maxZoom: viewport.zoom,
          });
        }, 200);
      }
      return setter;
    });
  },

  // 更新边
  updateEdges(changes) {
    set((state) => ({ edges: applyEdgeChanges(changes, state.edges) }));
  },
  // 添加边
  addEdge(co, options) {
    const { isCheck = true } = options || {};
    set((state) => {
      // 检查冲突项
      if (isCheck) {
        if (co.sourceHandle === SourceHandleTypeEnum.Next) {
          const crash = state.edges.find(
            (edge) =>
              (edge as Connection).source === co.source &&
              (edge as Connection).sourceHandle === SourceHandleTypeEnum.Error
          );
          if (crash) return {};
        } else if (co.sourceHandle === SourceHandleTypeEnum.Error) {
          const crash = state.edges.find(
            (edge) =>
              (edge as Connection).source === co.source &&
              (edge as Connection).sourceHandle === SourceHandleTypeEnum.Next
          );
          if (crash) return {};
        }
      }
      // 更新边属性
      const newEdge = { ...co, type: "marked" };
      const newEdges = addEdge(newEdge, state.edges);
      return { edges: newEdges };
    });
  },

  // 更新节点数据
  setNodeData(id, type, key, value) {
    set((state) => {
      // 获取节点索引
      const nodeIndex = findNodeIndexById(id);
      if (nodeIndex < 0) return {};
      let nodes = state.nodes;
      const targetNode = { ...nodes[nodeIndex] };

      // 更新节点数据
      if (type === "recognition" || type === "action") {
        if (value == "__mpe_delete") {
          delete targetNode.data[type].param[key];
        } else {
          targetNode.data[type].param[key] = value;
        }
      } else if (type === "others") {
        if (value == "__mpe_delete") {
          delete targetNode.data.others[key];
        } else {
          targetNode.data.others[key] = value;
        }
      } else if (type === "type") {
        targetNode.data[key].type = value;
      } else {
        targetNode.data[key] = value;
      }

      nodes[nodeIndex] = targetNode;
      return { nodes, targetNode };
    });
  },
}));
