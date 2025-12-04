import { NodeTypeEnum } from "./constants";
import { PipelineNodeMemo } from "./PipelineNode";
import { ExternalNodeMemo } from "./ExternalNode";
import { AnchorNodeMemo } from "./AnchorNode";

export const nodeTypes = {
  [NodeTypeEnum.Pipeline]: PipelineNodeMemo,
  [NodeTypeEnum.External]: ExternalNodeMemo,
  [NodeTypeEnum.Anchor]: AnchorNodeMemo,
};

export { NodeTypeEnum, SourceHandleTypeEnum } from "./constants";
export type { IconConfig, RequiredIconConfig } from "./utils";
