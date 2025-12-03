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

// 图数据 Slice 状态
export interface FlowGraphState {
  nodes: NodeType[];
  edges: EdgeType[];
  idCounters: {
    node: number;
    paste: number;
  };
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
  updateEdges: (changes: EdgeChange[]) => void;
  addEdge: (co: Connection, options?: { isCheck?: boolean }) => void;
  replace: (
    nodes: NodeType[],
    edges: EdgeType[],
    options?: { isFitView?: boolean; skipHistory?: boolean; skipSave?: boolean }
  ) => void;
  paste: (nodes: NodeType[], edges: EdgeType[]) => void;
  resetCounters: () => void;
}

// 合并的 Flow Store 类型
export type FlowStore = FlowViewState &
  FlowSelectionState &
  FlowHistoryState &
  FlowGraphState;
