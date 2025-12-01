import type {
  NodeType,
  EdgeType,
  PipelineNodeType,
  RecognitionParamType,
  ActionParamType,
  OtherParamType,
  ParamType,
} from "../../stores/flow";
import type { FileConfigType } from "../../stores/fileStore";
import { SourceHandleTypeEnum } from "../../components/flow/nodes";

// 配置标记常量
export const configMark = "$__mpe_code";
export const configMarkPrefix = "$__mpe_config_";
export const externalMarkPrefix = "$__mpe_external_";

// 解析后的Pipeline节点类型
export type ParsedPipelineNodeType = {
  [configMark]?: {
    position: { x: number; y: number };
  };
  recognition?: {
    type: string;
    param: RecognitionParamType;
  };
  action?: {
    type: string;
    param: ActionParamType;
  };
  [SourceHandleTypeEnum.Next]?: string[];
  [SourceHandleTypeEnum.Error]?: string[];
} & OtherParamType &
  any;

// Pipeline对象类型
export type PipelineObjType = Record<string, ParsedPipelineNodeType>;

// ID-Label对应关系类型
export type IdLabelPairsType = {
  id: string;
  label: string;
}[];

// Pipeline配置类型
export type PipelineConfigType = {
  filename?: string;
  version?: string;
  prefix?: string;
  [key: string]: any;
};

// 导出选项
export type FlowToOptions = {
  nodes?: NodeType[];
  edges?: EdgeType[];
  fileName?: string;
  config?: FileConfigType;
};

// 导入选项
export type PipelineToFlowOptions = {
  pString?: string;
};

// 导出的公共类型
export type {
  NodeType,
  EdgeType,
  PipelineNodeType,
  RecognitionParamType,
  ActionParamType,
  OtherParamType,
  ParamType,
};
