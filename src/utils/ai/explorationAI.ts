/**
 * 探索模式 AI 工具函数
 * 复用现有的 AI 预测功能，为探索模式提供预测和执行能力
 */

import type { NodeType, PositionType } from "../../stores/flow";
import type {
  AIPrediction,
  ProgressCallback,
  NodeContext,
} from "./aiPredictor";
import { collectNodeContext } from "./aiPredictor";
import { useFlowStore } from "../../stores/flow";
import { useMFWStore } from "../../stores/mfwStore";
import { mfwProtocol } from "../../services/server";
import { NodeTypeEnum } from "../../components/flow/nodes/constants";
import { OpenAIChat } from "./openai";
import { SYSTEM_PROMPTS } from "./aiPrompts";

/**
 * 计算新节点位置
 * 优先级：最后确认的节点右侧 > 起始节点右侧 > 视口中心
 */
export function calculateGhostNodePosition(
  startNodeId: string | null,
  confirmedNodeIds: string[],
  nodes: NodeType[],
  viewport: { x: number; y: number; zoom: number },
  size: { width: number; height: number },
): PositionType {
  // 确定参考节点
  let referenceNodeId: string | null = null;
  if (confirmedNodeIds.length > 0) {
    referenceNodeId = confirmedNodeIds[confirmedNodeIds.length - 1];
  } else if (startNodeId) {
    referenceNodeId = startNodeId;
  }

  // 如果有参考节点，放在其右侧
  if (referenceNodeId) {
    const refNode = nodes.find((n) => n.id === referenceNodeId);
    if (refNode) {
      return {
        x: refNode.position.x + 260,
        y: refNode.position.y,
      };
    }
  }

  // 无参考节点，使用视口中心
  return {
    x: -((viewport.x - size.width / 2) / viewport.zoom),
    y: -((viewport.y - size.height / 2) / viewport.zoom),
  };
}

/**
 * 探索模式预测结果接口
 */
export interface ExplorationPrediction {
  prediction: AIPrediction;
  label: string;
}

/**
 * 执行探索预测
 * 复用 collectNodeContext 和 predictNodeConfig
 */
export async function predictExplorationStep(
  goal: string,
  startNodeId: string | null,
  confirmedNodeIds: string[],
  onProgress?: ProgressCallback,
): Promise<ExplorationPrediction> {
  const { nodes, edges } = useFlowStore.getState();

  // 确定上下文采集的参考节点
  // 如果有已确认节点，使用最后一个作为前置
  // 否则使用起始节点
  let contextNodeId: string | null = null;
  if (confirmedNodeIds.length > 0) {
    contextNodeId = confirmedNodeIds[confirmedNodeIds.length - 1];
  } else if (startNodeId) {
    contextNodeId = startNodeId;
  }

  // 收集上下文
  let context;
  if (contextNodeId) {
    // 有前置节点，收集上下文
    context = await collectNodeContext(contextNodeId, nodes, edges, onProgress);
  } else {
    // 无前置节点，只采集截图
    onProgress?.("截图中", "正在获取当前画面...");
    const screenshot = await performExplorationScreenshot();
    context = {
      currentNode: {
        id: "ghost",
        label: "新节点",
        recognition: null,
        action: null,
      },
      precedingNodes: [],
      screenshot,
    };
  }

  // 调用 AI 预测（使用探索模式专用的提示词）
  const prediction = await predictExplorationNodeConfig(
    context,
    goal,
    onProgress,
  );

  return prediction;
}

/**
 * 构建探索模式的用户提示词
 * 与普通的视觉预测不同，探索模式需要提供目标描述
 */
function buildExplorationPrompt(context: NodeContext, goal: string): string {
  let userPrompt = `## 探索目标
${goal}
`;

  // 前置节点信息（完整 JSON）
  if (context.precedingNodes.length > 0) {
    userPrompt += "\n## 前置节点配置\n";
    context.precedingNodes.forEach((node, idx) => {
      userPrompt += `\n### 前置节点 ${idx + 1}: ${node.label}\n`;
      userPrompt += `连接类型: ${node.connectionType}\n`;
      if (node.nodeJson && Object.keys(node.nodeJson).length > 0) {
        userPrompt += `完整配置:\n\`\`\`json\n${JSON.stringify(node.nodeJson, null, 2)}\n\`\`\`\n`;
      }
    });
  } else {
    userPrompt += "\n## 前置节点\n无（这是流程的第一个节点）\n";
  }

  // 分析要求
  userPrompt += `
## 分析要求

请分析截图画面，完成以下任务：
1. 理解探索目标："${goal}"
2. 识别画面中的可交互元素（按钮、文字、图标、输入框、滑块等）
3. 找出与目标最相关的元素
4. 根据元素特征选择合适的识别类型：
   - 有明确文字 → OCR + expected（支持正则）
   - 图标/图片按钮 → TemplateMatch + template
   - 颜色特征明显 → ColorMatch + lower/upper
   - 需要抗变形找图 → FeatureMatch + template
   - 多种外观匹配 → Or + any_of
   - 多条件同时满足 → And + all_of
   - 无需识别/滑动/按键/启动应用 → DirectHit
5. 根据目标推断合适的动作类型
6. 考虑是否需要 roi 限制识别区域

## 输出格式

返回 JSON（仅返回 JSON，不要有其他内容）：
\`\`\`json
{
  "label": "节点名称（简短描述，如：点击开始按钮、输入用户名）",
  "recognition": { "type": "识别类型", "param": { "参数": "值" } },
  "action": { "type": "动作类型", "param": { "参数": "值" } },
  "reasoning": "推理依据，说明为什么选择该识别类型和动作类型"
}
\`\`\`

## 输出注意事项

1. **label 字段**：提供一个简短、清晰的节点名称，描述这个步骤在做什么
2. **不要填写默认值**：target: true、timeout: 20000 等默认值无需填写
3. **param 为空时返回 {}**：不要省略 param 字段
4. **reasoning 必须说明**：为什么选择该识别类型和动作类型
5. **模板图片命名**：使用有意义的英文名，如 close_btn.png、settings_icon.png
6. **坐标范围**：假设截图分辨率为 1280x720，滑动坐标需在此范围内
`;

  return userPrompt;
}

/**
 * 探索模式专用的 AI 预测函数
 * 与普通预测的区别：
 * 1. 使用探索模式专用的提示词（包含目标描述）
 * 2. AI 返回的结果包含推荐的节点名称（label）
 */
async function predictExplorationNodeConfig(
  context: NodeContext,
  goal: string,
  onProgress?: ProgressCallback,
): Promise<ExplorationPrediction> {
  if (!context.screenshot) {
    throw new Error("截图获取失败，请检查设备连接");
  }

  onProgress?.("构建提示词", "正在构建 AI 提示词...");
  const prompt = buildExplorationPrompt(context, goal);

  const aiChat = new OpenAIChat({
    systemPrompt: SYSTEM_PROMPTS.PIPELINE_EXPERT,
    historyLimit: 5,
  });

  // 调用 Vision API
  onProgress?.("分析中", "AI 正在分析截图...");
  const result = await aiChat.sendVision(
    prompt,
    context.screenshot,
    `流程探索: ${goal}`,
  );

  if (!result.success) {
    throw new Error(result.error || "AI预测失败");
  }

  // 解析返回结果
  onProgress?.("解析结果", "正在解析 AI 返回的配置...");
  const parsed = parseExplorationAIResponse(result.content);

  return parsed;
}

/**
 * 解析探索模式的 AI 返回结果
 * 与普通解析的区别：包含 label 字段
 */
function parseExplorationAIResponse(content: string): ExplorationPrediction {
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

    // 提取 label，如果没有则生成默认名称
    let label = parsed.label;
    if (!label || typeof label !== "string") {
      // 尝试从 reasoning 中提取
      label = parsed.reasoning.slice(0, 15);
    }

    return {
      label,
      prediction: {
        recognition: parsed.recognition,
        action: parsed.action,
        reasoning: parsed.reasoning,
      },
    };
  } catch (err) {
    console.error("AI返回格式解析失败:", err);
    throw new Error("AI返回格式异常,无法解析");
  }
}

/**
 * 执行节点动作
 * 通过 mfwProtocol 发送执行请求
 */
export async function executeNodeAction(
  nodeId: string,
): Promise<{ success: boolean; error?: string }> {
  const { nodes } = useFlowStore.getState();
  const { controllerId } = useMFWStore.getState();

  if (!controllerId) {
    return { success: false, error: "设备未连接" };
  }

  const node = nodes.find((n) => n.id === nodeId);
  if (!node || node.type !== NodeTypeEnum.Pipeline) {
    return { success: false, error: "节点不存在" };
  }

  const nodeData = node.data as {
    recognition: { type: string; param: Record<string, any> };
    action: { type: string; param: Record<string, any> };
  };
  const recognition = nodeData.recognition;
  const action = nodeData.action;

  try {
    // 发送执行请求
    const result = await new Promise<{ success: boolean; error?: string }>(
      (resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("执行超时"));
        }, 30000);

        const unregister = mfwProtocol.onExecuteActionResult((data) => {
          clearTimeout(timeout);
          unregister();
          resolve({
            success: data.success,
            error: data.error,
          });
        });

        const success = mfwProtocol.executeAction({
          controller_id: controllerId,
          recognition_type: recognition.type,
          recognition_param: recognition.param,
          action_type: action.type,
          action_param: action.param,
        });

        if (!success) {
          clearTimeout(timeout);
          unregister();
          resolve({ success: false, error: "执行请求发送失败" });
        }
      },
    );

    return result;
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "执行失败",
    };
  }
}

/**
 * 采集探索模式截图
 */
async function performExplorationScreenshot(): Promise<string | null> {
  const { connectionStatus, controllerId } = useMFWStore.getState();

  if (connectionStatus !== "connected" || !controllerId) {
    throw new Error("未连接到设备");
  }

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

  // 返回 base64 数据（移除前缀）
  let imageData = screenshotResult.image;
  if (imageData.includes(",")) {
    imageData = imageData.split(",")[1];
  }

  return imageData;
}
