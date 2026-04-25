import { AIClient } from "./aiClient";
import type { NodeType, EdgeType, PipelineNodeType } from "../../stores/flow";
import {
  SourceHandleTypeEnum,
  TargetHandleTypeEnum,
} from "../../components/flow/nodes";
import { NodeTypeEnum } from "../../components/flow/nodes";
import { useMFWStore } from "../../stores/mfwStore";
import { useFlowStore } from "../../stores/flow";
import { mfwProtocol } from "../../services/server";
import {
  recoFields,
  actionFields,
  recoParamKeys,
  actionParamKeys,
} from "../../core/fields";
import { parsePipelineNodeForExport } from "../../core/parser";
import { buildVisionPredictionPrompt, SYSTEM_PROMPTS } from "./aiPrompts";

/**
 * 进度回调类型
 */
export type ProgressCallback = (stage: string, detail?: string) => void;

/**
 * 节点上下文信息接口
 */
export interface NodeContext {
  currentNode: {
    id: string;
    label: string;
    recognition: {
      type: string;
      param: Record<string, any>;
    } | null;
    action: {
      type: string;
      param: Record<string, any>;
    } | null;
  };
  precedingNodes: Array<{
    label: string;
    connectionType: "next" | "jump_back" | "on_error";
    nodeJson: Record<string, any>;
  }>;
  screenshot: string | null;
}

/**
 * AI预测结果接口
 */
export interface AIPrediction {
  recognition?: {
    type: string;
    param: Record<string, any>;
  };
  action?: {
    type: string;
    param: Record<string, any>;
  };
  reasoning: string;
}

/**
 * 验证提示结果
 */
export interface ValidationHint {
  category: string;
  fields: string[];
  reason: string;
}

/**
 * 从预测结果中提取需要验证的字段
 * 这些字段AI无法准确预测，需要用户通过字段工具验证
 */
export function extractValidationHints(
  prediction: AIPrediction,
): ValidationHint[] {
  const hints: ValidationHint[] = [];

  // 检查 recognition 参数
  if (prediction.recognition?.param) {
    const param = prediction.recognition.param;
    const recoType = prediction.recognition.type;

    // ROI 相关键值
    if (param.roi || param.roi_offset) {
      hints.push({
        category: "识别区域",
        fields: [
          ...(param.roi ? ["roi"] : []),
          ...(param.roi_offset ? ["roi_offset"] : []),
        ],
        reason: "坐标区域需要通过ROI工具框选验证",
      });
    }

    // 模板图片
    if (param.template) {
      hints.push({
        category: "模板图片",
        fields: ["template"],
        reason: "需要截图保存模板图片",
      });
    }

    // 颜色范围 (ColorMatch)
    if (recoType === "ColorMatch" && (param.lower || param.upper)) {
      hints.push({
        category: "颜色范围",
        fields: ["lower", "upper"],
        reason: "颜色范围需要通过取色器验证",
      });
    }

    // 模型文件
    if (param.model) {
      hints.push({
        category: "模型文件",
        fields: ["model"],
        reason: "需要提供ONNX模型文件路径",
      });
    }
  }

  // 检查 action 参数
  if (prediction.action?.param) {
    const param = prediction.action.param;

    // 目标坐标
    if (param.target || param.target_offset) {
      hints.push({
        category: "目标坐标",
        fields: [
          ...(param.target ? ["target"] : []),
          ...(param.target_offset ? ["target_offset"] : []),
        ],
        reason: "目标坐标需要通过工具定位验证",
      });
    }

    // 应用包名
    if (param.package) {
      hints.push({
        category: "应用包名",
        fields: ["package"],
        reason: "需要确认应用包名是否正确",
      });
    }

    // 输入文本
    if (param.input_text) {
      hints.push({
        category: "输入内容",
        fields: ["input_text"],
        reason: "需要确认输入内容是否正确",
      });
    }
  }

  return hints;
}

/**
 * 收集节点上下文信息
 * @param nodeId 当前节点ID
 * @param nodes 所有节点
 * @param edges 所有连接
 * @param onProgress 进度回调
 */
export async function collectNodeContext(
  nodeId: string,
  nodes: NodeType[],
  edges: EdgeType[],
  onProgress?: ProgressCallback,
): Promise<NodeContext> {
  // 查找当前节点
  const currentNode = nodes.find((n) => n.id === nodeId) as
    | PipelineNodeType
    | undefined;
  if (!currentNode) {
    throw new Error("节点不存在");
  }

  // 收集当前节点信息
  const context: NodeContext = {
    currentNode: {
      id: currentNode.id,
      label: currentNode.data.label || "",
      recognition: currentNode.data.recognition || null,
      action: currentNode.data.action || null,
    },
    precedingNodes: [],
    screenshot: null,
  };

  // 收集前置节点信息
  onProgress?.("收集上下文", "分析前置节点关系...");
  const precedingEdges = edges.filter((e) => e.target === nodeId);
  for (const edge of precedingEdges) {
    const precedingNode = nodes.find((n) => n.id === edge.source) as
      | PipelineNodeType
      | undefined;
    if (!precedingNode || precedingNode.type !== NodeTypeEnum.Pipeline) {
      continue;
    }

    // 确定连接类型
    let connectionType: "next" | "jump_back" | "on_error";
    switch (edge.sourceHandle) {
      case SourceHandleTypeEnum.Next:
        connectionType =
          edge.targetHandle === TargetHandleTypeEnum.JumpBack
            ? "jump_back"
            : "next";
        break;
      case SourceHandleTypeEnum.Error:
        connectionType = "on_error";
        break;
      default:
        continue;
    }

    // 获取完整节点 JSON
    let nodeJson: Record<string, any> = {};
    try {
      const parsedNode = parsePipelineNodeForExport(precedingNode);
      nodeJson = parsedNode || {};
    } catch (err) {
      console.warn("解析前置节点 JSON 失败:", err);
    }

    context.precedingNodes.push({
      label: precedingNode.data.label || "",
      connectionType,
      nodeJson,
    });
  }

  // 获取截图
  try {
    const screenshot = await performScreenshot(onProgress);
    context.screenshot = screenshot;
  } catch (err) {
    console.warn("截图获取失败:", err);
    context.screenshot = null;
  }

  return context;
}

/**
 * 执行截图
 */
async function performScreenshot(
  onProgress?: ProgressCallback,
): Promise<string | null> {
  const { connectionStatus, controllerId } = useMFWStore.getState();

  // 检查连接状态
  if (connectionStatus !== "connected" || !controllerId) {
    throw new Error("未连接到设备");
  }

  // 请求截图
  onProgress?.("截图中", "正在获取当前画面...");
  const screenshotPromise = new Promise<any>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("截图超时")), 10000);
    const unregister = mfwProtocol.onScreencapResult((data) => {
      clearTimeout(timeout);
      unregister();
      resolve(data);
    });

    const success = mfwProtocol.requestScreencap({
      controller_id: controllerId,
      use_cache: true,
    });

    if (!success) {
      clearTimeout(timeout);
      unregister();
      reject(new Error("截图请求发送失败"));
    }
  });

  const screenshotResult = await screenshotPromise;
  if (
    !screenshotResult ||
    !screenshotResult.success ||
    !screenshotResult.image
  ) {
    throw new Error("截图失败");
  }

  // 返回 base64 数据（移除 data:image/png;base64, 前缀）
  let imageData = screenshotResult.image;
  if (imageData.includes(",")) {
    imageData = imageData.split(",")[1];
  }

  return imageData;
}

/**
 * 调用AI进行预测（Vision 模式）
 * @param context 节点上下文
 * @param onProgress 进度回调
 */
export async function predictNodeConfig(
  context: NodeContext,
  onProgress?: ProgressCallback,
): Promise<AIPrediction> {
  if (!context.screenshot) {
    throw new Error("截图获取失败，请检查设备连接");
  }

  onProgress?.("构建提示词", "正在构建 AI 提示词...");
  const prompt = buildVisionPredictionPrompt(context);

  const aiChat = new AIClient({
    systemPrompt: SYSTEM_PROMPTS.PIPELINE_EXPERT,
    historyLimit: 5,
  });

  // 调用 Vision API
  onProgress?.("分析中", "AI 正在分析截图...");
  const result = await aiChat.sendVision(
    prompt,
    context.screenshot,
    `节点智能预测: ${context.currentNode.label}`,
  );

  if (!result.success) {
    throw new Error(result.error || "AI预测失败");
  }

  // 解析返回结果
  onProgress?.("解析结果", "正在解析 AI 返回的配置...");
  return parseAIResponse(result.content);
}

/**
 * 解析AI返回结果
 */
export function parseAIResponse(content: string): AIPrediction {
  // 尝试移除Markdown代码块标记
  let jsonStr = content.trim();
  if (jsonStr.startsWith("```json")) {
    jsonStr = jsonStr.substring(7);
  }
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.substring(3);
  }
  if (jsonStr.endsWith("```")) {
    jsonStr = jsonStr.substring(0, jsonStr.length - 3);
  }
  jsonStr = jsonStr.trim();

  try {
    const parsed = JSON.parse(jsonStr);

    // 验证格式
    if (!parsed.reasoning) {
      throw new Error("缺少reasoning字段");
    }

    return {
      recognition: parsed.recognition,
      action: parsed.action,
      reasoning: parsed.reasoning,
    };
  } catch (err) {
    // 尝试提取部分内容
    console.error("AI返回格式解析失败:", err);
    throw new Error("AI返回格式异常,无法解析");
  }
}

/**
 * 校验AI预测结果，过滤无效的类型和字段
 * @param prediction AI预测结果
 * @returns 校验后的预测结果
 */
export function validatePrediction(prediction: AIPrediction): AIPrediction {
  const validated: AIPrediction = {
    reasoning: prediction.reasoning,
  };

  // 校验 recognition
  if (prediction.recognition) {
    const recoType = prediction.recognition.type;

    // 检查类型是否存在
    if (recoType && recoType in recoFields) {
      validated.recognition = {
        type: recoType,
        param: {},
      };

      // 校验参数
      if (recoType === "DirectHit") {
        if (
          prediction.recognition.param &&
          Object.keys(prediction.recognition.param).length > 0
        ) {
          console.warn(
            `DirectHit 不应该有任何识别参数 (提供了: ${Object.keys(
              prediction.recognition.param,
            ).join(", ")}),已忽略所有参数`,
          );
        }
        // DirectHit 的 param 保持为空
        validated.recognition.param = {};
      } else {
        // 其他类型的校验
        if (prediction.recognition.param) {
          const validKeys = recoParamKeys[recoType]?.all || [];

          // 特殊约束检查
          const invalidCombinations: Record<string, string[]> = {
            OCR: ["template", "green_mask"],
            TemplateMatch: ["expected", "only_rec"],
            FeatureMatch: ["expected", "only_rec"],
            ColorMatch: ["expected", "template"],
          };

          const invalidKeys = invalidCombinations[recoType] || [];

          Object.entries(prediction.recognition.param).forEach(
            ([key, value]) => {
              // 检查是否是无效组合
              if (invalidKeys.includes(key)) {
                console.warn(`${recoType} 不应该使用 "${key}" 字段,已忽略`);
                return;
              }

              // 检查是否是有效字段
              if (validKeys.includes(key)) {
                validated.recognition!.param[key] = value;
              } else {
                console.warn(
                  `AI预测的recognition参数 "${key}" 不在 ${recoType} 的有效字段中,已忽略`,
                );
              }
            },
          );
        }
      }
    } else {
      console.warn(`AI预测的recognition类型 "${recoType}" 无效,已忽略`);
    }
  }

  // 校验 action
  if (prediction.action) {
    const actionType = prediction.action.type;

    // 检查类型是否存在
    if (actionType && actionType in actionFields) {
      validated.action = {
        type: actionType,
        param: {},
      };

      if (actionType === "DoNothing") {
        if (
          prediction.action.param &&
          Object.keys(prediction.action.param).length > 0
        ) {
          console.warn(`DoNothing 不应该有任何动作参数,已忽略`);
        }
        validated.action.param = {};
      } else {
        // 校验参数
        if (prediction.action.param) {
          const validKeys = actionParamKeys[actionType]?.all || [];
          Object.entries(prediction.action.param).forEach(([key, value]) => {
            if (validKeys.includes(key)) {
              validated.action!.param[key] = value;
            } else {
              console.warn(
                `AI预测的action参数 "${key}" 不在 ${actionType} 的有效字段中,已忽略`,
              );
            }
          });
        }
      }
    } else {
      console.warn(`AI预测的action类型 "${actionType}" 无效,已忽略`);
    }
  }

  return validated;
}

/**
 * 应用预测结果返回类型
 */
export interface ApplyPredictionResult {
  filledCount: number;
  validationHints: ValidationHint[];
}

/**
 * 应用AI预测结果到节点
 * @param nodeId 节点ID
 * @param prediction 预测结果
 * @returns 应用结果，包含填充字段数和验证提示
 */
export function applyPrediction(
  nodeId: string,
  prediction: AIPrediction,
): ApplyPredictionResult {
  const { batchSetNodeData } = useFlowStore.getState();
  const nodes = useFlowStore.getState().nodes;
  const currentNode = nodes.find((n) => n.id === nodeId) as
    | PipelineNodeType
    | undefined;

  if (!currentNode) {
    throw new Error("节点不存在");
  }

  // 校验预测结果
  const validatedPrediction = validatePrediction(prediction);

  // 提取需要验证的字段提示
  const validationHints = extractValidationHints(validatedPrediction);

  // 收集所有需要更新的字段
  const updates: Array<{ type: string; key: string; value: any }> = [];

  // 处理recognition
  if (validatedPrediction.recognition) {
    // 设置类型
    updates.push({
      type: "type",
      key: "recognition",
      value: validatedPrediction.recognition.type,
    });

    // 设置参数
    if (validatedPrediction.recognition.param) {
      Object.entries(validatedPrediction.recognition.param).forEach(
        ([key, value]) => {
          updates.push({ type: "recognition", key, value });
        },
      );
    }
  }

  // 处理action
  if (validatedPrediction.action) {
    // 设置类型
    updates.push({
      type: "type",
      key: "action",
      value: validatedPrediction.action.type,
    });

    // 设置参数
    if (validatedPrediction.action.param) {
      Object.entries(validatedPrediction.action.param).forEach(
        ([key, value]) => {
          updates.push({ type: "action", key, value });
        },
      );
    }
  }

  // 批量应用更新
  if (updates.length > 0) {
    batchSetNodeData(nodeId, updates);
  }

  return {
    filledCount: updates.length,
    validationHints,
  };
}
