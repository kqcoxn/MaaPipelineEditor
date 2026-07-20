import { NodeTypeEnum } from "../../components/flow/nodes";
import type { NodeType, PipelineNodeType } from "../../stores/flow";
import uiT from "../../i18n/translate";

export interface ValidationResult {
  valid: boolean;
  error?: string;
  data?: any;
}

export interface NodeValidationResult {
  valid: boolean;
  error?: string;
  repaired?: NodeType;
}

/**
 * 验证节点数据对象并尝试修复
 * @param node 节点对象
 * @returns 验证结果，包含修复后的节点
 */
export function validateAndRepairNode(node: NodeType): NodeValidationResult {
  if (!node) {
    return { valid: false, error: uiT("ui.utils.nodeJsonValidator.nodeEmpty", "节点数据为空") };
  }

  if (!node.type) {
    return { valid: false, error: uiT("ui.utils.nodeJsonValidator.nodeTypeMissing", "节点类型缺失") };
  }

  if (!node.data) {
    return { valid: false, error: uiT("ui.utils.nodeJsonValidator.nodeDataCorrupted", "节点数据结构损坏") };
  }

  // 验证 Pipeline 节点
  if (node.type === NodeTypeEnum.Pipeline) {
    const pipelineNode = node as PipelineNodeType;
    let needsRepair = false;
    const repairedData = { ...pipelineNode.data };

    // 检查并修复 recognition
    if (
      !repairedData.recognition ||
      typeof repairedData.recognition !== "object"
    ) {
      needsRepair = true;
      repairedData.recognition = { type: "DirectHit", param: {} };
    } else {
      if (!repairedData.recognition.type) {
        needsRepair = true;
        repairedData.recognition.type = "DirectHit";
      }
      if (
        !repairedData.recognition.param ||
        typeof repairedData.recognition.param !== "object"
      ) {
        needsRepair = true;
        repairedData.recognition.param = {};
      }
    }

    // 检查并修复 action
    if (!repairedData.action || typeof repairedData.action !== "object") {
      needsRepair = true;
      repairedData.action = { type: "DoNothing", param: {} };
    } else {
      if (!repairedData.action.type) {
        needsRepair = true;
        repairedData.action.type = "DoNothing";
      }
      if (
        !repairedData.action.param ||
        typeof repairedData.action.param !== "object"
      ) {
        needsRepair = true;
        repairedData.action.param = {};
      }
    }

    // 检查并修复 others
    if (!repairedData.others || typeof repairedData.others !== "object") {
      needsRepair = true;
      repairedData.others = {};
    }

    if (needsRepair) {
      return {
        valid: true,
        error: uiT("ui.utils.nodeJsonValidator.nodeDataRepaired", "节点数据结构不完整，已自动修复"),
        repaired: { ...pipelineNode, data: repairedData } as NodeType,
      };
    }
  }

  return { valid: true };
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
      error: uiT("ui.utils.nodeJsonValidator.jsonSyntaxError", "JSON 语法错误: {{message}}", {
        message: error.message,
      }),
    };
  }

  // 2. 验证是否为对象
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return {
      valid: false,
      error: uiT("ui.utils.nodeJsonValidator.mustBeObject", "节点数据必须是对象类型"),
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
        error: uiT("ui.utils.nodeJsonValidator.unknownNodeType", "未知的节点类型: {{nodeType}}", {
          nodeType,
        }),
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
      error: uiT("ui.utils.nodeJsonValidator.missingField", "缺少必填字段: {{field}}", { field: "label" }),
    };
  }
  if (typeof data.label !== "string") {
    return {
      valid: false,
      error: uiT("ui.utils.nodeJsonValidator.fieldMustBeString", "字段 {{field}} 必须是字符串类型", {
        field: "label",
      }),
    };
  }

  // 检查 recognition
  if (!("recognition" in data)) {
    return {
      valid: false,
      error: uiT("ui.utils.nodeJsonValidator.missingField", "缺少必填字段: {{field}}", {
        field: "recognition",
      }),
    };
  }
  if (typeof data.recognition !== "object" || data.recognition === null) {
    return {
      valid: false,
      error: uiT("ui.utils.nodeJsonValidator.fieldMustBeObject", "字段 {{field}} 必须是对象类型", {
        field: "recognition",
      }),
    };
  }
  if (!("type" in data.recognition)) {
    return {
      valid: false,
      error: uiT("ui.utils.nodeJsonValidator.nestedMissingField", "{{parent}} 缺少必填字段: {{field}}", {
        parent: "recognition",
        field: "type",
      }),
    };
  }
  if (!("param" in data.recognition)) {
    return {
      valid: false,
      error: uiT("ui.utils.nodeJsonValidator.nestedMissingField", "{{parent}} 缺少必填字段: {{field}}", {
        parent: "recognition",
        field: "param",
      }),
    };
  }

  // 检查 action
  if (!("action" in data)) {
    return {
      valid: false,
      error: uiT("ui.utils.nodeJsonValidator.missingField", "缺少必填字段: {{field}}", {
        field: "action",
      }),
    };
  }
  if (typeof data.action !== "object" || data.action === null) {
    return {
      valid: false,
      error: uiT("ui.utils.nodeJsonValidator.fieldMustBeObject", "字段 {{field}} 必须是对象类型", {
        field: "action",
      }),
    };
  }
  if (!("type" in data.action)) {
    return {
      valid: false,
      error: uiT("ui.utils.nodeJsonValidator.nestedMissingField", "{{parent}} 缺少必填字段: {{field}}", {
        parent: "action",
        field: "type",
      }),
    };
  }
  if (!("param" in data.action)) {
    return {
      valid: false,
      error: uiT("ui.utils.nodeJsonValidator.nestedMissingField", "{{parent}} 缺少必填字段: {{field}}", {
        parent: "action",
        field: "param",
      }),
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
      error: uiT("ui.utils.nodeJsonValidator.missingField", "缺少必填字段: {{field}}", { field: "label" }),
    };
  }
  if (typeof data.label !== "string") {
    return {
      valid: false,
      error: uiT("ui.utils.nodeJsonValidator.fieldMustBeString", "字段 {{field}} 必须是字符串类型", {
        field: "label",
      }),
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
      error: uiT("ui.utils.nodeJsonValidator.missingField", "缺少必填字段: {{field}}", { field: "label" }),
    };
  }
  if (typeof data.label !== "string") {
    return {
      valid: false,
      error: uiT("ui.utils.nodeJsonValidator.fieldMustBeString", "字段 {{field}} 必须是字符串类型", {
        field: "label",
      }),
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
      error: uiT("ui.utils.nodeJsonValidator.missingField", "缺少必填字段: {{field}}", { field: "label" }),
    };
  }
  if (typeof data.label !== "string") {
    return {
      valid: false,
      error: uiT("ui.utils.nodeJsonValidator.fieldMustBeString", "字段 {{field}} 必须是字符串类型", {
        field: "label",
      }),
    };
  }

  if (!("content" in data)) {
    return {
      valid: false,
      error: uiT("ui.utils.nodeJsonValidator.missingField", "缺少必填字段: {{field}}", {
        field: "content",
      }),
    };
  }
  if (typeof data.content !== "string") {
    return {
      valid: false,
      error: uiT("ui.utils.nodeJsonValidator.fieldMustBeString", "字段 {{field}} 必须是字符串类型", {
        field: "content",
      }),
    };
  }

  if (!("color" in data)) {
    return {
      valid: false,
      error: uiT("ui.utils.nodeJsonValidator.missingField", "缺少必填字段: {{field}}", {
        field: "color",
      }),
    };
  }
  if (typeof data.color !== "string") {
    return {
      valid: false,
      error: uiT("ui.utils.nodeJsonValidator.fieldMustBeString", "字段 {{field}} 必须是字符串类型", {
        field: "color",
      }),
    };
  }

  const validColors = ["yellow", "green", "blue", "pink", "purple"];
  if (!validColors.includes(data.color)) {
    return {
      valid: false,
      error: uiT(
        "ui.utils.nodeJsonValidator.colorMustBeOneOf",
        "字段 color 必须是以下值之一: {{values}}",
        { values: validColors.join(", ") },
      ),
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
      error: uiT("ui.utils.nodeJsonValidator.missingField", "缺少必填字段: {{field}}", { field: "label" }),
    };
  }
  if (typeof data.label !== "string") {
    return {
      valid: false,
      error: uiT("ui.utils.nodeJsonValidator.fieldMustBeString", "字段 {{field}} 必须是字符串类型", {
        field: "label",
      }),
    };
  }

  if (!("color" in data)) {
    return {
      valid: false,
      error: uiT("ui.utils.nodeJsonValidator.missingField", "缺少必填字段: {{field}}", {
        field: "color",
      }),
    };
  }
  if (typeof data.color !== "string") {
    return {
      valid: false,
      error: uiT("ui.utils.nodeJsonValidator.fieldMustBeString", "字段 {{field}} 必须是字符串类型", {
        field: "color",
      }),
    };
  }

  const validColors = ["blue", "green", "purple", "orange", "gray"];
  if (!validColors.includes(data.color)) {
    return {
      valid: false,
      error: uiT(
        "ui.utils.nodeJsonValidator.colorMustBeOneOf",
        "字段 color 必须是以下值之一: {{values}}",
        { values: validColors.join(", ") },
      ),
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
