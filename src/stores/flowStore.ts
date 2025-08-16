import { create } from "zustand";
import {
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type NodeChange,
  type EdgeChange,
  type Connection,
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

export type NodeType = {
  id: string;
  type: string;
  data: NodeDataType;
  position: { x: number; y: number };
  dragging?: boolean;
};

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

let nodeIdCounter = 1;
interface FlowState {
  nodes: any[];
  selectedNodes: any[];
  targetNode: any;
  edges: any[];
  updateNodes: (changes: NodeChange[]) => void;
  addNode: (options?: {
    type?: NodeTypeEnum;
    data?: NodeDataType;
    position?: { x: number; y: number };
  }) => void;
  updateEdges: (changes: EdgeChange[]) => void;
  addEdge: (co: Connection, options?: { isCheck?: Boolean }) => void;
  setNodeData: (id: string, type: string, key: string, value: any) => void;
}
export const useFlowStore = create<FlowState>()((set) => ({
  /**工作流更新 */
  nodes: [],
  selectedNodes: [],
  targetNode: null,
  edges: [],

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
    const { type = NodeTypeEnum.Pipeline, data, position } = options || {};
    set((state) => {
      const nodes = [...state.nodes];
      const id = String(nodeIdCounter++);
      nodes.push({
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
        position: { x: 0, y: 0 },
      });
      return { nodes };
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

  /**数据更新 */
  // 节点数据
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
