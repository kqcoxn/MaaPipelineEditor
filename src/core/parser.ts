import { type Connection } from "@xyflow/react";

import {
  useFlowStore,
  type PipelineNodeType,
  type RecognitionParamType,
  type ActionParamType,
  type OtherParamType,
} from "../stores/flowStore";

type PipelineJsonType = Record<
  string,
  {
    recognition: {
      type: "TemplateMatch";
      param: RecognitionParamType;
    };
    action: {
      type: "TemplateMatch";
      param: ActionParamType;
    };
  } & OtherParamType &
    any
>;
export function flowToPipeline(): PipelineJsonType {
  const flowStoreState = useFlowStore.getState();
  const nodes = flowStoreState.nodes as PipelineNodeType[];
  const edges = flowStoreState.edges as Connection[];
  console.log(nodes, edges);
  return {};
}
