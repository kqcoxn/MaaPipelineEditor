/**
 * Parser 模块 - Pipeline 格式与 Flow 格式互转
 *
 * 该模块负责 MaaPipelineEditor 的核心解析功能：
 * - flowToPipeline: 将可视化编辑器的 Flow 格式转换为 Pipeline JSON 格式
 * - pipelineToFlow: 将 Pipeline JSON 格式解析为可视化编辑器的 Flow 格式
 *
 * 模块已被重构为多个子模块以提高可维护性：
 * - types: 类型定义
 * - typeMatchers: 类型匹配与转换
 * - versionDetector: 版本检测与兼容
 * - configParser: 配置解析
 * - edgeLinker: 边连接逻辑
 * - nodeParser: 节点解析
 * - exporter: 导出逻辑
 * - importer: 导入逻辑
 */

export { flowToPipeline, flowToPipelineString, flowToSeparatedStrings } from "./exporter";
export { pipelineToFlow } from "./importer";
export {
  splitPipelineAndConfig,
  mergePipelineAndConfig,
  getConfigFileName,
  getPipelineFileNameFromConfig,
} from "./configSplitter";

// 导出类型
export type {
  ParsedPipelineNodeType,
  PipelineObjType,
  IdLabelPairsType,
  PipelineConfigType,
  MpeConfigType,
  NodeConfigType,
  FlowToOptions,
  PipelineToFlowOptions,
  NodeType,
  EdgeType,
  PipelineNodeType,
  RecognitionParamType,
  ActionParamType,
  OtherParamType,
  ParamType,
} from "./types";
export type { NodeVersionInfo } from "./versionDetector";

// 导出常量
export {
  configMark,
  configMarkPrefix,
  externalMarkPrefix,
  anchorMarkPrefix,
} from "./types";

// 工具函数
export { matchParamType } from "./typeMatchers";
export {
  detectNodeVersion,
  detectRecognitionVersion,
  detectActionVersion,
  normalizeRecoType,
  normalizeActionType,
} from "./versionDetector";
export {
  isConfigKey,
  isMark,
  getConfigMark,
  parsePipelineConfig,
} from "./configParser";
export {
  linkEdge,
  resetIdCounter,
  getNextId,
  parseNodeRef,
} from "./edgeLinker";
export type { NodeAttr, NodeRefType } from "./edgeLinker";
export {
  parsePipelineNodeForExport,
  parseExternalNodeForExport,
  parseRecognitionField,
  parseActionField,
  parseNodeField,
} from "./nodeParser";
