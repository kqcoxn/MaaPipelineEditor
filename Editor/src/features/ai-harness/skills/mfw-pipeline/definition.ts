import type { AnySchemaObject } from "ajv";
import type {
  HarnessSkill,
  ToolDefinition,
  ToolExecutionContext,
  ToolExecutionResult,
  ToolHandler,
} from "../../core/types";

export const MFW_PIPELINE_SKILL_ID = "maafw-pipeline";
export const READ_MFW_PIPELINE_REFERENCE_TOOL_NAME =
  "read_mfw_pipeline_reference";

const BUILTIN_SOURCE = "builtin:mfw-pipeline";

const skillInstructions = `
# MaaFramework Pipeline 处理工作流

- Pipeline 由命名节点组成。读取和修改节点时同时检查 next、on_error、roi、target、组合识别和锚点引用。
- 支持 v1 与 v2 混用：v1 的 recognition/action 是字符串，参数与节点字段同级；v2 使用 { type, param }。
- timeout 控制当前节点的 next 列表识别超时。要控制某节点 recognition 的等待时间，应修改其父节点的 timeout。
- roi 表示识别范围，box 表示识别结果，target 表示动作目标；字符串可引用节点名或 [Anchor]锚点名。
- 修改画布前先读取当前节点与状态版本，写操作携带最新 expectedStateVersion，完成后校验画布。
- 复杂任务涉及多个节点时，优先使用当前能力包提供的批量读取和批量变更能力，避免逐个调用。
- 需要确认具体字段、默认值或类型时，调用 ${READ_MFW_PIPELINE_REFERENCE_TOOL_NAME}。不传 section 返回内置目录，传完整路径读取章节，例如 属性字段/Pipeline v2、算法类型/OCR、动作类型/Click。
`;

export const mfwPipelineSkill: HarnessSkill = {
  id: MFW_PIPELINE_SKILL_ID,
  version: "1.1.0",
  name: "MaaFramework Pipeline",
  description: "MaaFramework Pipeline 节点、字段、识别算法和动作协议",
  instructions: skillInstructions.trim(),
};

export const mfwPipelineReferenceTool: ToolDefinition = {
  name: READ_MFW_PIPELINE_REFERENCE_TOOL_NAME,
  description:
    "按章节读取 MPE 内置的 MaaFramework Pipeline 协议说明；不传 section 返回目录",
  inputSchema: {
    type: "object",
    properties: {
      section: {
        type: "string",
        minLength: 1,
        description:
          "内置章节标题或完整路径，例如 OCR、算法类型/OCR、动作类型/Click",
      },
    },
    additionalProperties: false,
  } satisfies AnySchemaObject,
};

const pipelineGuideSections: Readonly<Record<string, string>> = Object.freeze({
  基础格式: `Pipeline 是以节点名为键、节点配置为值的 JSON/JSONC 对象。以点开头的目录或文件不会被加载，以 $ 开头的根字段不会被解析。节点可通过 next 和 on_error 形成有向流程。`,
  执行逻辑: `任务从入口节点开始。当前节点完成 action 后，按顺序循环识别 next 中的候选节点，只执行第一个命中的节点。动作失败或 next 整体识别超时后进入 on_error。next 为空时任务结束；存在 JumpBack 时先回跳。StopTask 或外部停止也会终止任务。`,
  节点流程: `节点顺序：pre_wait_freezes -> pre_delay -> action -> repeat_wait_freezes/repeat_delay/repeat -> post_wait_freezes -> post_delay -> 截图并循环识别 next。每轮识别至少间隔 rate_limit，超过 timeout 后进入 on_error。`,
  属性字段: `节点通用字段分为流程、识别、动作、等待、重复、通知和附加数据。必选参数可以暂时为空，但必须在实际运行前补齐。需要具体类型时读取本章节的子章节。`,
  "属性字段/坐标与引用": `roi 是识别范围，roi_offset 在其基础上偏移；box 是识别命中区域；target 是动作目标，target_offset 在其基础上偏移。roi/target 可使用 [x,y,w,h]、target 可额外使用 [x,y]，负坐标从右侧或下侧计算。字符串可引用已执行节点或 [Anchor]锚点；引用结果为空时识别或动作失败。`,
  "属性字段/Pipeline v1": `recognition: string，默认 DirectHit。action: string，默认 DoNothing。算法和动作参数与节点通用字段同级。通用字段：next、on_error、rate_limit、timeout、anchor、inverse、enabled、max_hit、pre_delay、post_delay、pre_wait_freezes、post_wait_freezes、repeat、repeat_delay、repeat_wait_freezes、focus、attach。is_sub 与 interrupt 已废弃，使用 JumpBack。`,
  "属性字段/Pipeline v2": `recognition 使用 { type, param }，action 使用 { type, param }，相关参数放入各自 param；next、on_error、等待、重复等通用字段仍位于节点根级。v1 与 v2 节点可以混用。`,
  "属性字段/流程字段": `next/on_error: string、NodeAttr 或其数组。rate_limit: uint，默认 1000ms。timeout: int，默认 20000ms，-1 表示无限等待。enabled: bool，默认 true。inverse: bool，默认 false。max_hit: uint，默认无限。anchor: string、string[] 或映射对象。`,
  "属性字段/时序字段": `pre_delay/post_delay: uint，默认 200ms。pre_wait_freezes/post_wait_freezes: uint 或等待配置对象，默认 0。repeat: uint，默认 1。repeat_delay: uint，默认 0。repeat_wait_freezes: uint 或等待配置对象，默认 0。动作顺序为 action -> [repeat_wait_freezes -> repeat_delay -> action] * (repeat-1)。`,
  "属性字段/附加字段": `focus: 节点通知配置，由上层 UI 实现。attach: 任意 JSON 对象，不影响执行逻辑；与 default_pipeline.json 中的 attach 进行字典合并。`,
  默认属性: `default_pipeline.json 位于 Bundle 根目录，与 pipeline 目录同级。优先级：节点显式参数 > 对应算法或动作默认参数 > Default 通用参数 > 框架内置默认值。多 Bundle 按加载顺序合并默认值，后加载覆盖先加载；已经加载的节点不受后续默认值影响。`,
  算法类型: `可用识别算法：DirectHit、TemplateMatch、FeatureMatch、ColorMatch、OCR、NeuralNetworkClassify、NeuralNetworkDetect、And、Or、Custom。读取对应子章节获取字段。`,
  "算法类型/DirectHit": `直接命中，不进行图像识别。字段：roi: [x,y,w,h] | string，默认全屏；roi_offset: [x,y,w,h]，默认 [0,0,0,0]。`,
  "算法类型/TemplateMatch": `模板匹配。字段：roi、roi_offset；template: string | string[]，必选，路径相对 image；threshold: number | number[]，默认 0.7；order_by: Horizontal | Vertical | Score | Random；index: int，默认 0；method: int，默认 5，也支持 3 和反转 TM_SQDIFF_NORMED 的 10001；green_mask: bool，默认 false。`,
  "算法类型/FeatureMatch": `特征匹配。字段：roi、roi_offset；template: string | string[]，必选；count: uint，默认 4；order_by: Horizontal | Vertical | Score | Area | Random；index: int；green_mask: bool；detector: SIFT | KAZE | AKAZE | BRISK | ORB，默认 SIFT；ratio: number，默认 0.6。模板建议至少 64x64 且包含足够纹理。`,
  "算法类型/ColorMatch": `颜色匹配。字段：roi、roi_offset；method: int，默认 4，常用 4/RGB、40/HSV、6/GRAY；lower/upper: number[] | number[][]，必选；count: uint，默认 1；order_by: Horizontal | Vertical | Score | Area | Random；index: int；connected: bool，默认 false。`,
  "算法类型/OCR": `文字识别。字段：roi、roi_offset；expected: string | string[]，支持正则；threshold: number，默认 0.3；replace: [string,string] | [string,string][]；order_by: Horizontal | Vertical | Area | Length | Random | Expected；index: int；only_rec: bool，默认 false；model: string，指向 model/ocr 下包含 rec.onnx、det.onnx、keys.txt 的目录；color_filter: string，引用 ColorMatch 节点。`,
  "算法类型/NeuralNetworkClassify": `固定区域分类。字段：roi、roi_offset；labels: string[]；model: string，必选，路径相对 model/classify；expected: int | int[]；order_by: Horizontal | Vertical | Score | Random | Expected；index: int。`,
  "算法类型/NeuralNetworkDetect": `目标检测。字段：roi、roi_offset；labels: string[]；model: string，必选，路径相对 model/detect；expected: int | int[]；threshold: number | number[]，默认 0.3；order_by: Horizontal | Vertical | Score | Area | Random | Expected；index: int。`,
  "算法类型/And": `逻辑与，所有子识别命中才成功。all_of: (string | object)[]，必选，字符串引用其他节点的识别配置，对象为内联 v1/v2 识别；box_index: int，默认 0；sub_name: string，可供后续子识别通过 roi 引用。`,
  "算法类型/Or": `逻辑或，按顺序执行子识别，第一个命中后停止。any_of: (string | object)[]，必选；字符串引用节点识别配置，对象为内联 v1/v2 识别。`,
  "算法类型/Custom": `自定义识别。custom_recognition: string，必选；custom_recognition_param: any，默认 null；roi；roi_offset。参数通过已注册的自定义识别回调处理。`,
  动作类型: `可用动作：DoNothing、Click、LongPress、Swipe、MultiSwipe、TouchDown、TouchMove、TouchUp、Scroll、ClickKey、LongPressKey、KeyDown、KeyUp、InputText、StartApp、StopApp、StopTask、Command、Shell、Screencap、Custom。读取对应子章节获取字段。`,
  "动作类型/DoNothing": `不执行任何操作，无额外字段。`,
  "动作类型/Click": `点击。target: true | string | [x,y] | [x,y,w,h]，默认 true；target_offset: [x,y,w,h]；contact: uint，默认 0；pressure: int，默认 1。target 为 true 时使用当前识别 box，字符串可引用节点或锚点。`,
  "动作类型/LongPress": `长按。字段：target、target_offset；duration: uint，默认 1000ms；contact: uint，默认 0；pressure: int，默认 1。`,
  "动作类型/Swipe": `单指滑动。begin/end: true | string | [x,y] | [x,y,w,h]，end 也可为路径点数组；begin_offset/end_offset；duration: uint | uint[]，默认 200ms；end_hold: uint | uint[]，默认 0；only_hover: bool；contact: uint；pressure: int。`,
  "动作类型/MultiSwipe": `多指滑动。swipes: object[]，必选。每项包含 starting、begin、begin_offset、end、end_offset、duration、end_hold、only_hover、contact、pressure；starting 控制该触点相对动作开始的时间。`,
  "动作类型/TouchDown": `按下触点。字段：contact: uint，默认 0；target: true | string | [x,y] | [x,y,w,h]；target_offset；pressure: int。`,
  "动作类型/TouchMove": `移动已按下的触点，字段与 TouchDown 相同。`,
  "动作类型/TouchUp": `抬起触点。字段：contact: uint，默认 0。`,
  "动作类型/Scroll": `滚轮滚动。target、target_offset；dx: int，正值向右；dy: int，正值向上。Win32、macOS 和实现 scroll 的自定义控制器可用，Windows 通常使用 120 的整数倍。`,
  "动作类型/ClickKey": `单击按键。key: int | int[]，必选，使用对应控制器的虚拟按键码。`,
  "动作类型/LongPressKey": `长按按键。key: int | int[]，必选；duration: uint，默认 1000ms。`,
  "动作类型/KeyDown": `按下按键但不松开。key: int，必选；与 KeyUp 配合。`,
  "动作类型/KeyUp": `松开按键。key: int，必选。`,
  "动作类型/InputText": `输入文本。input_text: string，必选；部分控制器仅支持 ASCII。`,
  "动作类型/StartApp": `启动应用。package: string，必选，可填写包名或 activity。`,
  "动作类型/StopApp": `关闭应用。package: string，必选。`,
  "动作类型/StopTask": `停止当前 post_task 启动的任务链并中断后续识别循环，无额外字段。`,
  "动作类型/Command": `执行本机命令。exec: string，必选；args: string[]；detach: bool，默认 false。args 支持 ENTRY、NODE、IMAGE、BOX、RESOURCE_DIR、LIBRARY_DIR 等运行时占位值。`,
  "动作类型/Shell": `在 ADB 设备执行 shell。cmd: string，必选；shell_timeout: int，默认 20000ms，-1 表示无限等待。`,
  "动作类型/Screencap": `保存当前截图。filename: string；format: png | jpg | jpeg，默认 png；quality: 0-100，仅 JPEG 生效。`,
  "动作类型/Custom": `自定义动作。custom_action: string，必选；custom_action_param: any，默认 null；target；target_offset。参数通过已注册的自定义动作回调处理。`,
  节点属性: `next/on_error 的 NodeAttr 可写成 { name, jump_back, anchor }，也可使用 [JumpBack]节点名或 [Anchor]锚点名。jump_back 命中后执行子链并回到父节点重新识别；错误处理路径不回跳。anchor 引用最后设置到该锚点的节点，未设置或已清除时跳过。节点自身 anchor 可为字符串、字符串数组或 { 锚点: 目标节点 }，空目标表示清除。`,
  结果排序方式: `Horizontal 按 x 后 y；Vertical 按 y 后 x；Score 按得分降序；Area 按面积降序；Length 按文本长度，仅 OCR；Random 随机；Expected 按 expected 中的声明顺序。index 支持负数索引，越界视为无结果。`,
  等待画面静止: `pre_wait_freezes、post_wait_freezes、repeat_wait_freezes 可为毫秒数或对象。对象字段：time，默认 1；target；target_offset；threshold，默认 0.95；method，默认 5；rate_limit，默认 1000；timeout，默认 20000，-1 表示无限等待。`,
  节点通知: `focus 用于让上层 UI 在节点阶段展示通知，不属于 MaaFramework 原生执行能力。消息配置可由 MPE 支持的展示协议解释，不能假设所有运行环境都支持。`,
});

const sectionNames = Object.keys(pipelineGuideSections);

export function readMfwPipelineReference(
  argumentsValue: Record<string, unknown>,
  context: ToolExecutionContext,
): ToolExecutionResult {
  const requestedSection = argumentsValue.section;
  if (typeof requestedSection !== "string") {
    return {
      ok: true,
      stateVersion: context.expectedStateVersion,
      data: { source: BUILTIN_SOURCE, sections: sectionNames },
    };
  }

  const query = normalizeSectionName(requestedSection);
  const matches = sectionNames.filter(
    (section) =>
      normalizeSectionName(section) === query ||
      normalizeSectionName(section.split("/").at(-1) ?? section) === query,
  );
  if (matches.length !== 1) {
    return {
      ok: false,
      stateVersion: context.expectedStateVersion,
      error: {
        code: "invalid_arguments",
        message:
          matches.length === 0
            ? `未找到 Pipeline 协议章节: ${requestedSection}`
            : `Pipeline 协议章节不唯一，请使用完整路径: ${matches.join("、")}`,
        retryable: false,
      },
    };
  }

  const section = matches[0];
  return {
    ok: true,
    stateVersion: context.expectedStateVersion,
    data: {
      source: BUILTIN_SOURCE,
      section,
      content: pipelineGuideSections[section],
      childSections: directChildSections(section),
    },
  };
}

export const mfwPipelineToolHandlers: Record<string, ToolHandler> = {
  [READ_MFW_PIPELINE_REFERENCE_TOOL_NAME]: readMfwPipelineReference,
};

function directChildSections(section: string): string[] {
  const prefix = `${section}/`;
  return sectionNames.filter(
    (candidate) =>
      candidate.startsWith(prefix) &&
      !candidate.slice(prefix.length).includes("/"),
  );
}

function normalizeSectionName(value: string): string {
  return value
    .replace(/[`*_]/g, "")
    .replace(/\s+/g, "")
    .toLocaleLowerCase();
}
