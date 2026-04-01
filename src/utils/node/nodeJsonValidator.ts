import { NodeTypeEnum } from "../../components/flow/nodes";

export interface ValidationResult {
  valid: boolean;
  error?: string;
  data?: any;
}

/**
 * 验证节点 JSON 数据
 * @param jsonString JSON 字符串
 * @param nodeType 节点类型
 * @returns 验证结果
 */
export function validateNodeJson(
  jsonString: string,
  nodeType: NodeTypeEnum,
): ValidationResult {
  // 1. 验证 JSON 格式
  let data: any;
  try {
    data = JSON.parse(jsonString);
  } catch (error: any) {
    return {
      valid: false,
      error: `JSON 语法错误: ${error.message}`,
    };
  }

  // 2. 验证是否为对象
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return {
      valid: false,
      error: "节点数据必须是对象类型",
    };
  }

  // 3. 根据节点类型验证必填字段
  switch (nodeType) {
    case NodeTypeEnum.Pipeline:
      return validatePipelineNodeData(data);
    case NodeTypeEnum.External:
      return validateExternalNodeData(data);
    case NodeTypeEnum.Anchor:
      return validateAnchorNodeData(data);
    case NodeTypeEnum.Sticker:
      return validateStickerNodeData(data);
    case NodeTypeEnum.Group:
      return validateGroupNodeData(data);
    default:
      return {
        valid: false,
        error: `未知的节点类型: ${nodeType}`,
      };
  }
}

/**
 * 验证 Pipeline 节点数据
 */
function validatePipelineNodeData(data: any): ValidationResult {
  // 检查 label
  if (!("label" in data)) {
    return {
      valid: false,
      error: "缺少必填字段: label",
    };
  }
  if (typeof data.label !== "string") {
    return {
      valid: false,
      error: "字段 label 必须是字符串类型",
    };
  }

  // 检查 recognition
  if (!("recognition" in data)) {
    return {
      valid: false,
      error: "缺少必填字段: recognition",
    };
  }
  if (typeof data.recognition !== "object" || data.recognition === null) {
    return {
      valid: false,
      error: "字段 recognition 必须是对象类型",
    };
  }
  if (!("type" in data.recognition)) {
    return {
      valid: false,
      error: "recognition 缺少必填字段: type",
    };
  }
  if (!("param" in data.recognition)) {
    return {
      valid: false,
      error: "recognition 缺少必填字段: param",
    };
  }

  // 检查 action
  if (!("action" in data)) {
    return {
      valid: false,
      error: "缺少必填字段: action",
    };
  }
  if (typeof data.action !== "object" || data.action === null) {
    return {
      valid: false,
      error: "字段 action 必须是对象类型",
    };
  }
  if (!("type" in data.action)) {
    return {
      valid: false,
      error: "action 缺少必填字段: type",
    };
  }
  if (!("param" in data.action)) {
    return {
      valid: false,
      error: "action 缺少必填字段: param",
    };
  }

  return { valid: true, data };
}

/**
 * 验证 External 节点数据
 */
function validateExternalNodeData(data: any): ValidationResult {
  if (!("label" in data)) {
    return {
      valid: false,
      error: "缺少必填字段: label",
    };
  }
  if (typeof data.label !== "string") {
    return {
      valid: false,
      error: "字段 label 必须是字符串类型",
    };
  }

  return { valid: true, data };
}

/**
 * 验证 Anchor 节点数据
 */
function validateAnchorNodeData(data: any): ValidationResult {
  if (!("label" in data)) {
    return {
      valid: false,
      error: "缺少必填字段: label",
    };
  }
  if (typeof data.label !== "string") {
    return {
      valid: false,
      error: "字段 label 必须是字符串类型",
    };
  }

  return { valid: true, data };
}

/**
 * 验证 Sticker 节点数据
 */
function validateStickerNodeData(data: any): ValidationResult {
  if (!("label" in data)) {
    return {
      valid: false,
      error: "缺少必填字段: label",
    };
  }
  if (typeof data.label !== "string") {
    return {
      valid: false,
      error: "字段 label 必须是字符串类型",
    };
  }

  if (!("content" in data)) {
    return {
      valid: false,
      error: "缺少必填字段: content",
    };
  }
  if (typeof data.content !== "string") {
    return {
      valid: false,
      error: "字段 content 必须是字符串类型",
    };
  }

  if (!("color" in data)) {
    return {
      valid: false,
      error: "缺少必填字段: color",
    };
  }
  if (typeof data.color !== "string") {
    return {
      valid: false,
      error: "字段 color 必须是字符串类型",
    };
  }

  const validColors = ["yellow", "green", "blue", "pink", "purple"];
  if (!validColors.includes(data.color)) {
    return {
      valid: false,
      error: `字段 color 必须是以下值之一: ${validColors.join(", ")}`,
    };
  }

  return { valid: true, data };
}

/**
 * 验证 Group 节点数据
 */
function validateGroupNodeData(data: any): ValidationResult {
  if (!("label" in data)) {
    return {
      valid: false,
      error: "缺少必填字段: label",
    };
  }
  if (typeof data.label !== "string") {
    return {
      valid: false,
      error: "字段 label 必须是字符串类型",
    };
  }

  if (!("color" in data)) {
    return {
      valid: false,
      error: "缺少必填字段: color",
    };
  }
  if (typeof data.color !== "string") {
    return {
      valid: false,
      error: "字段 color 必须是字符串类型",
    };
  }

  const validColors = ["blue", "green", "purple", "orange", "gray"];
  if (!validColors.includes(data.color)) {
    return {
      valid: false,
      error: `字段 color 必须是以下值之一: ${validColors.join(", ")}`,
    };
  }

  return { valid: true, data };
}

/**
 * 格式化 JSON 字符串
 * @param jsonString JSON 字符串
 * @param indent 缩进空格数
 * @returns 格式化后的 JSON 字符串
 */
export function formatNodeJson(jsonString: string, indent: number = 2): string {
  try {
    const data = JSON.parse(jsonString);
    return JSON.stringify(data, null, indent);
  } catch {
    return jsonString;
  }
}
