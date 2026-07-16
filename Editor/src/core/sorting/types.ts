import type { PipelineProtocolVersion } from "../../stores/configStore";

/**
 * 字段排序配置
 */
export type FieldSortConfig = {
  /** 主任务字段排序 */
  mainTaskFields: string[];
  /** recognition.param 内部排序 */
  recognitionParamFields: string[];
  /** action.param 内部排序 */
  actionParamFields: string[];
  /** swipes 内部排序 */
  swipeFields: string[];
  /** freeze 对象内部排序 (pre_wait_freezes, post_wait_freezes, repeat_wait_freezes) */
  freezeParamFields: string[];
};

/**
 * 排序上下文
 */
export type SortContext = {
  /** 协议版本 */
  version: PipelineProtocolVersion;
  /** 排序配置 */
  config: FieldSortConfig;
};
