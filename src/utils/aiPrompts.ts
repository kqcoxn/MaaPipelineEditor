/**
 * AI 提示词管理
 * 统一管理所有 AI 功能的提示词
 */

import type { NodeContext } from "./aiPredictor";

/**
 * MaaFramework Pipeline 协议精要
 */
export const PIPELINE_PROTOCOL_BRIEF = `
# MaaFramework Pipeline 协议精要

## 识别类型速查

| 类型 | 用途 | 关键参数 | 必填字段 |
|------|------|----------|----------|
| DirectHit | 不识别，直接命中 | roi | 无 |
| TemplateMatch | 模板匹配/找图 | template, threshold, method | template |
| OCR | 文字识别 | expected, threshold, replace | 无 |
| ColorMatch | 颜色匹配 | lower, upper, count, method | lower, upper |
| FeatureMatch | 特征匹配（抗变形） | template, count, detector | template |
| NeuralNetworkClassify | 深度学习分类 | model, labels, expected | model |
| NeuralNetworkDetect | 深度学习检测 | model, labels, expected, threshold | model |

## 动作类型速查

| 类型 | 用途 | 关键参数 |
|------|------|----------|
| DoNothing | 无动作 | 无 |
| Click | 点击 | target, target_offset |
| LongPress | 长按 | target, duration |
| Swipe | 滑动 | begin, end, duration |
| Scroll | 滚轮滚动 | target, dx, dy |
| InputText | 输入文本 | input_text |
| StartApp | 启动应用 | package |
| StopApp | 关闭应用 | package |
| ClickKey | 按键 | key |

## 关键约束规则

1. **DirectHit 不需要任何识别参数**：不要设置 expected、template、roi 等
2. **OCR 设置 expected**：匹配期望文字，不要设置 template
3. **TemplateMatch 设置 template**：模板图片路径，不要设置 expected
4. **target: true** 表示点击识别位置，这是默认值，可以省略
5. **roi 格式**：[x, y, w, h]，全屏可设为 [0, 0, 0, 0]

## 节点命名语义映射

- "点击XXX按钮" → Click + 识别XXX
- "滑动到XXX" → Swipe + DirectHit 或 识别终点
- "输入XXX" → InputText
- "启动XXX" → StartApp
- "等待XXX" → DoNothing + 识别XXX
`;

/**
 * 预测示例（few-shot）
 */
export const PREDICTION_EXAMPLES = `
## 正确示例

### 示例 1：点击按钮
节点名: "点击开始按钮"
画面内容: 界面中有"开始"按钮
输出:
\`\`\`json
{
  "recognition": { "type": "OCR", "param": { "expected": "开始" } },
  "action": { "type": "Click", "param": {} },
  "reasoning": "节点名表明是点击操作，按钮有文字'开始'，使用 OCR 识别文字后点击"
}
\`\`\`

### 示例 2：滑动操作
节点名: "向下滑动"
画面内容: 可滚动列表
输出:
\`\`\`json
{
  "recognition": { "type": "DirectHit", "param": {} },
  "action": { "type": "Swipe", "param": { "begin": [640, 500], "end": [640, 200], "duration": 300 } },
  "reasoning": "滑动操作无需先识别特定目标，使用 DirectHit 直接执行滑动，从下往上滑"
}
\`\`\`

### 示例 3：图标点击
节点名: "点击设置图标"
画面内容: 有齿轮形状的设置图标
输出:
\`\`\`json
{
  "recognition": { "type": "TemplateMatch", "param": { "template": "settings_icon.png" } },
  "action": { "type": "Click", "param": {} },
  "reasoning": "图标没有文字，需要通过图片模板匹配识别"
}
\`\`\`

## 错误示例（禁止）

### 错误 1：DirectHit + expected
\`\`\`json
{ "recognition": { "type": "DirectHit", "param": { "expected": "开始" } } }
\`\`\`
错误原因：DirectHit 不识别任何内容，不应该有 expected

### 错误 2：OCR + template
\`\`\`json
{ "recognition": { "type": "OCR", "param": { "template": "button.png" } } }
\`\`\`
错误原因：OCR 识别文字，不使用模板图片
`;

/**
 * 构建视觉预测的用户提示词
 * @param context 节点上下文
 */
export function buildVisionUserPrompt(context: NodeContext): string {
  let userPrompt = `## 当前任务
节点名: ${context.currentNode.label}
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
    userPrompt += "\n## 前置节点\n无（这是起始节点或独立节点）\n";
  }

  // 分析要求
  userPrompt += `
## 分析要求

请分析截图画面：
1. 识别画面中的可交互元素（按钮、文字、图标、输入框等）
2. 找出与节点名 "${context.currentNode.label}" 最相关的元素
3. 根据元素特征选择合适的识别类型：
   - 有明确文字 → OCR + expected
   - 图标/图片 → TemplateMatch + template
   - 颜色特征 → ColorMatch + lower/upper
   - 无需识别/滑动等操作 → DirectHit
4. 根据节点名推断动作类型

## 输出格式

返回 JSON（仅返回 JSON，不要有其他内容）：
\`\`\`json
{
  "recognition": { "type": "识别类型", "param": { "参数": "值" } },
  "action": { "type": "动作类型", "param": { "参数": "值" } },
  "reasoning": "推理依据"
}
\`\`\`

注意：
- 不要填写默认值（如 target: true）
- param 为空时返回 {}
- reasoning 必须说明选择该类型的原因
`;

  return userPrompt;
}

/**
 * 构建完整的视觉预测提示词
 * @param context 节点上下文
 */
export function buildVisionPredictionPrompt(context: NodeContext): string {
  return (
    PIPELINE_PROTOCOL_BRIEF +
    "\n" +
    PREDICTION_EXAMPLES +
    "\n" +
    buildVisionUserPrompt(context)
  );
}

/**
 * AI 搜索系统提示词模板
 * @param nodesContext 节点上下文 JSON 字符串
 */
export function buildAISearchPrompt(nodesContext: string): string {
  return `你是一个节点搜索助手。用户会给你一个节点列表和搜索需求，你需要找到最匹配的节点。

重要规则：
1. 仅返回最匹配的节点名称（label字段的值），不要有任何其他说明文字
2. 如果没有任何相关节点，返回：NOT_FOUND
3. 节点类型说明：pipeline=流程节点，external=外部节点，anchor=锚点节点
4. 对于pipeline节点：
   - recognition 是识别方式，包含 type（识别类型）和 param（具体参数）
   - action 是动作方式，包含 type（动作类型）和 param（具体参数）
   - others 是其他配置参数
5. 识别常见字段：template（模板图片）、threshold（阈值）、roi（识别区域）、expected（期望文本）等
6. 动作常见字段：target（目标位置）、input_text（输入文本）、package（应用包名）等
7. 根据用户描述，从节点的识别内容、动作内容、配置参数等维度综合判断最匹配的节点

节点列表：
${nodesContext}`;
}

/**
 * 系统提示词常量
 */
export const SYSTEM_PROMPTS = {
  /** Pipeline 配置专家 */
  PIPELINE_EXPERT:
    "你是 MaaFramework Pipeline 配置专家，擅长根据截图和节点名称推断节点配置。请严格按照协议规范返回 JSON 格式配置。",
  /** 简短回复测试 */
  TEST_CONNECTION: "简短回复",
} as const;
