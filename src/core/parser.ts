import { type Connection } from "@xyflow/react";

import {
  useFlowStore,
  findNodeLabelById,
  type NodeType,
  type PipelineNodeType,
  type RecognitionParamType,
  type ActionParamType,
  type OtherParamType,
} from "../stores/flowStore";
import { NodeTypeEnum, SourceHandleTypeEnum } from "../components/flow/nodes";
import { JsonHelper } from "../utils/jsonHelper";

const uniqueMark = "__mpe";
type ParsedPipelineNodeType = {
  [uniqueMark]: {
    position: { x: number; y: number };
  };
  recognition: {
    type: "TemplateMatch";
    param: RecognitionParamType;
  };
  action: {
    type: "TemplateMatch";
    param: ActionParamType;
  };
  [SourceHandleTypeEnum.Next]: string[];
  [SourceHandleTypeEnum.Interrupt]: string[];
  [SourceHandleTypeEnum.Error]: string[];
} & OtherParamType &
  any;
type PipelineObjType = Record<string, ParsedPipelineNodeType>;

/**转录为 PipelineObj */
// 创建节点
function parsePipelineNode(fNode: PipelineNodeType): ParsedPipelineNodeType {
  const fNodeData = fNode.data;
  // 额外节点
  const extras = JsonHelper.isStringObj(fNodeData.extras)
    ? JSON.parse(fNodeData.extras)
    : {};
  // 赋值
  const pNode: ParsedPipelineNodeType = {
    recognition: fNodeData.recognition,
    action: fNodeData.action,
    ...fNodeData.others,
    ...extras,
    [uniqueMark]: {
      position: fNode.position,
    },
  };
  return pNode;
}
// 链接
function addLink(
  fromPNode: ParsedPipelineNodeType,
  toPNodeKey: string,
  linkType: SourceHandleTypeEnum
) {
  if (!(linkType in fromPNode)) fromPNode[linkType] = [];
  fromPNode[linkType].push(toPNodeKey);
}

// 转录
export function flowToPipeline(): PipelineObjType {
  // 获取当前 flow 数据
  const state = useFlowStore.getState();
  const nodes = state.nodes as NodeType[];
  const edges = state.edges as Connection[];

  // 生成节点
  const pipelineObj: PipelineObjType = {};
  nodes.forEach((node) => {
    if (node.type === NodeTypeEnum.External) return;
    pipelineObj[node.data.label] = parsePipelineNode(node as PipelineNodeType);
  });

  // 链接
  edges.forEach((edge) => {
    const sourceKey = findNodeLabelById(edge.source);
    const targetKey = findNodeLabelById(edge.target);
    addLink(
      pipelineObj[sourceKey],
      targetKey,
      edge.sourceHandle as SourceHandleTypeEnum
    );
  });

  return pipelineObj;
}
