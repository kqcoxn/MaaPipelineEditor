import { NodeTypeEnum } from "./constants";
import { PipelineNodeMemo } from "./PipelineNode";
import { ExternalNodeMemo } from "./ExternalNode";
import { AnchorNodeMemo } from "./AnchorNode";
import { StickerNodeMemo } from "./StickerNode";
import { GroupNodeMemo } from "./GroupNode";

export const nodeTypes = {
  [NodeTypeEnum.Pipeline]: PipelineNodeMemo,
  [NodeTypeEnum.External]: ExternalNodeMemo,
  [NodeTypeEnum.Anchor]: AnchorNodeMemo,
  [NodeTypeEnum.Sticker]: StickerNodeMemo,
  [NodeTypeEnum.Group]: GroupNodeMemo,
};

export {
  NodeTypeEnum,
  SourceHandleTypeEnum,
  TargetHandleTypeEnum,
  DEFAULT_HANDLE_DIRECTION,
  HANDLE_DIRECTION_OPTIONS,
} from "./constants";
export type { HandleDirection } from "./constants";
export type { IconConfig, RequiredIconConfig } from "./utils";
export { getHandlePositions } from "./components/NodeHandles";
