import type { FieldSortConfig } from "./types";
import {
  recoFieldSchemaKeyList,
  actionFieldSchemaKeyList,
  swipeFieldSchemaKeyList,
} from "../fields";

/**
 * 特殊字段
 */
const SPECIAL_TASK_FIELDS = ["desc", "doc", "sub_name", "next", "on_error"];

/**
 * 主任务字段默认顺序（按 plugin-parser.ts 的顺序）
 */
const MAIN_TASK_FIELD_ORDER = [
  "desc",
  "doc",
  "enabled",
  "max_hit",
  "sub_name",
  "recognition",
  "inverse",
  "pre_wait_freezes",
  "pre_delay",
  "action",
  "anchor",
  "repeat",
  "repeat_wait_freezes",
  "repeat_delay",
  "post_wait_freezes",
  "post_delay",
  "timeout",
  "rate_limit",
  "next",
  "on_error",
  "focus",
  "attach",
];

/**
 * 识别参数字段默认顺序
 */
const RECO_PARAM_FIELD_ORDER = [
  "custom_recognition",
  "custom_recognition_param",
  "roi",
  "roi_offset",
  "template",
  "green_mask",
  "method",
  "detector",
  "ratio",
  "lower",
  "upper",
  "connected",
  "expected",
  "replace",
  "only_rec",
  "model",
  "color_filter",
  "labels",
  "threshold",
  "count",
  "all_of",
  "any_of",
  "box_index",
  "order_by",
  "index",
];

/**
 * 动作参数字段默认顺序
 */
const ACTION_PARAM_FIELD_ORDER = [
  "custom_action",
  "custom_action_param",
  "target",
  "target_offset",
  "begin",
  "begin_offset",
  "end",
  "end_offset",
  "end_hold",
  "only_hover",
  "duration",
  "contact",
  "pressure",
  "swipes",
  "dx",
  "dy",
  "key",
  "input_text",
  "package",
  "exec",
  "args",
  "detach",
  "cmd",
  "shell_timeout",
  "filename",
  "format",
  "quality",
];

/**
 * Freeze 对象字段默认顺序
 * 用于 pre_wait_freezes, post_wait_freezes, repeat_wait_freezes 的 object 形式
 */
const FREEZE_PARAM_FIELD_ORDER = [
  "time",
  "target",
  "target_offset",
  "threshold",
  "method",
  "rate_limit",
  "timeout",
];

/**
 * 生成默认排序配置
 */
export function getDefaultSortConfig(): FieldSortConfig {
  return {
    mainTaskFields: [...MAIN_TASK_FIELD_ORDER],
    recognitionParamFields: [...RECO_PARAM_FIELD_ORDER],
    actionParamFields: [...ACTION_PARAM_FIELD_ORDER],
    swipeFields: [...swipeFieldSchemaKeyList],
    freezeParamFields: [...FREEZE_PARAM_FIELD_ORDER],
  };
}

/**
 * 获取所有可用字段
 */
export function getAllAvailableFields() {
  return {
    mainTaskFields: [...SPECIAL_TASK_FIELDS, "recognition", "action"],
    recognitionParamFields: [...recoFieldSchemaKeyList],
    actionParamFields: [...actionFieldSchemaKeyList],
    swipeFields: [...swipeFieldSchemaKeyList],
    freezeParamFields: [...FREEZE_PARAM_FIELD_ORDER],
  };
}

/**
 * 导出默认顺序常量
 */
export const DEFAULT_MAIN_TASK_FIELD_ORDER = MAIN_TASK_FIELD_ORDER;
export const DEFAULT_RECO_PARAM_FIELD_ORDER = RECO_PARAM_FIELD_ORDER;
export const DEFAULT_ACTION_PARAM_FIELD_ORDER = ACTION_PARAM_FIELD_ORDER;
export const DEFAULT_FREEZE_PARAM_FIELD_ORDER = FREEZE_PARAM_FIELD_ORDER;
