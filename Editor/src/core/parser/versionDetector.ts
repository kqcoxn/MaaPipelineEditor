import {
  recoFieldSchemaKeyList,
  actionFieldSchemaKeyList,
  upperRecoValues,
  upperActionValues,
} from "../fields";

/**
 * 节点版本检测结果
 */
export interface NodeVersionInfo {
  /** recognition 字段版本 */
  recognitionVersion: number;
  /** action 字段版本 */
  actionVersion: number;
}

/**
 * 检测单个节点的Pipeline版本
 * @param node Pipeline节点对象
 * @returns 包含recognition和action各自版本的对象
 */
export function detectNodeVersion(node: any): NodeVersionInfo {
  if (!node || typeof node !== "object") {
    return { recognitionVersion: 2, actionVersion: 2 };
  }

  const recognitionVersion = detectRecognitionVersion(node);
  const actionVersion = detectActionVersion(node);

  return { recognitionVersion, actionVersion };
}

/**
 * 检测 recognition 字段的版本
 * @param node Pipeline节点对象
 * @returns 版本
 */
export function detectRecognitionVersion(node: any): number {
  if (!node || typeof node !== "object") return 2;

  // 检查 recognition 字段
  if (node.recognition !== undefined) {
    // v2: recognition 是对象，必须包含 type
    if (
      typeof node.recognition === "object" &&
      node.recognition !== null &&
      "type" in node.recognition
    ) {
      return 2;
    }
    // v1: recognition 是字符串
    if (typeof node.recognition === "string") {
      return 1;
    }
  }

  // 检查是否有 v1 特征
  const nodeKeys = Object.keys(node);
  const hasRecoParams = nodeKeys.some((k) =>
    recoFieldSchemaKeyList.includes(k)
  );

  if (hasRecoParams) {
    if (node.recognition?.type !== undefined) {
      return 2;
    }
    return 1;
  }
  return 2;
}

/**
 * 检测 action 字段的版本
 * @param node Pipeline节点对象
 * @returns 版本
 */
export function detectActionVersion(node: any): number {
  if (!node || typeof node !== "object") return 2;

  // 检查 action 字段
  if (node.action !== undefined) {
    // v2: action 是对象，必须包含 type
    if (
      typeof node.action === "object" &&
      node.action !== null &&
      "type" in node.action
    ) {
      return 2;
    }
    // v1: action 是字符串
    if (typeof node.action === "string") {
      return 1;
    }
  }

  // 检查是否有 v1 特征
  const nodeKeys = Object.keys(node);
  const hasActionParams = nodeKeys.some((k) =>
    actionFieldSchemaKeyList.includes(k)
  );

  if (hasActionParams) {
    if (node.action?.type !== undefined) {
      return 2;
    }
    return 1;
  }
  return 2;
}

/**
 * 标准化识别算法类型
 * @param value 原始类型值
 * @returns 标准化后的类型
 * @throws Error 如果类型不在预定义列表中
 */
export function normalizeRecoType(value: string): string {
  if (!Object.values(upperRecoValues).includes(value)) {
    let idx = Object.keys(upperRecoValues).findIndex(
      (k) => k === value.toUpperCase()
    );
    if (idx >= 0) {
      return Object.values(upperRecoValues)[idx];
    }
    throw new Error("识别算法类型错误");
  }
  return value;
}

/**
 * 标准化动作类型
 * @param value 原始类型值
 * @returns 标准化后的类型
 * @throws Error 如果类型不在预定义列表中
 */
export function normalizeActionType(value: string): string {
  if (!Object.values(upperActionValues).includes(value)) {
    let idx = Object.keys(upperActionValues).findIndex(
      (k) => k === value.toUpperCase()
    );
    if (idx >= 0) {
      return Object.values(upperActionValues)[idx];
    }
    throw new Error("动作类型错误");
  }
  return value;
}
