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
  const configs = useConfigStore.getState().configs;

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

  // 分离 focus 字段
  const focus = others.focus;
  delete others.focus;

  // 过滤空的 focus 字段
  const hasValidFocus =
    focus !== "" &&
    focus !== null &&
    focus !== undefined &&
    !(
      typeof focus === "object" &&
      focus !== null &&
      Object.keys(focus).length === 0
    );

  // 额外字段
  const extras = JsonHelper.isObj(fNodeData.extras)
    ? fNodeData.extras
    : JsonHelper.stringObjToJson(
        String(fNodeData.extras).replaceAll(/[""]/g, `"`)
      ) ?? {};

  // 检查是否导出默认识别/动作
  const exportDefaultRecoAction = configs.exportDefaultRecoAction;
  // 获取协议版本
  const protocolVersion = configs.pipelineProtocolVersion ?? "v2";

  // reco -> action -> others -> focus -> extras -> 配置
  const pNode: ParsedPipelineNodeType = {};

  // 1. recognition
  const isDefaultReco =
    recoType === "DirectHit" && Object.keys(recognition.param).length === 0;
  if (exportDefaultRecoAction || !isDefaultReco) {
    if (protocolVersion === "v1") {
      pNode.recognition = recoType;
    } else {
      pNode.recognition = recognition;
    }
  }

  // 2. action
  const isDefaultAction =
    actionType === "DoNothing" && Object.keys(action.param).length === 0;
  if (exportDefaultRecoAction || !isDefaultAction) {
    if (protocolVersion === "v1") {
      pNode.action = actionType;
    } else {
      pNode.action = action;
    }
  }

  // 3. v1 平铺 recognition 和 action 的参数
  if (protocolVersion === "v1") {
    if (exportDefaultRecoAction || !isDefaultReco) {
      Object.assign(pNode, recognition.param);
    }
    if (exportDefaultRecoAction || !isDefaultAction) {
      Object.assign(pNode, action.param);
    }
  }

  // 4. others
  Object.assign(pNode, others);

  // 5. focus
  if (hasValidFocus) {
    pNode.focus = focus;
  }

  // 6. extras
  Object.assign(pNode, extras);

  // 保存位置信息和端点位置
  if (configs.isExportConfig) {
    const position = fNode.position;
    const mpeCode: Record<string, any> = {
      position: {
        x: Math.round(position.x),
        y: Math.round(position.y),
      },
    };
    // 保存端点位置
    if (fNodeData.handleDirection) {
      mpeCode.handleDirection = fNodeData.handleDirection;
    }
    pNode[configMark] = mpeCode;
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
  const mpeCode: Record<string, any> = {
    position: {
      x: Math.round(position.x),
      y: Math.round(position.y),
    },
  };
  // 保存端点位置
  if ((fNode.data as any).handleDirection) {
    mpeCode.handleDirection = (fNode.data as any).handleDirection;
  }
  const pNode: ParsedPipelineNodeType = {
    [configMark]: mpeCode,
  };
  return pNode;
}

/**
 * 解析重定向节点位置信息
 * @param fNode Flow节点
 * @returns 包含位置信息的节点
 */
export function parseAnchorNodeForExport(
  fNode: PipelineNodeType
): ParsedPipelineNodeType {
  const position = fNode.position;
  const mpeCode: Record<string, any> = {
    position: {
      x: Math.round(position.x),
      y: Math.round(position.y),
    },
  };
  // 保存端点位置
  if ((fNode.data as any).handleDirection) {
    mpeCode.handleDirection = (fNode.data as any).handleDirection;
  }
  const pNode: ParsedPipelineNodeType = {
    [configMark]: mpeCode,
  };
  return pNode;
}

/**
 * 解析便签节点为导出格式
 * @param fNode Flow节点
 * @returns 包含位置、内容、颜色、尺寸的节点
 */
export function parseStickerNodeForExport(fNode: any): ParsedPipelineNodeType {
  const position = fNode.position;
  const mpeCode: Record<string, any> = {
    position: {
      x: Math.round(position.x),
      y: Math.round(position.y),
    },
    content: fNode.data.content ?? "",
    color: fNode.data.color ?? "yellow",
  };
  // 保存尺寸
  const width = fNode.measured?.width ?? fNode.style?.width;
  const height = fNode.measured?.height ?? fNode.style?.height;
  if (width) mpeCode.width = Math.round(width);
  if (height) mpeCode.height = Math.round(height);
  const pNode: ParsedPipelineNodeType = {
    [configMark]: mpeCode,
  };
  return pNode;
}

/**
 * 解析分组节点为导出格式
 * @param fNode Flow节点
 * @param allNodes 所有节点（用于查找子节点）
 * @returns 包含位置、颜色、尺寸、子节点信息的节点
 */
export function parseGroupNodeForExport(
  fNode: any,
  allNodes: any[]
): ParsedPipelineNodeType {
  const position = fNode.position;
  // 收集子节点 label
  const childrenLabels = allNodes
    .filter((n: any) => n.parentId === fNode.id)
    .map((n: any) => n.data?.label)
    .filter(Boolean);

  const mpeCode: Record<string, any> = {
    position: {
      x: Math.round(position.x),
      y: Math.round(position.y),
    },
    color: fNode.data.color ?? "blue",
    childrenLabels,
  };
  // 保存尺寸
  const width = fNode.measured?.width ?? fNode.style?.width;
  const height = fNode.measured?.height ?? fNode.style?.height;
  if (width) mpeCode.width = Math.round(width);
  if (height) mpeCode.height = Math.round(height);
  const pNode: ParsedPipelineNodeType = {
    [configMark]: mpeCode,
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
      // 迁移 method
      if (value.param?.method === 1) {
        value.param.method = 10001;
      }
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
    // 特殊处理：将 method 字段的值 1 自动转换为 10001
    if (key === "method" && value === 1) {
      node.data.recognition.param[key] = 10001;
    } else {
      node.data.recognition.param[key] = value;
    }
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
