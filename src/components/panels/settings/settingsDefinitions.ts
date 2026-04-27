import type { ConfigCategory, ConfigState } from "../../../stores/configStore";
import { HANDLE_DIRECTION_OPTIONS } from "../../flow/nodes/constants";

/**配置项控件类型 */
export type ConfigItemType =
  | "switch"
  | "select"
  | "inputNumber"
  | "input"
  | "inputPassword"
  | "slider"
  | "button"
  | "custom";

/**配置项声明式定义 */
export interface ConfigItemDef {
  /**store 字段名（custom 类型可用虚拟 key） */
  key: keyof ConfigState["configs"] | string;
  /**所属 Tab 分区 */
  category: ConfigCategory;
  /**显示名称 */
  label: string;
  /**提示标题 */
  tipTitle: string;
  /**提示内容 */
  tipContent: string;
  /**控件类型 */
  type: ConfigItemType;
  /**select 选项 */
  options?: { value: any; label: string }[];
  /**switch 开启文本 */
  checkedChildren?: string;
  /**switch 关闭文本 */
  unCheckedChildren?: string;
  /**inputNumber/slider 最小值 */
  min?: number;
  /**inputNumber/slider 最大值 */
  max?: number;
  /**inputNumber/slider 步长 */
  step?: number;
  /**inputNumber 后缀 */
  addonAfter?: string;
  /**input/inputPassword 占位文本 */
  placeholder?: string;
  /**动态占位文本（优先级高于 placeholder，可根据其他配置项值动态变化） */
  dynamicPlaceholder?: (configs: ConfigState["configs"]) => string;
  /**动态提示内容（优先级高于 tipContent，可根据其他配置项值动态变化） */
  dynamicTipContent?: (configs: ConfigState["configs"]) => string;
  /**自定义渲染标识 */
  customRender?: string;
  /**条件显隐 */
  visible?: (configs: ConfigState["configs"]) => boolean;
  /**预配置守卫动作标识 */
  guardAction?: string;
  /**守卫引导弹窗标题 */
  guardPromptTitle?: string;
  /**守卫引导弹窗描述 */
  guardPromptDescription?: string;
  /**排序权重（越小越靠前） */
  order?: number;
  /**控件样式宽度 */
  controlWidth?: number;
}

/** 各 Provider 类型对应的范例信息 */
const AI_PROVIDER_EXAMPLES: Record<
  string,
  { url: string; key: string; models: string }
> = {
  custom: {
    url: "https://qianfan.baidubce.com/v2",
    key: "sk-xxxx",
    models: "deepseek-v4-pro / qwen3.6-plus",
  },
  openai: {
    url: "https://api.openai.com",
    key: "sk-proj-xxxx",
    models: "gpt-5.5 / gpt-4o",
  },
  anthropic: {
    url: "https://api.anthropic.com",
    key: "sk-ant-xxxx",
    models: "claude-sonnet-4-6 / claude-haiku-4-20250414",
  },
  gemini: {
    url: "https://generativelanguage.googleapis.com",
    key: "AIzaSyXXXX",
    models: "gemini-2.5-flash / gemini-2.5-pro",
  },
};

const getAIExample = (configs: ConfigState["configs"]) =>
  AI_PROVIDER_EXAMPLES[configs.aiProviderType] || AI_PROVIDER_EXAMPLES.custom;

/**所有配置项定义 */
export const settingsDefinitions: ConfigItemDef[] = [
  // ==================== 导出 (export) ====================
  {
    key: "configHandlingMode",
    category: "export",
    label: "配置保存方案",
    tipTitle: "配置保存方案",
    tipContent:
      "集成导出：配置嵌入 Pipeline 文件，适合单文件分享\n分离导出：配置存储至独立 .mpe.json 文件，便于版本管理\n不导出：不保存任何配置，导入时触发自动布局",
    type: "select",
    options: [
      { value: "integrated", label: "集成导出" },
      { value: "separated", label: "分离导出" },
      { value: "none", label: "不导出" },
    ],
    guardAction: "export",
    guardPromptTitle: "确认导出配置",
    guardPromptDescription:
      "首次导出时，请确认 Pipeline 配置的导出方式后再导出",
    order: 1,
  },
  {
    key: "pipelineProtocolVersion",
    category: "export",
    label: "Pipeline 导出版本",
    tipTitle: "Pipeline 导出版本",
    tipContent:
      "v2：使用嵌套对象结构\n{ recognition: { type: 'X', param: {...} } }\n\nv1：参数平铺在节点根对象\n{ recognition: 'X', template: '...' }",
    type: "select",
    options: [
      { value: "v2", label: "v2" },
      { value: "v1", label: "v1" },
    ],
    guardAction: "export",
    guardPromptTitle: "确认导出配置",
    guardPromptDescription: "首次导出时，请确认 Pipeline 导出版本后再导出",
    order: 2,
  },
  {
    key: "nodeAttrExportStyle",
    category: "export",
    label: "节点属性导出形式",
    tipTitle: "节点属性导出形式",
    tipContent:
      "对象形式：{ name: 'C', anchor: true, jump_back: true }\n前缀形式：'[Anchor][JumpBack]C'",
    type: "select",
    options: [
      { value: "prefix", label: "前缀形式" },
      { value: "object", label: "对象形式" },
    ],
    order: 3,
  },
  {
    key: "exportDefaultRecoAction",
    category: "export",
    label: "导出默认识别/动作",
    tipTitle: "导出默认识别/动作",
    tipContent:
      "关闭时，导出时若节点的识别类型为 DirectHit 且无参数，则不导出 recognition 字段；\n若动作类型为 DoNothing 且无参数，则不导出 action 字段。\n两者独立检测。",
    type: "switch",
    checkedChildren: "导出",
    unCheckedChildren: "省略",
    order: 4,
  },
  {
    key: "exportEmptyParam",
    category: "export",
    label: "子字段为空时占位",
    tipTitle: "子字段为空时占位",
    tipContent:
      "关闭时，若识别/动作的 param 为空对象，则不导出 param 键，仅保留 type。\n开启时，即使 param 为空也保留占位导出。（仅 v2 版本需要考虑）",
    type: "switch",
    checkedChildren: "占位",
    unCheckedChildren: "省略",
    order: 5,
  },
  {
    key: "jsonIndent",
    category: "export",
    label: "JSON 行缩进",
    tipTitle: "JSON 行缩进",
    tipContent:
      "导出 JSON 文件时每层缩进的空格数。\n默认为 4 空格，可设置为 2 或其他值。",
    type: "inputNumber",
    min: 0,
    max: 16,
    addonAfter: "空格",
    order: 6,
  },
  {
    key: "skipFieldValidation",
    category: "export",
    label: "忽略字段校验",
    tipTitle: "忽略字段校验",
    tipContent:
      "开启后，导出时将跳过字段格式校验，即使节点内容不符合规范也会强制导出。\n适用于快速导出或调试场景。",
    type: "switch",
    checkedChildren: "忽略",
    unCheckedChildren: "校验",
    order: 7,
  },
  {
    key: "__fieldSort",
    category: "export",
    label: "字段排序配置",
    tipTitle: "字段排序配置",
    tipContent: "自定义导出时的字段排序顺序",
    type: "custom",
    customRender: "fieldSort",
    order: 8,
  },

  // ==================== 节点 (node) ====================
  {
    key: "nodeStyle",
    category: "node",
    label: "节点风格",
    tipTitle: "节点风格",
    tipContent:
      "切换节点的显示风格：现代风格具有分组标题和图标，经典风格为原始平铺展示，极简风格仅显示图标和名称",
    type: "select",
    options: [
      { value: "modern", label: "现代风格" },
      { value: "classic", label: "经典风格" },
      { value: "minimal", label: "极简风格" },
    ],
    order: 1,
  },
  {
    key: "showNodeDetailFields",
    category: "node",
    label: "节点显示二级字段",
    tipTitle: "节点显示二级字段",
    tipContent:
      "关闭时节点仅显示识别类型和动作类型，隐藏所有参数细节。适合在节点数量较多时减少视觉干扰。",
    type: "switch",
    checkedChildren: "详细",
    unCheckedChildren: "精简",
    order: 2,
  },
  {
    key: "showNodeTemplateImages",
    category: "node",
    label: "节点显示模板图片",
    tipTitle: "节点显示模板图片",
    tipContent:
      "开启时，现代风格节点底部会显示 template 字段的图片缩略图。需要连接本地服务后生效。",
    type: "switch",
    checkedChildren: "显示",
    unCheckedChildren: "隐藏",
    order: 3,
  },
  {
    key: "defaultHandleDirection",
    category: "node",
    label: "默认端点位置",
    tipTitle: "默认端点位置",
    tipContent:
      "新创建节点的默认端点位置\n左右：左侧输入，右侧输出（默认）\n右左：右侧输入，左侧输出\n上下：上方输入，下方输出\n下上：下方输入，上方输出",
    type: "select",
    options: HANDLE_DIRECTION_OPTIONS,
    order: 4,
  },
  {
    key: "__applyToAll",
    category: "node",
    label: "一键更改端点位置",
    tipTitle: "一键更改",
    tipContent: "将所有节点的端点位置更改为当前选中的默认位置",
    type: "custom",
    customRender: "applyToAll",
    order: 5,
  },
  {
    key: "enableNodeSnap",
    category: "node",
    label: "节点磁吸对齐",
    tipTitle: "节点磁吸对齐",
    tipContent:
      "开启后拖拽节点时会自动对齐到其他节点的边缘和中心线，并显示对齐参考线",
    type: "switch",
    checkedChildren: "启用",
    unCheckedChildren: "关闭",
    order: 6,
  },
  {
    key: "snapOnlyInViewport",
    category: "node",
    label: "仅磁吸可视节点",
    tipTitle: "仅磁吸可视节点",
    tipContent: "开启时仅与可视范围内的节点进行磁吸对齐",
    type: "switch",
    checkedChildren: "启用",
    unCheckedChildren: "关闭",
    visible: (configs) => configs.enableNodeSnap,
    order: 7,
  },

  // ==================== 连接 (connection) ====================
  {
    key: "edgePathMode",
    category: "connection",
    label: "边走线模式",
    tipTitle: "边走线模式",
    tipContent:
      "曲线：使用贝塞尔曲线连接节点，线条平滑流畅\n直角：使用阶梯状折线连接节点，路径规整清晰\n避让：自动绕过路径上的节点，智能规划路线",
    type: "select",
    options: [
      { value: "bezier", label: "曲线" },
      { value: "smoothstep", label: "直角" },
      { value: "avoid", label: "避让" },
    ],
    order: 1,
  },
  {
    key: "showEdgeLabel",
    category: "connection",
    label: "显示边标签",
    tipTitle: "显示边标签",
    tipContent:
      "开启时边中心会显示连接次序，若影响观察可关闭此选项；显示时会稍微增加拖拽节点时性能损耗，若造成明显卡顿请关闭此选项。",
    type: "switch",
    checkedChildren: "显示",
    unCheckedChildren: "隐藏",
    order: 2,
  },
  {
    key: "showEdgeControlPoint",
    category: "connection",
    label: "边拖拽手柄",
    tipTitle: "边拖拽手柄",
    tipContent:
      "开启时可以拖拽连接线中间的手柄来调整路径形状，该效果不会保存。双击手柄可重置单条连接线，排版工具中可一键重置所有连接线。",
    type: "switch",
    checkedChildren: "显示",
    unCheckedChildren: "隐藏",
    order: 3,
  },
  {
    key: "fieldPanelMode",
    category: "component",
    label: "字段/连接面板模式",
    tipTitle: "字段/连接面板模式",
    tipContent:
      "固定模式：面板固定在右上角\n拖动模式：面板可拖动，切换选中时保持位置\n内嵌模式：字段面板嵌入在节点旁边，直接在画布中编辑",
    type: "select",
    options: [
      { value: "fixed", label: "固定" },
      { value: "draggable", label: "拖动" },
      { value: "inline", label: "内嵌" },
    ],
    order: 4,
  },
  {
    key: "inlinePanelScale",
    category: "component",
    label: "内嵌面板缩放比例",
    tipTitle: "内嵌面板缩放比例",
    tipContent:
      "设置内嵌模式下字段面板的整体缩放大小，范围 0.5-1.0。可根据个人视图查阅缩放比例偏好调试，其他模式不起作用。",
    type: "inputNumber",
    min: 0.5,
    max: 1.0,
    step: 0.05,
    visible: (configs) => configs.fieldPanelMode === "inline",
    order: 5,
  },
  {
    key: "quickCreateNodeOnConnectBlank",
    category: "connection",
    label: "连接空白处时创建",
    tipTitle: "连接空白处时创建",
    tipContent:
      "从节点拖出连接线，如果终点落在画布空白处，则在落点直接弹出节点添加面板，方便继续选择要创建的节点类型。关闭后将保持原有行为。",
    type: "switch",
    checkedChildren: "开启",
    unCheckedChildren: "关闭",
    order: 6,
  },

  // ==================== 画布 (canvas) ====================
  {
    key: "canvasBackgroundMode",
    category: "canvas",
    label: "画布背景",
    tipTitle: "画布背景",
    tipContent:
      "纯白：纯白色背景，适合喜欢明亮界面的用户\n护眼：淡蓝灰色背景(#f9fafd)，柔和不刺眼",
    type: "select",
    options: [
      { value: "eyecare", label: "护眼" },
      { value: "pure", label: "纯白" },
    ],
    order: 1,
  },
  {
    key: "isAutoFocus",
    category: "canvas",
    label: "自动聚焦",
    tipTitle: "自动聚焦",
    tipContent: "开启时若出现新节点则自动移动视口以聚焦",
    type: "switch",
    checkedChildren: "启用",
    unCheckedChildren: "关闭",
    order: 2,
  },
  {
    key: "focusOpacity",
    category: "canvas",
    label: "非聚焦节点不透明度",
    tipTitle: "非聚焦节点不透明度",
    tipContent:
      "选中节点或边时，非相关元素的透明度。设置为1时关闭此功能，小于1时只完全显示与选中元素直接关联的节点和边",
    type: "inputNumber",
    min: 0,
    max: 1,
    step: 0.1,
    order: 3,
  },
  {
    key: "enableLiveScreen",
    category: "component",
    label: "实时画面预览",
    tipTitle: "实时画面预览",
    tipContent:
      "连接设备后，在右上角自动显示实时设备屏幕。当字段/连接/JSON面板打开时自动隐藏。",
    type: "switch",
    checkedChildren: "启用",
    unCheckedChildren: "关闭",
    order: 4,
  },
  {
    key: "liveScreenRefreshRate",
    category: "component",
    label: "画面刷新间隔(ms)",
    tipTitle: "画面刷新间隔(ms)",
    tipContent:
      "设置设备屏幕更新间隔（毫秒）。值越小越流畅但性能消耗越高。推荐 500-2000ms。",
    type: "inputNumber",
    min: 200,
    max: 5000,
    step: 100,
    visible: (configs) => configs.enableLiveScreen,
    order: 5,
  },
  {
    key: "historyLimit",
    category: "component",
    label: "历史记录上限",
    tipTitle: "历史记录上限",
    tipContent:
      "设置撤销/重做功能的最大历史记录数量，设置过大可能占用较多内存并产生卡顿",
    type: "inputNumber",
    min: 10,
    max: 10000,
    order: 6,
  },

  // ==================== 组件 (component) ====================
  {
    key: "saveFilesBeforeDebug",
    category: "component",
    label: "调试前保存文件",
    tipTitle: "调试前保存文件",
    tipContent: "开启后，在调试前会自动保存当前文件",
    type: "switch",
    checkedChildren: "启用",
    unCheckedChildren: "关闭",
    order: 1,
  },
  {
    key: "useDarkMode",
    category: "canvas",
    label: "深色模式",
    tipTitle: "深色模式",
    tipContent: "切换编辑器的深色/浅色主题",
    type: "switch",
    checkedChildren: "深色",
    unCheckedChildren: "浅色",
    order: 3,
  },

  // ==================== 本地服务 (local-service) ====================
  {
    key: "__backendConfig",
    category: "local-service",
    label: "本地服务配置",
    tipTitle: "本地服务配置",
    tipContent:
      "查看和修改后端服务的配置，包括服务器、文件、日志、MaaFramework 等设置",
    type: "custom",
    customRender: "backendConfig",
    order: 1,
  },
  {
    key: "wsPort",
    category: "local-service",
    label: "连接端口",
    tipTitle: "WebSocket 端口",
    tipContent: "本地服务端口，修改端口后需要重新连接",
    type: "inputNumber",
    min: 1024,
    max: 65535,
    order: 2,
  },
  {
    key: "wsAutoConnect",
    category: "local-service",
    label: "自动连接",
    tipTitle: "自动连接",
    tipContent: "开启后，进入页面时会自动尝试连接本地通信服务",
    type: "switch",
    checkedChildren: "开启",
    unCheckedChildren: "关闭",
    order: 3,
  },
  {
    key: "fileAutoReload",
    category: "local-service",
    label: "自动重载变更文件",
    tipTitle: "自动重载变更文件",
    tipContent:
      "开启后，当文件被外部修改时会自动重新加载文件内容，无需手动确认",
    type: "switch",
    checkedChildren: "开启",
    unCheckedChildren: "关闭",
    order: 4,
  },
  {
    key: "enableCrossFileSearch",
    category: "local-service",
    label: "启用跨文件搜索",
    tipTitle: "启用跨文件搜索",
    tipContent: "开启后，搜索时将在所有已打开的文件中搜索匹配项",
    type: "switch",
    checkedChildren: "开启",
    unCheckedChildren: "关闭",
    order: 5,
  },

  // ==================== AI (ai) ====================
  {
    key: "__aiWarning",
    category: "ai",
    label: "AI 配置须知",
    tipTitle: "AI 配置须知",
    tipContent: "",
    type: "custom",
    customRender: "aiWarning",
    order: 0,
  },
  {
    key: "aiProviderType",
    category: "ai",
    label: "API 类型",
    tipTitle: "API 服务类型",
    tipContent:
      "选择 AI 服务提供商类型。不同类型使用不同的协议和端点格式。如果你使用的是 OpenAI 兼容的第三方服务（如 DeepSeek、通义千问等），请选择'自定义'",
    type: "select",
    options: [
      { value: "custom", label: "自定义 (OpenAI 兼容)" },
      { value: "openai", label: "OpenAI" },
      { value: "anthropic", label: "Claude (Anthropic)" },
      { value: "gemini", label: "Gemini (Google)" },
    ],
    controlWidth: 200,
    order: 1,
  },
  {
    key: "aiApiUrl",
    category: "ai",
    label: "API URL",
    tipTitle: "API URL",
    tipContent:
      "API 基础地址或完整端点。OpenAI: https://api.openai.com，Anthropic: https://api.anthropic.com，Gemini: https://generativelanguage.googleapis.com。自定义 OpenAI 兼容服务可填写基础地址（如 https://open.bigmodel.cn/api/paas/v4）或完整 /chat/completions 地址",
    type: "input",
    placeholder: "例如: https://api.openai.com",
    dynamicPlaceholder: (configs) => `例如: ${getAIExample(configs).url}`,
    order: 2,
  },
  {
    key: "aiApiKey",
    category: "ai",
    label: "API Key",
    tipTitle: "API Key",
    tipContent: "你的 API 密钥，将加密存储在浏览器本地（AES-GCM）",
    type: "inputPassword",
    placeholder: "例如: sk-xxxx",
    dynamicPlaceholder: (configs) => `例如: ${getAIExample(configs).key}`,
    order: 3,
  },
  {
    key: "aiModel",
    category: "ai",
    label: "模型",
    tipTitle: "模型名称",
    tipContent:
      "使用的模型名称。例如: gpt-4o, gpt-4o-mini, claude-sonnet-4-20250514, gemini-2.5-flash 等",
    type: "input",
    placeholder: "例如: gpt-4o / claude-sonnet-4-20250514 / gemini-2.5-flash",
    dynamicPlaceholder: (configs) => `例如: ${getAIExample(configs).models}`,
    order: 4,
  },
  {
    key: "aiTemperature",
    category: "ai",
    label: "温度",
    tipTitle: "温度参数",
    tipContent:
      "控制 AI 输出的随机性。较低的值（0.3）更稳定保守，较高的值（0.8）更有创造性。节点预测建议 0.5-0.7",
    type: "slider",
    min: 0,
    max: 1,
    step: 0.1,
    order: 5,
  },
  {
    key: "aiUseProxy",
    category: "ai",
    label: "LocalBridge 代理",
    tipTitle: "LocalBridge 代理",
    tipContent:
      "开启后通过 LocalBridge 本地服务代理 AI 请求，可解决浏览器 CORS 跨域限制。关闭则直接从浏览器调用 API（需要 API 服务支持 CORS）",
    type: "switch",
    checkedChildren: "开启",
    unCheckedChildren: "关闭",
    order: 6,
  },
  {
    key: "__testConnection",
    category: "ai",
    label: "测试",
    tipTitle: "测试连接",
    tipContent: "测试当前 AI 配置是否可用",
    type: "custom",
    customRender: "testConnection",
    order: 7,
  },

  // ==================== 管理 (management) ====================
  {
    key: "__exportConfig",
    category: "management",
    label: "导出配置",
    tipTitle: "导出/导入配置",
    tipContent:
      "导出当前设置为 JSON 文件，或从 JSON 文件导入设置。包括：编辑器配置、自定义节点模板。",
    type: "custom",
    customRender: "exportConfig",
    order: 1,
  },
  {
    key: "__importConfig",
    category: "management",
    label: "导入配置",
    tipTitle: "导出/导入配置",
    tipContent:
      "导出当前设置为 JSON 文件，或从 JSON 文件导入设置。包括：编辑器配置、自定义节点模板。",
    type: "custom",
    customRender: "importConfig",
    order: 2,
  },
  {
    key: "__resetDefaults",
    category: "management",
    label: "重置默认值",
    tipTitle: "重置默认值",
    tipContent: "将所有配置项恢复为默认值",
    type: "custom",
    customRender: "resetDefaults",
    order: 3,
  },
];

/**Tab 分区定义 */
export const settingsTabs: {
  key: ConfigCategory;
  label: string;
  icon: string;
}[] = [
  { key: "export", label: "导出", icon: "ExportOutlined" },
  { key: "node", label: "节点", icon: "AppstoreOutlined" },
  { key: "connection", label: "连接", icon: "ShareAltOutlined" },
  { key: "canvas", label: "画布", icon: "LayoutOutlined" },
  { key: "component", label: "组件", icon: "CodeOutlined" },
  { key: "local-service", label: "本地服务", icon: "GlobalOutlined" },
  { key: "ai", label: "AI", icon: "RobotOutlined" },
  { key: "management", label: "管理", icon: "SettingOutlined" },
];
