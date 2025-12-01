import { useConfigStore } from "../../stores/configStore";
import type { PipelineNodeType, ParsedPipelineNodeType } from "./types";
import { configMark } from "./types";
import { matchParamType } from "./typeMatchers";
import {
  recoFields,
  actionFields,
  otherFieldParams,
  recoFieldSchemaKeyList,
  actionFieldSchemaKeyList,
  otherFieldSchemaKeyList,
} from "../fields";
import { JsonHelper } from "../../utils/jsonHelper";
import { normalizeRecoType, normalizeActionType } from "./versionDetector";

/**
 * 解析Pipeline节点为导出格式
 * @param fNode Flow节点
 * @returns 解析后的Pipeline节点
 */
export function parsePipelineNodeForExport(
  fNode: PipelineNodeType
): ParsedPipelineNodeType {
  const fNodeData = fNode.data;

  // 识别算法
  const recoType = fNodeData.recognition.type;
  const recognition = {
    type: recoType,
    param: matchParamType(
      fNodeData.recognition.param,
      recoFields[recoType].params
    ),
  };

  // 动作
  const actionType = fNodeData.action.type;
  const action = {
    type: actionType,
    param: matchParamType(
      fNodeData.action.param,
      actionFields[actionType].params
    ),
  };

  // 其他参数
  const others = matchParamType(fNodeData.others, otherFieldParams);

  // 额外字段
  const extras = JsonHelper.isObj(fNodeData.extras)
    ? fNodeData.extras
    : JsonHelper.stringObjToJson(
        String(fNodeData.extras).replaceAll(/[""]/g, `"`)
      ) ?? {};

  // 赋值
  const pNode: ParsedPipelineNodeType = {
    recognition,
    action,
    ...others,
    ...extras,
  };

  // 保存位置信息
  if (useConfigStore.getState().configs.isExportConfig) {
    const position = fNode.position;
    pNode[configMark] = {
      position: {
        x: Math.round(position.x),
        y: Math.round(position.y),
      },
    };
  }

  return pNode;
}

/**
 * 解析外部节点位置信息
 * @param fNode Flow节点
 * @returns 包含位置信息的节点
 */
export function parseExternalNodeForExport(
  fNode: PipelineNodeType
): ParsedPipelineNodeType {
  const position = fNode.position;
  const pNode: ParsedPipelineNodeType = {
    [configMark]: {
      position: {
        x: Math.round(position.x),
        y: Math.round(position.y),
      },
    },
  };
  return pNode;
}

/**
 * 解析识别字段
 * @param node 目标节点
 * @param value 识别字段值
 * @param nodeVersion 节点版本
 */
export function parseRecognitionField(
  node: PipelineNodeType,
  value: any,
  nodeVersion: number
): void {
  switch (nodeVersion) {
    case 1:
      // v1版本：识别算法是字符串
      node.data.recognition.type = normalizeRecoType(value);
      break;
    case 2:
      // v2版本：识别算法是对象
      value.type = normalizeRecoType(value.type);
      node.data.recognition = value;
      break;
  }
}

/**
 * 解析动作字段
 * @param node 目标节点
 * @param value 动作字段值
 * @param nodeVersion 节点版本
 */
export function parseActionField(
  node: PipelineNodeType,
  value: any,
  nodeVersion: number
): void {
  switch (nodeVersion) {
    case 1:
      // v1版本：动作类型是字符串
      node.data.action.type = normalizeActionType(value);
      break;
    case 2:
      // v2版本：动作类型是对象
      value.type = normalizeActionType(value.type);
      node.data.action = value;
      break;
  }
}

/**
 * 解析节点字段
 * @param node 目标节点
 * @param key 字段键
 * @param value 字段值
 * @param recognitionVersion recognition字段的版本
 * @param actionVersion action字段的版本
 * @returns 是否解析成功
 */
export function parseNodeField(
  node: PipelineNodeType,
  key: string,
  value: any,
  recognitionVersion: number,
  actionVersion: number
): boolean {
  // 跳过连接字段
  if (key === "next" || key === "on_error") {
    return true;
  }

  // 识别算法
  if (key === "recognition") {
    parseRecognitionField(node, value, recognitionVersion);
    return true;
  }

  // 识别参数（v1版本）
  if (recoFieldSchemaKeyList.includes(key) && recognitionVersion === 1) {
    node.data.recognition.param[key] = value;
    return true;
  }

  // 动作类型
  if (key === "action") {
    parseActionField(node, value, actionVersion);
    return true;
  }

  // 动作参数（v1版本）
  if (actionFieldSchemaKeyList.includes(key) && actionVersion === 1) {
    node.data.action.param[key] = value;
    return true;
  }

  // 其他字段
  if (otherFieldSchemaKeyList.includes(key)) {
    node.data.others[key] = value;
    return true;
  }

  // 未识别的字段作为额外字段
  return false;
}
