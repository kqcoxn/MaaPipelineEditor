/**
 * 节点名称处理工具函数
 * 统一处理节点标签与前缀的拼接逻辑
 */

import { useFileStore } from "../stores/fileStore";

/**
 * 获取带前缀的完整节点名
 * @param nodeLabel 节点标签（不含前缀）
 * @param prefix 可选前缀，如不提供则从当前文件配置中获取
 * @returns 完整节点名（prefix_label 或 label）
 */
export function getFullNodeName(nodeLabel: string, prefix?: string): string {
  const actualPrefix =
    prefix ?? useFileStore.getState().currentFile.config.prefix;
  return actualPrefix ? `${actualPrefix}_${nodeLabel}` : nodeLabel;
}

/**
 * 从完整节点名中移除前缀，获取标签
 * @param fullName 完整节点名（可能带前缀）
 * @param prefix 可选前缀，如不提供则从当前文件配置中获取
 * @returns 节点标签（不含前缀）
 */
export function stripPrefixFromNodeName(
  fullName: string,
  prefix?: string
): string {
  const actualPrefix =
    prefix ?? useFileStore.getState().currentFile.config.prefix;

  if (!actualPrefix) {
    return fullName;
  }

  const prefixWithUnderscore = `${actualPrefix}_`;
  if (fullName.startsWith(prefixWithUnderscore)) {
    return fullName.substring(prefixWithUnderscore.length);
  }

  return fullName;
}
