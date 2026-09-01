import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type { FlowStore } from "./types";
import { createViewSlice } from "./slices/viewSlice";
import { createSelectionSlice } from "./slices/selectionSlice";
import { createHistorySlice } from "./slices/historySlice";
import { createNodeSlice } from "./slices/nodeSlice";
import { createEdgeSlice } from "./slices/edgeSlice";
import { createGraphSlice } from "./slices/graphSlice";
import { createPathSlice } from "./slices/pathSlice";
import { createAnchorRefSlice } from "./slices/anchorRefSlice";
import { createGraphIndexSlice } from "./slices/graphIndexSlice";
import { checkRepeatNodeLabelList as checkRepeatNodeLabelListUtil } from "./utils/nodeUtils";
import { ErrorTypeEnum, useErrorStore } from "@/stores/app/errorStore";
import { useConfigStore } from "@/stores/app/configStore";
import { useFileStore } from "@/stores/project/fileStore";

// 组合所有 slices
export const useFlowStore = create<FlowStore>()(subscribeWithSelector((...a) => ({
  ...createViewSlice(...a),
  ...createSelectionSlice(...a),
  ...createHistorySlice(...a),
  ...createNodeSlice(...a),
  ...createEdgeSlice(...a),
  ...createGraphSlice(...a),
  ...createPathSlice(...a),
  ...createAnchorRefSlice(...a),
  ...createGraphIndexSlice(...a),
})));

useConfigStore.subscribe((state, previousState) => {
  const historyLimit = state.configs.historyLimit;
  if (historyLimit === previousState.configs.historyLimit) return;
  useFlowStore.getState().trimHistory(historyLimit);
});
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
  NodeSemanticSummary,
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
  getNodeAbsolutePosition,
  getNodeAbsoluteRect,
  getRuntimeNodeAbsoluteRect,
  normalizeImportedNodePosition,
  resolveParentChain,
  serializeNodePosition,
  toRelativePosition,
} from "./utils/coordinateUtils";
export {
  findEdgeById,
  getSelectedEdges,
  calcuLinkOrder,
  getConnectionKey,
  hasMatchingConnection,
} from "./utils/edgeUtils";
export type { ConnectionEndpoints } from "./utils/edgeUtils";
export { fitFlowView } from "./utils/viewportUtils";
export { getNodeTypeLabelKey } from "./utils/graphIndex";
export {
  allocateNodeId,
  createNodeIdAllocator,
  getNextNodeIdCounter,
  NODE_ID_PREFIX,
} from "./utils/nodeId";
export type { NodeIdAllocation, NodeIdAllocator } from "./utils/nodeId";
export {
  allocateEdgeId,
  createEdgeIdAllocator,
  getNextEdgeIdCounter,
  EDGE_ID_PREFIX,
} from "./utils/edgeId";
export type { EdgeIdAllocation, EdgeIdAllocator } from "./utils/edgeId";

// 检查节点名重复
export function checkRepeatNodeLabelList(): string[] {
  const nodes = useFlowStore.getState().nodes;
  const configs = useConfigStore.getState().configs;
  const fileConfig = useFileStore.getState().currentFile.config;

  const repeats = checkRepeatNodeLabelListUtil(nodes, {
    shouldExportConfig: configs.configHandlingMode !== "none",
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
  const state = useFlowStore.getState();
  const edgeIds = state.outgoingEdgeIdsByNodeId.get(nodeId) ?? [];

  const nextEdges = edgeIds
    .map((edgeId) => state.edgeById.get(edgeId))
    .filter(
      (edge) => edge?.sourceHandle?.includes("next"),
    );

  // 提取 target 节点 ID 并去重
  const nextNodeIds = Array.from(
    new Set(nextEdges.map((edge) => edge!.target)),
  );

  return nextNodeIds;
}
