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
import { useFileStore } from "../../stores/fileStore";
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

1. **label 字段（必填）**：
   - 必须提供，不能省略
   - 长度控制在 4-15 个字符
   - 清晰描述这个步骤在做什么（动词+对象）
   - 示例："点击开始按钮"、"输入账号"、"滑动到下一页"、"启动应用"
   - 不要使用"新节点"、"节点1"等无意义名称
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

    // 提取 label，如果没有则生成智能默认名称
    let label = parsed.label;
    if (!label || typeof label !== "string" || label.trim().length === 0) {
      // 尝试从 reasoning 或 action type 中生成有意义的名称
      label = generateSmartLabel(parsed);
    } else {
      // 清理 label，去除多余空格
      label = label.trim();
      // 如果 label 过长，截断并添加省略号
      if (label.length > 20) {
        label = label.slice(0, 20) + "...";
      }
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
 * 智能生成节点标签
 * 当 AI 没有返回 label 时，根据预测结果生成有意义的名称
 */
function generateSmartLabel(parsed: any): string {
  // 优先级 1: 从 reasoning 中提取关键动作
  if (parsed.reasoning && typeof parsed.reasoning === "string") {
    const reasoning = parsed.reasoning;

    // 尝试提取中文动词短语（5-15字符）
    const chineseMatch = reasoning.match(/[\u4e00-\u9fa5]{4,15}/);
    if (chineseMatch) {
      return chineseMatch[0];
    }
  }

  // 优先级 2: 根据 action type 生成
  if (parsed.action && parsed.action.type) {
    const actionType = parsed.action.type;
    const actionMap: Record<string, string> = {
      Click: "点击操作",
      Swipe: "滑动操作",
      Key: "按键操作",
      InputText: "输入文本",
      StartApp: "启动应用",
      StopApp: "停止应用",
      Screenshot: "截图操作",
      DoNothing: "等待识别",
    };
    if (actionMap[actionType]) {
      return actionMap[actionType];
    }
  }

  // 优先级 3: 根据 recognition type 生成
  if (parsed.recognition && parsed.recognition.type) {
    const recoType = parsed.recognition.type;
    const recoMap: Record<string, string> = {
      OCR: "文字识别",
      TemplateMatch: "模板匹配",
      ColorMatch: "颜色匹配",
      FeatureMatch: "特征匹配",
      DirectHit: "直接命中",
    };
    if (recoMap[recoType]) {
      return recoMap[recoType];
    }
  }

  // 默认：返回通用名称
  return "新节点";
}

/**
 * 执行节点动作
 * 通过 mfwProtocol 发送执行请求，使用 pipeline_override 方式
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

  // 获取当前文件路径,推导出资源根目录
  const currentFile = useFileStore.getState().currentFile;
  const filePath = currentFile.config?.filePath;
  if (!filePath) {
    return { success: false, error: "未保存文件,无法获取资源路径" };
  }

  // 执行前保存文件,确保后端加载的是最新版本
  const { saveFlow } = await import("../../stores/fileStore");
  const { useConfigStore } = await import("../../stores/configStore");
  const { localServer } = await import("../../services/server");
  const { message } = await import("antd");

  const saveFilesBeforeDebug =
    useConfigStore.getState().configs.saveFilesBeforeDebug;

  if (saveFilesBeforeDebug && localServer.isConnected()) {
    const fileStore = useFileStore.getState();
    // 保存当前文件到 files 数组
    saveFlow();

    // 获取所有带有 filePath 的文件
    const filesToSave = fileStore.files.filter(
      (file) => file.config.filePath && !file.config.isDeleted,
    );

    if (filesToSave.length > 0) {
      let savedCount = 0;
      let failedCount = 0;

      for (const file of filesToSave) {
        try {
          const success = await fileStore.saveFileToLocal(
            file.config.filePath,
            file,
          );
          if (success) {
            savedCount++;
          } else {
            failedCount++;
          }
        } catch (error) {
          console.error(
            `[explorationAI] Failed to save file: ${file.fileName}`,
            error,
          );
          failedCount++;
        }
      }

      if (savedCount > 0) {
        message.success(`已保存 ${savedCount} 个文件`);
      }

      if (failedCount > 0) {
        message.warning(`${failedCount} 个文件保存失败`);
        return { success: false, error: "文件保存失败，请检查后重试" };
      }
    }
  }

  // 从文件路径推导资源根目录
  // 文件路径示例: D:\test\base\pipeline\其他\说明.json
  // 资源根目录: D:\test\base (包含 pipeline 文件夹的父目录)
  const pathParts = filePath.split(/[\\/]/);
  const pipelineIndex = pathParts.findIndex(
    (part) => part.toLowerCase() === "pipeline",
  );

  let resourcePath: string;
  if (pipelineIndex > 0) {
    // 找到 pipeline 文件夹,取其父目录作为资源根目录
    resourcePath = pathParts
      .slice(0, pipelineIndex)
      .join(filePath.includes("\\") ? "\\" : "/");
  } else {
    // 如果没有找到 pipeline 文件夹,使用文件所在目录
    resourcePath = filePath
      .replace(/[\\/][^\\/]*$/, "")
      .replace(/[\\/][^\\/]*$/, ""); // 向上两级
  }

  // 构建 pipeline_override
  const nodeData = node.data as {
    label?: string;
    recognition?: { type: string; param: Record<string, any> };
    action?: { type: string; param: Record<string, any> };
    next?: string[];
    [key: string]: any;
  };

  // 使用节点名称（label）作为 entry，而不是节点 ID
  const entryName = nodeData.label || node.id;

  // 构建 override 配置
  const pipelineOverride: Record<string, any> = {
    [entryName]: {
      recognition: nodeData.recognition
        ? {
            type: nodeData.recognition.type,
            ...nodeData.recognition.param,
          }
        : undefined,
      action: nodeData.action
        ? {
            type: nodeData.action.type,
            ...nodeData.action.param,
          }
        : undefined,
    },
  };

  // 清除 undefined 字段
  if (!pipelineOverride[entryName].recognition) {
    delete pipelineOverride[entryName].recognition;
  }
  if (!pipelineOverride[entryName].action) {
    delete pipelineOverride[entryName].action;
  }

  try {
    // 发送执行请求
    const result = await new Promise<{ success: boolean; error?: string }>(
      (resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("执行超时（30s）"));
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
          resource_path: resourcePath,
          entry: entryName, // 使用节点名称而不是节点 ID
          pipeline_override: pipelineOverride,
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
