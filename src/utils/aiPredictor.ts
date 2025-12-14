import { OpenAIChat } from "./openai";
import type { NodeType, EdgeType, PipelineNodeType } from "../stores/flow";
import { SourceHandleTypeEnum } from "../components/flow/nodes";
import { useMFWStore } from "../stores/mfwStore";
import { useFlowStore } from "../stores/flow";
import { mfwProtocol } from "../services/server";
import {
  recoFields,
  actionFields,
  recoParamKeys,
  actionParamKeys,
} from "../core/fields";

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
    recognition: string;
    action: string;
    keyParams: Record<string, any>;
  }>;
  ocrResult: {
    hasContent: boolean;
    text: string;
    boxes: Array<{
      x: number;
      y: number;
      width: number;
      height: number;
      text: string;
      score: number;
    }>;
  } | null;
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
 * 收集节点上下文信息
 * @param nodeId 当前节点ID
 * @param nodes 所有节点
 * @param edges 所有连接
 * @param includeOCR 是否包含OCR识别结果
 * @param onProgress 进度回调
 */
export async function collectNodeContext(
  nodeId: string,
  nodes: NodeType[],
  edges: EdgeType[],
  includeOCR: boolean = true,
  onProgress?: ProgressCallback
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
    ocrResult: null,
  };

  // 收集前置节点信息
  onProgress?.("收集上下文", "分析前置节点关系...");
  const precedingEdges = edges.filter((e) => e.target === nodeId);
  for (const edge of precedingEdges) {
    const precedingNode = nodes.find((n) => n.id === edge.source) as
      | PipelineNodeType
      | undefined;
    if (!precedingNode) continue;

    // 确定连接类型
    let connectionType: "next" | "jump_back" | "on_error";
    switch (edge.sourceHandle) {
      case SourceHandleTypeEnum.Next:
        connectionType = "next";
        break;
      case SourceHandleTypeEnum.JumpBack:
        connectionType = "jump_back";
        break;
      case SourceHandleTypeEnum.Error:
        connectionType = "on_error";
        break;
      default:
        continue;
    }

    // 提取关键参数
    const keyParams: Record<string, any> = {};
    if (precedingNode.data.recognition?.param) {
      const param = precedingNode.data.recognition.param;
      // 只提取关键字段
      if (param.expected) keyParams.expected = param.expected;
      if (param.template)
        keyParams.template = Array.isArray(param.template)
          ? param.template.slice(0, 3)
          : param.template;
      if (param.roi) keyParams.roi = param.roi;
    }

    context.precedingNodes.push({
      label: precedingNode.data.label || "",
      connectionType,
      recognition: precedingNode.data.recognition?.type || "未设置",
      action: precedingNode.data.action?.type || "未设置",
      keyParams,
    });
  }

  // 收集OCR结果
  if (includeOCR) {
    try {
      const ocrResult = await performOCR(onProgress);
      context.ocrResult = ocrResult;
    } catch (err) {
      console.warn("OCR识别失败,降级推理:", err);
      context.ocrResult = {
        hasContent: false,
        text: "",
        boxes: [],
      };
    }
  }

  return context;
}

/**
 * 执行OCR识别
 */
async function performOCR(onProgress?: ProgressCallback): Promise<{
  hasContent: boolean;
  text: string;
  boxes: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    text: string;
    score: number;
  }>;
}> {
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
  if (!screenshotResult || !screenshotResult.success) {
    throw new Error("截图失败");
  }

  // 执行OCR识别
  onProgress?.("识别中", "正在进行OCR文字识别...");
  const ocrPromise = new Promise<any>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("OCR识别超时")), 15000);
    const unregister = mfwProtocol.onOCRResult((data) => {
      clearTimeout(timeout);
      unregister();
      resolve(data);
    });

    const success = mfwProtocol.requestOCR({
      controller_id: controllerId,
      roi: [0, 0, 0, 0],
    });

    if (!success) {
      clearTimeout(timeout);
      unregister();
      reject(new Error("OCR请求发送失败"));
    }
  });

  const ocrResult = await ocrPromise;
  if (!ocrResult || !ocrResult.success) {
    throw new Error("OCR识别失败");
  }

  // 转换box格式
  const boxes = (ocrResult.boxes || []).map((box: any) => ({
    x: box.x || 0,
    y: box.y || 0,
    width: box.width || box.w || 0,
    height: box.height || box.h || 0,
    text: box.text || "",
    score: box.score || 0,
  }));

  return {
    hasContent: !ocrResult.no_content,
    text: ocrResult.text || "",
    boxes,
  };
}

/**
 * 构建AI提示词
 * @param context 节点上下文
 */
export function buildPrompt(context: NodeContext): string {
  // 系统提示词
  const systemKnowledge = `
你是一个MaaFramework Pipeline协议配置专家。请严格按照以下协议规范推断节点配置。

# 识别算法类型(recognition)及其专属字段

## 1. DirectHit
- 说明: 直接命中,不进行任何识别,直接执行动作
- 专属字段: 无
- 重要约束: DirectHit 不支持 expected、template、roi 等识别参数,因为它根本不做识别!
- 适用场景: 无条件执行的起始节点、纯流程控制节点

## 2. OCR (文字识别)
- 说明: 识别屏幕上的文字
- 专属字段:
  - expected: string | string[] - 期望匹配的文本,支持正则表达式。如 "开始" 或 ["开始", "Start"]
  - threshold: number - 置信度阈值,默认0.3
  - replace: [string, string][] - 文字替换规则
  - only_rec: boolean - 仅识别不检测,需精确设置roi
  - model: string - 模型文件夹路径
- 通用字段: roi, roi_offset, order_by, index
- 适用场景: 识别按钮文字、提示信息、数字等

## 3. TemplateMatch (模板匹配/找图)
- 说明: 在屏幕上查找模板图片
- 专属字段:
  - template: string | string[] - 必填! 模板图片路径,如 "button.png" 或 ["btn1.png", "btn2.png"]
  - threshold: number | number[] - 匹配阈值,默认0.7
  - method: number - cv匹配算法,默认5(TM_CCOEFF_NORMED)
  - green_mask: boolean - 是否使用绿色掩码
- 通用字段: roi, roi_offset, order_by, index
- 适用场景: 识别图标、按钮图像、固定UI元素

## 4. FeatureMatch (特征匹配)
- 说明: 基于特征点的图像匹配,抗透视和尺寸变化
- 专属字段:
  - template: string | string[] - 必填! 模板图片路径
  - count: number - 特征点最低数量,默认4
  - detector: string - 特征检测器: SIFT/KAZE/AKAZE/BRISK/ORB
  - ratio: number - KNN匹配距离比值,默认0.6
  - green_mask: boolean
- 通用字段: roi, roi_offset, order_by, index
- 适用场景: 需要抗尺寸/透视变化的图像识别

## 5. ColorMatch (颜色匹配/找色)
- 说明: 识别特定颜色区域
- 专属字段:
  - lower: number[] | number[][] - 必填! 颜色下限,如 [200, 0, 0] (RGB)
  - upper: number[] | number[][] - 必填! 颜色上限,如 [255, 50, 50]
  - method: number - 颜色空间,4=RGB, 40=HSV, 6=GRAY
  - count: number - 符合的像素点最低数量,默认1
  - connected: boolean - 是否要求像素点相连
- 通用字段: roi, roi_offset, order_by, index
- 适用场景: 识别特定颜色的按钮、状态指示灯等

## 6. NeuralNetworkClassify (神经网络分类)
- 说明: 使用深度学习模型判断固定位置的分类
- 专属字段:
  - model: string - 必填! 模型文件路径
  - labels: string[] - 分类标签名
  - expected: number | number[] - 期望的分类下标
- 通用字段: roi, roi_offset, order_by, index

## 7. NeuralNetworkDetect (神经网络检测)
- 说明: 使用深度学习模型检测任意位置的目标
- 专属字段:
  - model: string - 必填! 模型文件路径
  - labels: string[] - 分类标签名
  - expected: number | number[] - 期望的分类下标
  - threshold: number | number[] - 置信度阈值,默认0.3
- 通用字段: roi, roi_offset, order_by, index

# 动作类型(action)及其专属字段

## 1. DoNothing
- 说明: 不执行任何动作,仅识别
- 专属字段: 无

## 2. Click (点击)
- 专属字段:
  - target: true | string | [x,y] | [x,y,w,h] - 点击位置,默认true(点击识别位置)
  - target_offset: [x,y,w,h] - 位置偏移

## 3. LongPress (长按)
- 专属字段:
  - target, target_offset: 同Click
  - duration: number - 长按时间(ms),默认1000

## 4. Swipe (滑动)
- 专属字段:
  - begin: true | string | [x,y] | [x,y,w,h] - 滑动起点
  - begin_offset: [x,y,w,h]
  - end: true | string | [x,y] | [x,y,w,h] - 滑动终点
  - end_offset: [x,y,w,h]
  - duration: number - 滑动时间(ms),默认200

## 5. InputText (输入文本)
- 专属字段:
  - input_text: string - 必填! 要输入的文本

## 6. StartApp (启动应用)
- 专属字段:
  - package: string - 必填! 包名或activity

## 7. StopApp (关闭应用)
- 专属字段:
  - package: string - 必填! 包名

## 8. ClickKey (按键)
- 专属字段:
  - key: number | number[] - 必填! 虚拟按键码

# 关键约束规则 (必须遵守!)

1. **字段匹配约束**: 每种识别类型只能使用其专属字段和通用字段
   - 错误示例: DirectHit + expected (DirectHit不识别任何内容!)
   - 错误示例: OCR + template (OCR不使用模板图片!)
   - 正确示例: OCR + expected, TemplateMatch + template

2. **必填字段约束**:
   - TemplateMatch/FeatureMatch 必须有 template
   - ColorMatch 必须有 lower 和 upper
   - NeuralNetworkClassify/Detect 必须有 model
   - InputText 必须有 input_text
   - StartApp/StopApp 必须有 package

3. **类型选择逻辑**:
   - 需要匹配文字 → 使用 OCR,设置 expected
   - 需要匹配图片 → 使用 TemplateMatch,设置 template
   - 需要匹配颜色 → 使用 ColorMatch,设置 lower/upper
   - 无条件直接执行 → 使用 DirectHit (不设置任何识别参数)

4. **roi字段**: [x, y, w, h] 格式,全屏设为 [0, 0, 0, 0]

5. **order_by可选值**: Horizontal | Vertical | Score | Area | Random | Length(仅OCR) | Expected

6. **默认值不填**：如果字段预测的值与默认值一致，则无需设置，例如 target: true 不需要生成

# 其他通用节点属性 (others字段)

这些字段适用于所有节点类型,用于控制节点的执行流程和行为:

## 流程控制
- **enabled**: boolean - 是否启用该节点,默认true。若为false,该节点会被跳过
- **inverse**: boolean - 反转识别结果,默认false。识别到当做没识别到,反之亦然
- **max_hit**: number - 该节点最多可被识别成功的次数,默认无限制。超过次数后会被跳过

## 延迟与等待
- **rate_limit**: number - 识别速率限制(ms),默认1000。每轮识别最低消耗该时间
- **timeout**: number - 识别超时时间(ms),默认20000
- **pre_delay**: number - 识别到到执行动作前的延迟(ms),默认200
- **post_delay**: number - 执行动作后到识别next的延迟(ms),默认200
- **pre_wait_freezes**: number | object - 执行动作前等待画面静止的时间(ms),默认0
- **post_wait_freezes**: number | object - 执行动作后等待画面静止的时间(ms),默认0

## 日志输出
- **focus**: string - 关注节点,配置节点通知消息,用于向UI展示自定义消息

## 重要说明
- 一般情况下,无需主动设置这些others字段,除非:
  1. 需要禁用某个节点 (enabled: false)
  2. 需要反转识别逻辑 (inverse: true)
  3. 需要限制节点执行次数 (max_hit)
  4. 需要特殊的延迟控制
  5. 需要设置锚点进行动态跳转
`;

  // 构建用户提示词
  let userPrompt = `当前节点:
- 节点名: ${context.currentNode.label}
`;

  // 前置节点信息
  if (context.precedingNodes.length > 0) {
    userPrompt += "\n前置节点信息:\n";
    context.precedingNodes.forEach((node, idx) => {
      userPrompt += `${idx + 1}. 节点名: ${node.label}\n`;
      userPrompt += `   - 连接类型: ${node.connectionType}\n`;
      userPrompt += `   - 识别方式: ${node.recognition}\n`;
      userPrompt += `   - 动作方式: ${node.action}\n`;
      if (Object.keys(node.keyParams).length > 0) {
        userPrompt += `   - 关键参数: ${JSON.stringify(
          node.keyParams
        ).substring(0, 200)}\n`;
      }
    });
  } else {
    userPrompt += "\n前置节点: 无\n";
  }

  // OCR识别结果
  userPrompt += "\nOCR识别结果:\n";
  if (context.ocrResult && context.ocrResult.hasContent) {
    userPrompt += `- 识别到的文本: ${context.ocrResult.text.substring(
      0,
      300
    )}\n`;
    userPrompt += `- 文本框数量: ${context.ocrResult.boxes.length}\n`;

    // 置信度最高的前3个
    const topBoxes = [...context.ocrResult.boxes]
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
    if (topBoxes.length > 0) {
      userPrompt += "- 置信度最高的文本:\n";
      topBoxes.forEach((box, idx) => {
        userPrompt += `  ${idx + 1}. "${box.text}" (置信度: ${box.score.toFixed(
          2
        )})\n`;
      });
    }
  } else {
    userPrompt += "- 未识别到文本内容\n";
  }

  // 推理要求
  userPrompt += `
请根据以上信息推断当前节点的配置。

**推理步骤**:
1. 分析节点名称和OCR结果,判断该节点的目的
2. 选择合适的识别类型:
   - 有OCR文本且需要匹配文字 → OCR + expected
   - 需要匹配图标/图片 → TemplateMatch + template
   - 起始节点/无条件执行 → DirectHit (不设置任何param)
3. 根据节点名称推断动作类型
4. 填充必要的参数

**返回JSON格式**:
\`\`\`json
{
  "recognition": {
    "type": "识别类型",
    "param": { "参数名": "参数值" }
  },
  "action": {
    "type": "动作类型",
    "param": { "参数名": "参数值" }
  },
  "reasoning": "推理依据说明"
}
\`\`\`

**约束规则 (必须遵守!)**:
1. DirectHit 的 param 必须为空对象 {},不要添加 expected/template/roi 等任何字段
2. OCR 要设置 expected 字段,不要设置 template
3. TemplateMatch 要设置 template 字段,不要设置 expected
4. 必须返回完整的 recognition 和 action 配置(包括 type 和 param)
5. 不要猜测ROI坐标,除非有明确依据
6. reasoning 字段必须说明为什么选择这个识别/动作类型
`;

  return systemKnowledge + "\n" + userPrompt;
}

/**
 * 调用AI进行预测
 * @param context 节点上下文
 * @param onProgress 进度回调
 */
export async function predictNodeConfig(
  context: NodeContext,
  onProgress?: ProgressCallback
): Promise<AIPrediction> {
  onProgress?.("构建提示词", "正在构建 AI 提示词...");
  const prompt = buildPrompt(context);

  const aiChat = new OpenAIChat({
    systemPrompt: "你是Pipeline配置专家,擅长推断节点配置。",
    temperature: 0.3,
    historyLimit: 5,
  });

  // 调用AI
  onProgress?.("生成中", "AI 正在分析并生成配置...");
  const result = await aiChat.send(
    prompt,
    `节点智能预测: ${context.currentNode.label}`
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
function parseAIResponse(content: string): AIPrediction {
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
              prediction.recognition.param
            ).join(", ")}),已忽略所有参数`
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
                  `AI预测的recognition参数 "${key}" 不在 ${recoType} 的有效字段中,已忽略`
                );
              }
            }
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
                `AI预测的action参数 "${key}" 不在 ${actionType} 的有效字段中,已忽略`
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
 * 应用AI预测结果到节点
 * @param nodeId 节点ID
 * @param prediction 预测结果
 */
export function applyPrediction(
  nodeId: string,
  prediction: AIPrediction
): number {
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
        }
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
        }
      );
    }
  }

  // 批量应用更新
  if (updates.length > 0) {
    batchSetNodeData(nodeId, updates);
  }

  return updates.length;
}
