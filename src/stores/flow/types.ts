import type {
  ReactFlowInstance,
  Viewport,
  NodeChange,
  EdgeChange,
  Connection,
} from "@xyflow/react";
import {
  NodeTypeEnum,
  SourceHandleTypeEnum,
} from "../../components/flow/nodes";

// 位置类型
export type PositionType = {
  x: number;
  y: number;
};

// 边属性类型
export type EdgeAttributesType = {
  jump_back?: boolean;
  anchor?: boolean;
};

// 边类型
export type EdgeType = {
  id: string;
  source: string;
  sourceHandle: SourceHandleTypeEnum;
  target: string;
  targetHandle: "target";
  label: number;
  type: "marked";
  selected?: boolean;
  attributes?: EdgeAttributesType;
};

// XYWH 坐标类型
type XYWH = [number, number, number, number];

// 识别参数类型
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

// 动作参数类型
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

// 其他参数类型
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

// 参数合并类型
export type ParamType = RecognitionParamType & ActionParamType & OtherParamType;

// Pipeline 节点数据类型
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

// External 节点数据类型
export type ExternalNodeDataType = {
  label: string;
};

// Anchor 重定向节点数据类型
export type AnchorNodeDataType = {
  label: string;
};

// Pipeline 节点类型
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

// External 节点类型
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

// Anchor 重定向节点类型
export interface AnchorNodeType {
  id: string;
  type: NodeTypeEnum;
  data: AnchorNodeDataType;
  position: PositionType;
  dragging?: boolean;
  selected?: boolean;
  measured?: {
    width: number;
    height: number;
  };
}

// 节点联合类型
export type NodeType = PipelineNodeType | ExternalNodeType | AnchorNodeType;

// ========== Slice 状态类型定义 ==========

// 视口 Slice 状态
export interface FlowViewState {
  instance: ReactFlowInstance | null;
  viewport: Viewport;
  size: { width: number; height: number };
  updateInstance: (instance: ReactFlowInstance) => void;
  updateViewport: (viewport: Viewport) => void;
  updateSize: (width: number, height: number) => void;
}

// 选择 Slice 状态
export interface FlowSelectionState {
  selectedNodes: NodeType[];
  selectedEdges: EdgeType[];
  targetNode: NodeType | null;
  debouncedSelectedNodes: NodeType[];
  debouncedSelectedEdges: EdgeType[];
  debouncedTargetNode: NodeType | null;
  debounceTimeouts: Record<string, number>;
  updateSelection: (nodes: NodeType[], edges: EdgeType[]) => void;
  setTargetNode: (node: NodeType | null) => void;
  clearSelection: () => void;
}

// 历史 Slice 状态
export interface FlowHistoryState {
  historyStack: Array<{ nodes: NodeType[]; edges: EdgeType[] }>;
  historyIndex: number;
  saveTimeout: number | null;
  lastSnapshot: string | null;
  saveHistory: (delay?: number) => void;
  undo: () => boolean;
  redo: () => boolean;
  initHistory: (nodes: NodeType[], edges: EdgeType[]) => void;
  clearHistory: () => void;
  getHistoryState: () => { canUndo: boolean; canRedo: boolean };
}

// 节点 Slice 状态
export interface FlowNodeState {
  nodes: NodeType[];
  nodeIdCounter: number;
  updateNodes: (changes: NodeChange[]) => void;
  addNode: (options?: {
    type?: NodeTypeEnum;
    data?: any;
    position?: PositionType;
    select?: boolean;
    link?: boolean;
    focus?: boolean;
  }) => void;
  setNodeData: (id: string, type: string, key: string, value: any) => void;
  batchSetNodeData: (
    id: string,
    updates: Array<{ type: string; key: string; value: any }>
  ) => void;
  setNodes: (nodes: NodeType[]) => void;
  resetNodeCounter: () => void;
}

// 边 Slice 状态
export interface FlowEdgeState {
  edges: EdgeType[];
  updateEdges: (changes: EdgeChange[]) => void;
  setEdgeData: (id: string, key: string, value: any) => void;
  setEdgeLabel: (id: string, newLabel: number) => void;
  addEdge: (co: Connection, options?: { isCheck?: boolean }) => void;
  setEdges: (edges: EdgeType[]) => void;
}

// 图数据 Slice 状态
export interface FlowGraphState {
  pasteIdCounter: number;
  replace: (
    nodes: NodeType[],
    edges: EdgeType[],
    options?: { isFitView?: boolean; skipHistory?: boolean; skipSave?: boolean }
  ) => void;
  paste: (nodes: NodeType[], edges: EdgeType[]) => void;
  resetPasteCounter: () => void;
  shiftNodes: (
    direction: "horizontal" | "vertical",
    delta: number,
    targetNodeIds?: string[]
  ) => void;
}

// 路径 Slice 状态
export interface FlowPathState {
  pathMode: boolean; // 是否开启路径模式
  pathStartNodeId: string | null; // 起始节点ID
  pathEndNodeId: string | null; // 结束节点ID
  pathNodeIds: Set<string>; // 路径上的节点ID集合
  pathEdgeIds: Set<string>; // 路径上的边ID集合
  setPathMode: (enabled: boolean) => void;
  setPathStartNode: (nodeId: string | null) => void;
  setPathEndNode: (nodeId: string | null) => void;
  calculatePath: () => void; // 计算路径
  clearPath: () => void; // 清除路径
}

// 合并的 Flow Store 类型
export type FlowStore = FlowViewState &
  FlowSelectionState &
  FlowHistoryState &
  FlowNodeState &
  FlowEdgeState &
  FlowGraphState &
  FlowPathState;
