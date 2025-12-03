import { create } from "zustand";
import type { FlowStore } from "./types";
import { createViewSlice } from "./slices/viewSlice";
import { createSelectionSlice } from "./slices/selectionSlice";
import { createHistorySlice } from "./slices/historySlice";
import { createNodeSlice } from "./slices/nodeSlice";
import { createEdgeSlice } from "./slices/edgeSlice";
import { createGraphSlice } from "./slices/graphSlice";
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
}));
export type {
  NodeType,
  PipelineNodeType,
  ExternalNodeType,
  AnchorNodeType,
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
} from "./types";
export {
  createPipelineNode,
  createExternalNode,
  createAnchorNode,
  findNodeById,
  findNodeIndexById,
  findNodeLabelById,
  findNodeByLabel,
  getSelectedNodes,
  calcuNodePosition,
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
