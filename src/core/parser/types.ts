import type {
  NodeType,
  EdgeType,
  EdgeAttributesType,
  PipelineNodeType,
  RecognitionParamType,
  ActionParamType,
  OtherParamType,
  ParamType,
} from "../../stores/flow";
import type { FileConfigType } from "../../stores/fileStore";
import { SourceHandleTypeEnum } from "../../components/flow/nodes";
import type { HandleDirection } from "../../components/flow/nodes/constants";

// 配置标记常量
export const configMark = "$__mpe_code";
export const configMarkPrefix = "$__mpe_config_";
export const externalMarkPrefix = "$__mpe_external_";
export const anchorMarkPrefix = "$__mpe_anchor_";

// 解析后的Pipeline节点类型
export type ParsedPipelineNodeType = {
  [configMark]?: {
    position: { x: number; y: number };
    handleDirection?: HandleDirection;
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

// 节点配置类型
export type NodeConfigType = {
  position: { x: number; y: number };
  handleDirection?: HandleDirection;
};

// MPE分离配置文件类型
export type MpeConfigType = {
  file_config: {
    filename: string;
    prefix?: string;
    version?: string;
    savedViewport?: { x: number; y: number; zoom: number };
    [key: string]: any;
  };
  node_configs: Record<string, NodeConfigType>;
  external_nodes?: Record<string, NodeConfigType | any>;
  anchor_nodes?: Record<string, NodeConfigType | any>;
};

// 导出选项
export type FlowToOptions = {
  nodes?: NodeType[];
  edges?: EdgeType[];
  fileName?: string;
  config?: FileConfigType;
  forceExportConfig?: boolean; // 强制导出配置
};

// 导入选项
export type PipelineToFlowOptions = {
  pString?: string; // Pipeline JSON 字符串
  mpeConfig?: MpeConfigType; // 外部 MPE 配置
};

// 导出的公共类型
export type {
  NodeType,
  EdgeType,
  EdgeAttributesType,
  PipelineNodeType,
  RecognitionParamType,
  ActionParamType,
  OtherParamType,
  ParamType,
};
