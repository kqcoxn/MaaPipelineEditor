import type { ParsedPipelineNodeType } from "../parser/types";
import type { FieldSortConfig, SortContext } from "./types";
import { getDefaultSortConfig } from "./defaults";
import type { PipelineProtocolVersion } from "../../stores/configStore";

/** MPE 特色字段前缀 */
const MPE_FIELD_PREFIX = "$__mpe_";

/**
 * 判断是否为 MPE 特色字段
 */
export function isMpeField(key: string): boolean {
  return key.startsWith(MPE_FIELD_PREFIX);
}

/**
 * 按指定顺序重排对象字段
 * @param obj 原始对象
 * @param order 字段顺序
 * @param mpeFieldsAtEnd 是否将 MPE 特色字段放在末尾
 * @returns 排序后的新对象
 */
function sortObjectByOrder<T extends Record<string, unknown>>(
  obj: T,
  order: string[],
  mpeFieldsAtEnd: boolean = true,
): T {
  const result: Record<string, unknown> = {};
  const processedKeys = new Set<string>();
  const mpeFields: Record<string, unknown> = {};

  // 按顺序添加字段
  for (const key of order) {
    if (key in obj) {
      result[key] = obj[key];
      processedKeys.add(key);
    }
  }

  // 添加未在排序列表中的字段
  for (const key of Object.keys(obj)) {
    if (!processedKeys.has(key)) {
      if (mpeFieldsAtEnd && isMpeField(key)) {
        mpeFields[key] = obj[key];
      } else {
        result[key] = obj[key];
      }
    }
  }

  // 将 MPE 特色字段添加到末尾
  if (mpeFieldsAtEnd) {
    Object.assign(result, mpeFields);
  }

  return result as T;
}

/**
 * 排序 recognition 对象（v2 版本）
 */
function sortRecognitionObject(
  recognition: { type: string; param: Record<string, unknown> },
  recognitionParamFields: string[],
): { type: string; param: Record<string, unknown> } {
  return {
    type: recognition.type,
    param: sortObjectByOrder(recognition.param, recognitionParamFields),
  };
}

/**
 * 排序 action 对象（v2 版本）
 */
function sortActionObject(
  action: { type: string; param: Record<string, unknown> },
  actionParamFields: string[],
  swipeFields: string[],
): { type: string; param: Record<string, unknown> } {
  const sortedParam = sortObjectByOrder(action.param, actionParamFields);

  // 如果有 swipes 字段，对其内部元素排序
  if (sortedParam.swipes && Array.isArray(sortedParam.swipes)) {
    sortedParam.swipes = sortedParam.swipes.map(
      (swipe: Record<string, unknown>) => sortObjectByOrder(swipe, swipeFields),
    );
  }

  return {
    type: action.type,
    param: sortedParam,
  };
}

/**
 * 排序 freeze 对象
 * @param value freeze 字段值（可能是数字或对象）
 * @param freezeParamFields freeze 参数字段顺序
 * @returns 排序后的值
 */
function sortFreezeObject(
  value: unknown,
  freezeParamFields: string[],
): unknown {
  // 如果是对象则排序其字段
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return sortObjectByOrder(
      value as Record<string, unknown>,
      freezeParamFields,
      false,
    );
  }
  return value;
}

/**
 * 排序节点中的 freeze 字段
 * @param node 节点数据
 * @param freezeParamFields freeze 参数字段顺序
 */
function sortFreezeFields(
  node: ParsedPipelineNodeType,
  freezeParamFields: string[],
): void {
  const freezeFieldNames = [
    "pre_wait_freezes",
    "post_wait_freezes",
    "repeat_wait_freezes",
  ];

  for (const fieldName of freezeFieldNames) {
    if (fieldName in node) {
      (node as Record<string, unknown>)[fieldName] = sortFreezeObject(
        (node as Record<string, unknown>)[fieldName],
        freezeParamFields,
      );
    }
  }
}

/**
 * 应用 v2 版本排序
 */
function applyV2Sort(
  node: ParsedPipelineNodeType,
  config: FieldSortConfig,
): ParsedPipelineNodeType {
  const result: ParsedPipelineNodeType = {};
  const processedKeys = new Set<string>();
  const mpeFields: Record<string, unknown> = {};

  // 按 mainTaskFields 顺序遍历
  for (const field of config.mainTaskFields) {
    if (field === "recognition" && node.recognition) {
      if (typeof node.recognition === "object" && "type" in node.recognition) {
        result.recognition = sortRecognitionObject(
          node.recognition as { type: string; param: Record<string, unknown> },
          config.recognitionParamFields,
        );
        processedKeys.add("recognition");
      }
    } else if (field === "action" && node.action) {
      if (typeof node.action === "object" && "type" in node.action) {
        result.action = sortActionObject(
          node.action as { type: string; param: Record<string, unknown> },
          config.actionParamFields,
          config.swipeFields,
        );
        processedKeys.add("action");
      }
    } else if (field in node) {
      (result as Record<string, unknown>)[field] =
        node[field as keyof typeof node];
      processedKeys.add(field);
    }
  }

  // 添加未在排序列表中的字段
  for (const key of Object.keys(node)) {
    if (!processedKeys.has(key)) {
      if (isMpeField(key)) {
        mpeFields[key] = node[key as keyof typeof node];
      } else {
        (result as Record<string, unknown>)[key] =
          node[key as keyof typeof node];
      }
    }
  }

  // 将 MPE 特色字段添加到末尾
  Object.assign(result, mpeFields);

  // 排序 freeze 字段
  sortFreezeFields(result, config.freezeParamFields);

  return result;
}

/**
 * 应用 v1 版本排序
 */
function applyV1Sort(
  node: ParsedPipelineNodeType,
  config: FieldSortConfig,
): ParsedPipelineNodeType {
  const result: ParsedPipelineNodeType = {};
  const processedKeys = new Set<string>();
  const mpeFields: Record<string, unknown> = {};

  // 按 mainTaskFields 顺序遍历
  for (const field of config.mainTaskFields) {
    if (field === "recognition") {
      // v1: recognition 是字符串
      if (node.recognition !== undefined) {
        result.recognition = node.recognition;
        processedKeys.add("recognition");
      }
      // 按 recognitionParamFields 顺序添加识别参数
      for (const recoKey of config.recognitionParamFields) {
        if (recoKey in node) {
          (result as Record<string, unknown>)[recoKey] =
            node[recoKey as keyof typeof node];
          processedKeys.add(recoKey);
        }
      }
    } else if (field === "action") {
      // v1: action 是字符串
      if (node.action !== undefined) {
        result.action = node.action;
        processedKeys.add("action");
      }
      // 按 actionParamFields 顺序添加动作参数
      for (const actKey of config.actionParamFields) {
        if (actKey in node) {
          (result as Record<string, unknown>)[actKey] =
            node[actKey as keyof typeof node];
          processedKeys.add(actKey);
        }
      }
    } else if (field in node) {
      (result as Record<string, unknown>)[field] =
        node[field as keyof typeof node];
      processedKeys.add(field);
    }
  }

  // 添加未在排序列表中的字段
  for (const key of Object.keys(node)) {
    if (!processedKeys.has(key)) {
      if (isMpeField(key)) {
        mpeFields[key] = node[key as keyof typeof node];
      } else {
        (result as Record<string, unknown>)[key] =
          node[key as keyof typeof node];
      }
    }
  }

  // 将 MPE 特色字段添加到末尾
  Object.assign(result, mpeFields);

  // 排序 freeze 字段
  sortFreezeFields(result, config.freezeParamFields);

  return result;
}

/**
 * 应用自定义排序到导出节点
 * @param node 原始节点数据
 * @param sortConfig 排序配置
 * @param version 协议版本 (v1/v2)
 * @returns 排序后的节点数据
 */
export function applyFieldSort(
  node: ParsedPipelineNodeType,
  sortConfig: FieldSortConfig | undefined,
  version: PipelineProtocolVersion,
): ParsedPipelineNodeType {
  // 合并默认配置
  const defaultConfig = getDefaultSortConfig();
  const config: FieldSortConfig = {
    mainTaskFields: sortConfig?.mainTaskFields ?? defaultConfig.mainTaskFields,
    recognitionParamFields:
      sortConfig?.recognitionParamFields ??
      defaultConfig.recognitionParamFields,
    actionParamFields:
      sortConfig?.actionParamFields ?? defaultConfig.actionParamFields,
    swipeFields: sortConfig?.swipeFields ?? defaultConfig.swipeFields,
    freezeParamFields:
      sortConfig?.freezeParamFields ?? defaultConfig.freezeParamFields,
  };

  // 根据版本选择排序策略
  if (version === "v1") {
    return applyV1Sort(node, config);
  } else {
    return applyV2Sort(node, config);
  }
}

/**
 * 创建排序上下文
 */
export function createSortContext(
  version: PipelineProtocolVersion,
  config: FieldSortConfig | undefined,
): SortContext {
  return {
    version,
    config: config ?? getDefaultSortConfig(),
  };
}
