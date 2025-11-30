import {
  recoFieldSchemaKeyList,
  actionFieldSchemaKeyList,
  upperRecoValues,
  upperActionValues,
} from "../fields";

/**
 * 检测单个节点的Pipeline版本
 * @param node Pipeline节点对象
 * @returns 1表示v1版本，2表示v2版本
 */
export function detectNodeVersion(node: any): number {
  if (!node || typeof node !== "object") return 2;

  // 检查 recognition 字段
  if (node.recognition !== undefined) {
    // v2: recognition 是对象，包含 type 和 param
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

  // 检查 action 字段
  if (node.action !== undefined) {
    // v2: action 是对象，包含 type 和 param
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

  // 检查是否有 v1 特征：识别和动作参数字段直接在节点根层级
  const nodeKeys = Object.keys(node);
  const hasRecoParams = nodeKeys.some((k) =>
    recoFieldSchemaKeyList.includes(k)
  );
  const hasActionParams = nodeKeys.some((k) =>
    actionFieldSchemaKeyList.includes(k)
  );

  if (hasRecoParams || hasActionParams) {
    // 但如果同时有 recognition.param 或 action.param，则是 v2
    const hasV2Structure =
      node.recognition?.param !== undefined || node.action?.param !== undefined;
    if (!hasV2Structure) {
      return 1;
    }
  }

  // 默认返回 v2
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
