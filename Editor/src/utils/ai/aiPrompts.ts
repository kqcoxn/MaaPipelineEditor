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
| TemplateMatch | 模板匹配/找图 | template, threshold, method, green_mask | template |
| OCR | 文字识别 | expected, threshold, replace, only_rec | 无 |
| ColorMatch | 颜色匹配 | lower, upper, count, method, connected | lower, upper |
| FeatureMatch | 特征匹配（抗透视/缩放） | template, count, detector, ratio | template |
| NeuralNetworkClassify | 深度学习分类（固定位置） | model, labels, expected | model |
| NeuralNetworkDetect | 深度学习检测（任意位置） | model, labels, expected, threshold | model |
| And | 组合识别（逻辑与） | all_of, box_index, sub_name | all_of |
| Or | 组合识别（逻辑或） | any_of | any_of |
| Custom | 自定义识别器 | custom_recognition, custom_recognition_param | custom_recognition |

## 动作类型速查

| 类型 | 用途 | 关键参数 |
|------|------|----------|
| DoNothing | 无动作 | 无 |
| Click | 点击 | target, target_offset, contact |
| LongPress | 长按 | target, duration |
| Swipe | 线性滑动 | begin, end, duration, end_hold |
| MultiSwipe | 多指滑动 | swipes[] |
| Scroll | 滚轮滚动（仅Win32） | target, dx, dy |
| TouchDown | 按下触控点 | contact, target |
| TouchMove | 移动触控点 | contact, target |
| TouchUp | 抬起触控点 | contact |
| ClickKey | 单击按键 | key[] |
| LongPressKey | 长按按键 | key, duration |
| KeyDown | 按下按键 | key |
| KeyUp | 松开按键 | key |
| InputText | 输入文本 | input_text |
| StartApp | 启动应用 | package |
| StopApp | 关闭应用 | package |
| StopTask | 停止任务链 | 无 |
| Command | 执行本地命令 | exec, args, detach |
| Shell | ADB Shell命令 | cmd, shell_timeout |
| Screencap | 保存截图 | filename, format |
| Custom | 自定义动作 | custom_action, custom_action_param, target |

## 关键约束规则

### 识别类型约束
1. **DirectHit 不需要识别参数**：不要设置 expected、template 等，仅可用 roi 指定区域
2. **OCR 设置 expected**：匹配期望文字（支持正则），不要设置 template
3. **TemplateMatch 设置 template**：模板图片路径（720p无损裁剪），不要设置 expected
4. **ColorMatch 必填 lower/upper**：颜色范围，method 默认 4(RGB)，需匹配通道数
5. **And/Or 组合识别**：all_of/any_of 中可内联定义或引用节点名

### 动作类型约束
1. **target 默认 true**：表示使用识别结果的位置，可省略
2. **target 其他格式**：节点名引用、[x,y]固定点、[x,y,w,h]区域随机
3. **Swipe 的 end 支持列表**：可实现折线滑动（多个途经点）
4. **Command 参数替换**：支持 {ENTRY} {NODE} {IMAGE} {BOX} {RESOURCE_DIR}

### 格式规范
1. **Pipeline v2 格式**：recognition/action 参数放入 param 中
2. **roi 格式**：[x, y, w, h]，全屏可设为 [0, 0, 0, 0]，支持负数
3. **threshold 默认值**：TemplateMatch=0.7, OCR=0.3

## 节点命名语义映射

- "点击XXX按钮/图标" → Click + OCR/TemplateMatch识别XXX
- "长按XXX" → LongPress + 识别XXX
- "向X滑动/滚动" → Swipe/Scroll + DirectHit
- "输入XXX" → InputText + 点击输入框
- "启动/打开XXX" → StartApp + package
- "关闭XXX" → StopApp + package
- "等待XXX" → DoNothing + 识别XXX
- "按XXX键" → ClickKey + key
- "截图XXX" → Screencap

## 单节点设计模式

### 模式1：图标按钮识别
图标无文字时使用 TemplateMatch，有文字优先 OCR：
\`\`\`json
{ "recognition": { "type": "TemplateMatch", "param": { "template": "icon.png" } } }
\`\`\`

### 模式2：多状态按钮
同一按钮可能有多种外观（亮/暗），使用 Or 组合：
\`\`\`json
{ "recognition": { "type": "Or", "param": {
  "any_of": [
    { "recognition": "OCR", "expected": "确认" },
    { "recognition": "TemplateMatch", "template": "confirm_btn.png" }
  ]
} } }
\`\`\`

### 模式3：多条件验证
同时验证多个条件（如按钮存在且未置灰），使用 And + sub_name：
\`\`\`json
{ "recognition": { "type": "And", "param": {
  "all_of": [
    { "sub_name": "btn", "recognition": "TemplateMatch", "template": "button.png" },
    { "recognition": "ColorMatch", "roi": "btn", "lower": [0,200,0], "upper": [100,255,100] }
  ]
} } }
\`\`\`

### 模式4：固定位置操作
滑动、点击固定位置使用 DirectHit：
\`\`\`json
{ "recognition": { "type": "DirectHit", "param": { "roi": [100, 200, 50, 50] } } }
\`\`\`

### 模式5：文本输入
先点击输入框，再输入文本（通常需要两个节点，预测时只生成点击输入框的节点）：
\`\`\`json
{ "recognition": { "type": "OCR", "param": { "expected": "请输入" } }, "action": { "type": "Click", "param": {} } }
\`\`\`

## 性能优化提示

1. **roi 精确裁剪**：缩小识别区域既提升速度又减少误识别
2. **green_mask 遮盖干扰**：模板图片中不需要匹配的区域涂绿 (0,255,0)
3. **threshold 调优**：TemplateMatch 建议 0.7，过低会误识别
4. **method 选择**：TemplateMatch 默认 5(CCOEFF_NORMED)，对光照变化鲁棒
5. **detector 选择**：FeatureMatch 默认 SIFT 精度最高，ORB 最快但无尺度不变性
6. **connected 选项**：ColorMatch 时设置 true 可过滤噪点
7. **only_rec 选项**：OCR 设置 true 跳过检测，仅识别（需精确 roi）
`;

/**
 * 预测示例（few-shot）
 */
export const PREDICTION_EXAMPLES = `
## 正确示例

### 示例 1：点击文字按钮
节点名: "点击开始按钮"
画面内容: 界面中有"开始"按钮
输出:
\`\`\`json
{
  "recognition": { "type": "OCR", "param": { "expected": "开始" } },
  "action": { "type": "Click", "param": {} },
  "reasoning": "节点名表明是点击操作，按钮有明确文字'开始'，使用 OCR 识别文字后点击"
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
  "reasoning": "滑动操作无需先识别特定目标，使用 DirectHit 直接执行，从下往上滑"
}
\`\`\`

### 示例 3：点击图标按钮
节点名: "点击设置图标"
画面内容: 有齿轮形状的设置图标，无文字
输出:
\`\`\`json
{
  "recognition": { "type": "TemplateMatch", "param": { "template": "settings_icon.png" } },
  "action": { "type": "Click", "param": {} },
  "reasoning": "图标没有文字，需要通过图片模板匹配识别"
}
\`\`\`

### 示例 4：长按操作
节点名: "长按确认按钮"
画面内容: 界面中有"确认"按钮，需要长按触发
输出:
\`\`\`json
{
  "recognition": { "type": "OCR", "param": { "expected": "确认" } },
  "action": { "type": "LongPress", "param": { "duration": 1000 } },
  "reasoning": "节点名明确要求长按，使用 OCR 识别'确认'文字后长按 1 秒"
}
\`\`\`

### 示例 5：输入文本
节点名: "输入用户名"
画面内容: 有输入框，提示文字"请输入用户名"
输出:
\`\`\`json
{
  "recognition": { "type": "OCR", "param": { "expected": "请输入用户名" } },
  "action": { "type": "InputText", "param": { "input_text": "test_user" } },
  "reasoning": "节点名表明需要输入文本，OCR 定位输入框后输入用户名"
}
\`\`\`

### 示例 6：启动应用
节点名: "启动游戏"
画面内容: 桌面或任意界面
输出:
\`\`\`json
{
  "recognition": { "type": "DirectHit", "param": {} },
  "action": { "type": "StartApp", "param": { "package": "com.example.game" } },
  "reasoning": "启动应用无需识别画面，使用 DirectHit 直接执行 StartApp"
}
\`\`\`

### 示例 7：颜色匹配判断
节点名: "检查是否有体力药"
画面内容: 体力药图标，特征是绿色药瓶
输出:
\`\`\`json
{
  "recognition": { "type": "ColorMatch", "param": { "lower": [0, 200, 0], "upper": [50, 255, 50], "count": 100 } },
  "action": { "type": "DoNothing", "param": {} },
  "reasoning": "通过颜色特征检测绿色药瓶，存在则说明有体力药"
}
\`\`\`

### 示例 8：Or组合识别（多外观按钮）
节点名: "点击确定按钮"
画面内容: 确定按钮可能有文字或图标两种形式
输出:
\`\`\`json
{
  "recognition": { "type": "Or", "param": {
    "any_of": [
      { "recognition": "OCR", "expected": "确定" },
      { "recognition": "TemplateMatch", "template": "confirm_icon.png" }
    ]
  } },
  "action": { "type": "Click", "param": {} },
  "reasoning": "确定按钮有多种外观形式，使用 Or 组合识别，匹配任意一种即可"
}
\`\`\`

### 示例 9：按键操作
节点名: "按返回键"
画面内容: 任意界面
输出:
\`\`\`json
{
  "recognition": { "type": "DirectHit", "param": {} },
  "action": { "type": "ClickKey", "param": { "key": [4] } },
  "reasoning": "Android 返回键 keyCode=4，无需识别画面直接执行按键"
}
\`\`\`

### 示例 10：带区域限制的识别
节点名: "点击右上角关闭按钮"
画面内容: 复杂界面，右上角有关闭按钮
输出:
\`\`\`json
{
  "recognition": { "type": "TemplateMatch", "param": { "template": "close_btn.png", "roi": [1100, 0, 180, 100] } },
  "action": { "type": "Click", "param": {} },
  "reasoning": "通过 roi 限制只在右上角区域识别关闭按钮，避免误识别其他区域"
}
\`\`\`

## 错误示例（禁止）

### 错误 1：DirectHit 设置了识别参数
\`\`\`json
{ "recognition": { "type": "DirectHit", "param": { "expected": "开始" } } }
\`\`\`
❌ 错误原因：DirectHit 不进行识别，不应该有 expected/template 等识别参数

### 错误 2：OCR 使用模板图片
\`\`\`json
{ "recognition": { "type": "OCR", "param": { "template": "button.png" } } }
\`\`\`
❌ 错误原因：OCR 识别文字，使用 expected 而非 template

### 错误 3：TemplateMatch 使用 expected
\`\`\`json
{ "recognition": { "type": "TemplateMatch", "param": { "expected": "确认" } } }
\`\`\`
❌ 错误原因：TemplateMatch 找图，使用 template 而非 expected

### 错误 4：ColorMatch 缺少必填参数
\`\`\`json
{ "recognition": { "type": "ColorMatch", "param": { "count": 50 } } }
\`\`\`
❌ 错误原因：ColorMatch 必须填写 lower 和 upper 定义颜色范围

### 错误 5：Click 设置了默认值 target
\`\`\`json
{ "action": { "type": "Click", "param": { "target": true } } }
\`\`\`
❌ 错误原因：target: true 是默认值，不需要显式填写

### 错误 6：And/Or 缺少必填数组
\`\`\`json
{ "recognition": { "type": "And", "param": { "box_index": 0 } } }
\`\`\`
❌ 错误原因：And 必须有 all_of 数组，Or 必须有 any_of 数组

### 错误 7：混淆识别类型适用场景
\`\`\`json
{ "recognition": { "type": "NeuralNetworkClassify", "param": { "model": "detect.onnx" } } }
\`\`\`
❌ 错误原因：NeuralNetworkClassify 用于固定位置分类，检测模型应使用 NeuralNetworkDetect

### 错误 8：target 设置成与 expected 相同的值
\`\`\`json
{
  "recognition": { "type": "OCR", "param": { "expected": "开始" } },
  "action": { "type": "Click", "param": { "target": "开始" } }
}
\`\`\`
❌ 错误原因：target 用于指定动作执行的目标位置，不需要也不应该设置成与 expected 相同的值。target 默认为 true（即使用当前识别结果的位置），除非需要引用其他节点或指定固定坐标，否则不需要设置 target 字段

### 错误 9：不必要的 target 显式设置
\`\`\`json
{
  "recognition": { "type": "TemplateMatch", "param": { "template": "close_btn.png" } },
  "action": { "type": "Click", "param": { "target": true } }
}
\`\`\`
❌ 错误原因：target: true 是默认行为，不需要显式填写。只有当需要引用其他节点识别结果（填写节点名）、引用锚点（[Anchor]锚点名）、或指定固定坐标/区域时才需要设置 target
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
1. 识别画面中的可交互元素（按钮、文字、图标、输入框、滑块等）
2. 找出与节点名 "${context.currentNode.label}" 最相关的元素
3. 根据元素特征选择合适的识别类型：
   - 有明确文字 → OCR + expected（支持正则）
   - 图标/图片按钮 → TemplateMatch + template
   - 颜色特征明显 → ColorMatch + lower/upper
   - 需要抗变形找图 → FeatureMatch + template
   - 多种外观匹配 → Or + any_of
   - 多条件同时满足 → And + all_of
   - 无需识别/滑动/按键/启动应用 → DirectHit
4. 根据节点名推断动作类型
5. 考虑是否需要 roi 限制识别区域

## 输出格式

返回 JSON（仅返回 JSON，不要有其他内容）：
\`\`\`json
{
  "recognition": { "type": "识别类型", "param": { "参数": "值" } },
  "action": { "type": "动作类型", "param": { "参数": "值" } },
  "reasoning": "推理依据"
}
\`\`\`

## 输出注意事项

1. **不要填写默认值**：target: true、timeout: 20000 等默认值无需填写
2. **param 为空时返回 {}**：不要省略 param 字段
3. **reasoning 必须说明**：为什么选择该识别类型和动作类型
4. **模板图片命名**：使用有意义的英文名，如 close_btn.png、settings_icon.png
5. **坐标范围**：假设截图分辨率为 1280x720，滑动坐标需在此范围内
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
    "你是 MaaFramework Pipeline 配置专家，擅长根据截图和节点名称推断节点配置。请严格按照协议规范返回 JSON 格式配置。注意：1.识别类型和动作类型必须从协议规定的选项中选择 2.不要使用不存在的参数 3.参数类型必须正确",
  /** 简短回复测试 */
  TEST_CONNECTION: "简短回复",
} as const;
