import { create } from "zustand";
import type { FlowStore } from "./types";
import { createViewSlice } from "./slices/viewSlice";
import { createSelectionSlice } from "./slices/selectionSlice";
import { createHistorySlice } from "./slices/historySlice";
import { createNodeSlice } from "./slices/nodeSlice";
import { createEdgeSlice } from "./slices/edgeSlice";
import { createGraphSlice } from "./slices/graphSlice";
import { createPathSlice } from "./slices/pathSlice";
import { checkRepeatNodeLabelList as checkRepeatNodeLabelListUtil } from "./utils/nodeUtils";
import { ErrorTypeEnum, useErrorStore } from "../errorStore";
import { useConfigStore } from "../configStore";
import { useFileStore } from "../fileStore";

// 组合所有 slices
export const useFlowStore = create<FlowStore>()((...a) => ({
  ...createViewSlice(...a),
  ...createSelectionSlice(...a),
  ...createHistorySlice(...a),
  ...createNodeSlice(...a),
  ...createEdgeSlice(...a),
  ...createGraphSlice(...a),
  ...createPathSlice(...a),
}));
export type {
  NodeType,
  PipelineNodeType,
  ExternalNodeType,
  AnchorNodeType,
  StickerNodeType,
  GroupNodeType,
  EdgeType,
  EdgeAttributesType,
  PositionType,
  RecognitionParamType,
  ActionParamType,
  OtherParamType,
  ParamType,
  PipelineNodeDataType,
  ExternalNodeDataType,
  AnchorNodeDataType,
  StickerNodeDataType,
  StickerColorTheme,
  GroupNodeDataType,
  GroupColorTheme,
} from "./types";
export {
  createPipelineNode,
  createExternalNode,
  createAnchorNode,
  createStickerNode,
  createGroupNode,
  findNodeById,
  findNodeIndexById,
  findNodeLabelById,
  findNodeByLabel,
  getSelectedNodes,
  calcuNodePosition,
  ensureGroupNodeOrder,
} from "./utils/nodeUtils";
export {
  findEdgeById,
  getSelectedEdges,
  calcuLinkOrder,
} from "./utils/edgeUtils";
export { fitFlowView } from "./utils/viewportUtils";

// 检查节点名重复
export function checkRepeatNodeLabelList(): string[] {
  const nodes = useFlowStore.getState().nodes;
  const configs = useConfigStore.getState().configs;
  const fileConfig = useFileStore.getState().currentFile.config;

  const repeats = checkRepeatNodeLabelListUtil(nodes, {
    isExportConfig: configs.isExportConfig,
    prefix: fileConfig.prefix,
  });

  // 添加错误提示
  useErrorStore.getState().setError(ErrorTypeEnum.NodeNameRepeat, () => {
    return repeats.map((label) => ({
      type: ErrorTypeEnum.NodeNameRepeat,
      msg: label,
    }));
  });

  return repeats;
}

/**
 * 获取指定节点通过 next 连接指向的所有节点 ID
 * @param nodeId 节点 ID
 * @returns 下一个节点 ID 数组
 */
export function getNextNodes(nodeId: string): string[] {
  const edges = useFlowStore.getState().edges;
  
  // 筛选出 source 为指定 nodeId 且 sourceHandle 包含 "next" 的边
  const nextEdges = edges.filter(
    (edge) => edge.source === nodeId && edge.sourceHandle?.includes("next")
  );
  
  // 提取 target 节点 ID 并去重
  const nextNodeIds = Array.from(
    new Set(nextEdges.map((edge) => edge.target))
  );
  
  return nextNodeIds;
}
