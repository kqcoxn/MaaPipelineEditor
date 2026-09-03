import { create } from "zustand";
import type { HandleDirection } from "@/components/flow/nodes/constants";
import type { FieldSortConfig } from "@/core/sorting/types";
import { encryptApiKey, isEncryptedKey } from "@/utils/ai/crypto";

let apiKeyWriteVersion = 0;

export const DEFAULT_AI_CONTEXT_COMPACTION_THRESHOLD = 200_000;
export const MIN_AI_CONTEXT_COMPACTION_THRESHOLD = 1_000;
export const MAX_AI_CONTEXT_COMPACTION_THRESHOLD = 2_000_000;
export const DEFAULT_AI_TOOL_CALL_BUDGET = 50;
export const MIN_AI_TOOL_CALL_BUDGET = 1;
export const MAX_AI_TOOL_CALL_BUDGET = 200;
export const DEFAULT_AI_REQUEST_TIMEOUT_MINUTES = 10;
export const MIN_AI_REQUEST_TIMEOUT_MINUTES = 1;
export const MAX_AI_REQUEST_TIMEOUT_MINUTES = 120;
export const DEFAULT_LIVE_SCREEN_FRAME_RATE = 15;
export const MIN_LIVE_SCREEN_FRAME_RATE = 1;
export const MAX_LIVE_SCREEN_FRAME_RATE = 60;

export function normalizeLiveScreenFrameRate(frameRate: number): number {
  if (
    !Number.isFinite(frameRate) ||
    frameRate < MIN_LIVE_SCREEN_FRAME_RATE ||
    frameRate > MAX_LIVE_SCREEN_FRAME_RATE
  ) {
    return DEFAULT_LIVE_SCREEN_FRAME_RATE;
  }
  return Math.trunc(frameRate);
}

export function getLiveScreenFrameInterval(frameRate: number): number {
  return 1000 / normalizeLiveScreenFrameRate(frameRate);
}

export function normalizeAIRequestTimeoutMs(value: number): number {
  const minutes = Number.isFinite(value)
    ? Math.min(
        MAX_AI_REQUEST_TIMEOUT_MINUTES,
        Math.max(MIN_AI_REQUEST_TIMEOUT_MINUTES, Math.trunc(value)),
      )
    : DEFAULT_AI_REQUEST_TIMEOUT_MINUTES;
  return minutes * 60_000;
}

export function normalizeAIToolCallBudget(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_AI_TOOL_CALL_BUDGET;
  return Math.min(
    MAX_AI_TOOL_CALL_BUDGET,
    Math.max(MIN_AI_TOOL_CALL_BUDGET, Math.trunc(value)),
  );
}

export function normalizeAIContextCompactionThreshold(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_AI_CONTEXT_COMPACTION_THRESHOLD;
  return Math.min(
    MAX_AI_CONTEXT_COMPACTION_THRESHOLD,
    Math.max(MIN_AI_CONTEXT_COMPACTION_THRESHOLD, Math.trunc(value)),
  );
}

/**固有配置 */
export const globalConfig = {
  dev: true,
  version: `1.9.3`,
  betaIteration: 2,
  mfwVersion: "5.12.3",
  protocolVersion: "1.4.6",
};

if (globalConfig.dev) {
  globalConfig.version = `${globalConfig.version}_beta_${globalConfig.betaIteration}`;
}

/**配置分类 */
export type ConfigCategory =
  | "export"
  | "node"
  | "connection"
  | "canvas"
  | "component"
  | "local-service"
  | "ai"
  | "management";

/**字段面板模式 */
export type FieldPanelMode = "fixed" | "draggable" | "inline";

/**配置分类映射 - 用于确定哪些配置属于哪个类别 */
export const configCategoryMap: Record<string, ConfigCategory> = {
  // 导出配置
  nodeAttrExportStyle: "export",
  exportDefaultRecoAction: "export",
  exportEmptyParam: "export",
  pipelineProtocolVersion: "export",
  skipFieldValidation: "export",
  jsonIndent: "export",
  configHandlingMode: "export",
  // 节点配置
  nodeStyle: "node",
  showNodeShadows: "node",
  showNodeDetailFields: "node",
  showNodeTemplateImages: "node",
  showNodeFlowSection: "node",
  enableNodeSnap: "node",
  snapOnlyInViewport: "node",
  defaultHandleDirection: "node",
  // 连接配置
  edgePathMode: "connection",
  showEdgeLabel: "connection",
  showEdgeControlPoint: "connection",
  enableEdgeAnimation: "connection",
  quickCreateNodeOnConnectBlank: "connection",
  // 画布配置
  canvasBackgroundMode: "canvas",
  isAutoFocus: "canvas",
  focusOpacity: "canvas",
  useDarkMode: "canvas",
  enableCanvasMotionPause: "canvas",
  // 组件配置
  saveFilesBeforeDebug: "component",
  fieldPanelMode: "component",
  inlinePanelScale: "component",
  enableLiveScreen: "component",
  liveScreenRefreshRate: "component",
  historyLimit: "component",
  showJsonPreviewButton: "component",
  showOpenLocalButton: "component",
  screenshotResolutionMode: "local-service",
  screenshotResolutionValue: "local-service",
  // 本地服务配置
  wsPort: "local-service",
  wsAutoConnect: "local-service",
  fileAutoReload: "local-service",
  enableCrossFileSearch: "local-service",
  crossFileSearchFolderFilter: "local-service",
  // AI 配置
  aiApiUrl: "ai",
  aiApiKey: "ai",
  aiModel: "ai",
  aiTemperature: "ai",
  aiContextCompactionThreshold: "ai",
  aiToolCallBudget: "ai",
  aiRequestTimeoutMinutes: "ai",
  aiProviderType: "ai",
  aiUseProxy: "ai",
};

/**获取可导出的配置 */
export const getExportableConfigs = (
  configs: ConfigState["configs"],
  excludeCategories: ConfigCategory[] = [],
): Partial<ConfigState["configs"]> => {
  const result: Partial<ConfigState["configs"]> = {};
  Object.entries(configs).forEach(([key, value]) => {
    // API Key 只允许留在本地缓存，不随配置文件导出。
    if (key === "aiApiKey") return;
    const category = configCategoryMap[key];
    if (category && !excludeCategories.includes(category)) {
      (result as Record<string, unknown>)[key] = value;
    }
  });
  return result;
};

// 节点风格类型
export type NodeStyleType = "modern" | "classic" | "minimal";

// 节点属性导出形式
export type NodeAttrExportStyle = "object" | "prefix";

// 配置处理方案类型
export type ConfigHandlingMode = "integrated" | "separated" | "none";

// Pipeline 导出版本
export type PipelineProtocolVersion = "v1" | "v2";

// 画布背景模式
export type CanvasBackgroundMode = "pure" | "eyecare";

// 边走线模式
export type EdgePathMode = "bezier" | "smoothstep" | "avoid";

// 截图分辨率模式
export type ScreenshotResolutionMode =
  | "default"
  | "shortSide"
  | "longSide"
  | "raw";

/**截图请求分辨率参数 */
export interface ScreenshotResolutionParams {
  target_short_side?: number;
  target_long_side?: number;
  use_raw_size?: boolean;
}

type ScreenshotResolutionConfig = Pick<
  ConfigState["configs"],
  "screenshotResolutionMode" | "screenshotResolutionValue"
>;

/**
 * 根据配置生成截图请求的分辨率参数。
 * maafw 三种模式互斥，每次请求只发送一种；后端负责清理其他模式的残留状态。
 * default 模式显式回落到短边 720（maafw 默认）。
 */
export const getScreenshotResolutionParams = (
  configs: ScreenshotResolutionConfig,
): ScreenshotResolutionParams => {
  const value = configs.screenshotResolutionValue;
  switch (configs.screenshotResolutionMode) {
    case "shortSide":
      return { target_short_side: value };
    case "longSide":
      return { target_long_side: value };
    case "raw":
      return { use_raw_size: true };
    case "default":
    default:
      return { target_short_side: 720 };
  }
};

/**配置默认值 */
const defaultConfigs = {
  configHandlingMode: "integrated" as ConfigHandlingMode,
  showEdgeLabel: true,
  isAutoFocus: true,
  useDarkMode: false,
  historyLimit: 100,
  nodeStyle: "modern" as NodeStyleType,
  showNodeShadows: true,
  nodeAttrExportStyle: "prefix" as NodeAttrExportStyle,
  defaultHandleDirection: "left-right" as HandleDirection,
  quickCreateNodeOnConnectBlank: true,
  exportDefaultRecoAction: false,
  exportEmptyParam: false,
  pipelineProtocolVersion: "v2" as PipelineProtocolVersion,
  skipFieldValidation: false,
  jsonIndent: 4,
  wsPort: 9066,
  wsAutoConnect: false,
  autoConnectLastController: true,
  fileAutoReload: false,
  saveFilesBeforeDebug: true,
  enableCrossFileSearch: true,
  crossFileSearchFolderFilter: "",
  // AI 配置
  aiApiUrl: "",
  aiApiKey: "",
  aiModel: "",
  aiTemperature: 0.7,
  aiContextCompactionThreshold: DEFAULT_AI_CONTEXT_COMPACTION_THRESHOLD,
  aiToolCallBudget: DEFAULT_AI_TOOL_CALL_BUDGET,
  aiRequestTimeoutMinutes: DEFAULT_AI_REQUEST_TIMEOUT_MINUTES,
  aiProviderType: "custom" as const,
  aiUseProxy: true,
  // 聚焦透明度
  focusOpacity: 0.3,
  // 边控制点
  showEdgeControlPoint: true,
  // 连线流动动画
  enableEdgeAnimation: true,
  // 边走线模式
  edgePathMode: "bezier" as EdgePathMode,
  // 画布背景模式
  canvasBackgroundMode: "eyecare" as CanvasBackgroundMode,
  // 交互期间暂停装饰动画
  enableCanvasMotionPause: true,
  // 字段面板模式
  fieldPanelMode: "fixed" as FieldPanelMode,
  // 内嵌面板缩放比例
  inlinePanelScale: 0.8,
  // 节点显示 template 图片
  showNodeTemplateImages: true,
  // 显示流程连接区域（next/on_error）
  showNodeFlowSection: true,
  // 渲染节点详细字段
  showNodeDetailFields: true,
  // 节点磁吸对齐
  enableNodeSnap: false,
  // 磁吸对齐仅限可视范围
  snapOnlyInViewport: true,
  // 实时画面预览
  enableLiveScreen: true,
  // 实时画面刷新率（帧/秒）
  liveScreenRefreshRate: DEFAULT_LIVE_SCREEN_FRAME_RATE,
  // 右上角工具栏按钮
  showJsonPreviewButton: false,
  showOpenLocalButton: true,
  // 截图分辨率模式
  screenshotResolutionMode: "default" as ScreenshotResolutionMode,
  // 截图分辨率值（短边/长边长度）
  screenshotResolutionValue: 720,
};

/**配置默认值（只读），用于重置和对比 */
export const configDefaults: Readonly<ConfigState["configs"]> = defaultConfigs;

/**配置 */
export type ConfigState = {
  // 设置
  configs: {
    configHandlingMode: ConfigHandlingMode;
    showEdgeLabel: boolean;
    isAutoFocus: boolean;
    useDarkMode: boolean;
    historyLimit: number;
    nodeStyle: NodeStyleType;
    showNodeShadows: boolean;
    nodeAttrExportStyle: NodeAttrExportStyle;
    defaultHandleDirection: HandleDirection;
    quickCreateNodeOnConnectBlank: boolean;
    exportDefaultRecoAction: boolean;
    exportEmptyParam: boolean;
    pipelineProtocolVersion: PipelineProtocolVersion;
    skipFieldValidation: boolean;
    jsonIndent: number;
    wsPort: number;
    wsAutoConnect: boolean;
    autoConnectLastController: boolean;
    fileAutoReload: boolean;
    saveFilesBeforeDebug: boolean;
    crossFileSearchFolderFilter: string;
    // AI 配置
    aiApiUrl: string;
    aiApiKey: string;
    aiModel: string;
    aiTemperature: number;
    aiContextCompactionThreshold: number;
    aiToolCallBudget: number;
    aiRequestTimeoutMinutes: number;
    aiProviderType: string;
    aiUseProxy: boolean;
    // 聚焦透明度
    focusOpacity: number;
    // 边控制点
    showEdgeControlPoint: boolean;
    // 连线流动动画
    enableEdgeAnimation: boolean;
    // 边走线模式
    edgePathMode: EdgePathMode;
    // 启用跨文件搜索
    enableCrossFileSearch: boolean;
    // 画布背景模式
    canvasBackgroundMode: CanvasBackgroundMode;
    // 交互期间暂停装饰动画
    enableCanvasMotionPause: boolean;
    // 字段面板模式
    fieldPanelMode: FieldPanelMode;
    // 内嵌面板缩放比例
    inlinePanelScale: number;
    // 节点显示 template 图片
    showNodeTemplateImages: boolean;
    // 显示流程连接区域（next/on_error）
    showNodeFlowSection: boolean;
    // 渲染节点详细字段
    showNodeDetailFields: boolean;
    // 节点磁吸对齐
    enableNodeSnap: boolean;
    // 磁吸对齐仅限可视范围
    snapOnlyInViewport: boolean;
    // 实时画面预览
    enableLiveScreen: boolean;
    // 实时画面刷新率（帧/秒）
    liveScreenRefreshRate: number;
    // 右上角工具栏按钮
    showJsonPreviewButton: boolean;
    showOpenLocalButton: boolean;
    // 截图分辨率模式
    screenshotResolutionMode: ScreenshotResolutionMode;
    // 截图分辨率值（短边/长边长度）
    screenshotResolutionValue: number;
    // 字段排序配置
    fieldSortConfig?: FieldSortConfig;
  };
  setConfig: <K extends keyof ConfigState["configs"]>(
    key: K,
    value: ConfigState["configs"][K],
  ) => void;
  replaceConfig: (
    configs: Partial<ConfigState["configs"]>,
    configuredKeys?: Iterable<string>,
  ) => void;
  // 已配置追踪
  configuredKeys: Set<string>;
  markAsConfigured: (key: string) => void;
  isConfigured: (key: string) => boolean;
  // 恢复默认
  resetConfig: <K extends keyof ConfigState["configs"]>(key: K) => void;
  resetAllConfigs: () => void;
  // 状态
  status: {
    showConfigPanel: boolean;
    showAIHistoryPanel: boolean;
    showFileConfigPanel: boolean;
    showLocalFilePanel: boolean;
    showFieldSortModal: boolean;
    rightPanelWidth: number;
  };
  setStatus: <K extends keyof ConfigState["status"]>(
    key: K,
    value: ConfigState["status"][K],
  ) => void;
};

export const useConfigStore = create<ConfigState>()((set, get) => ({
  // 设置
  configs: { ...defaultConfigs },
  setConfig(key, value) {
    if (key === "aiApiKey") apiKeyWriteVersion++;

    // 加密 API Key
    if (
      key === "aiApiKey" &&
      typeof value === "string" &&
      value &&
      !value.startsWith("ENC:")
    ) {
      const writeVersion = apiKeyWriteVersion;
      encryptApiKey(value)
        .then((encrypted) => {
          if (writeVersion !== apiKeyWriteVersion) return;
          set((state) => {
            const configuredKeys = new Set(state.configuredKeys);
            configuredKeys.add(key as string);
            return {
              configs: { ...state.configs, [key]: encrypted },
              configuredKeys,
            };
          });
        })
        .catch((error: unknown) => {
          console.error("[Config] API Key 加密失败，未更新配置:", error);
        });
      return;
    }

    set((state) => {
      const newConfigs = { ...state.configs, [key]: value };

      // 标记为已配置
      const configuredKeys = new Set(state.configuredKeys);
      configuredKeys.add(key as string);

      return {
        configs: newConfigs,
        configuredKeys,
      };
    });
  },
  replaceConfig(configs, configuredKeys) {
    apiKeyWriteVersion++;

    set((state) => {
      const keys = Object.keys(state.configs);
      const newConfigs: Partial<ConfigState["configs"]> = {};
      Object.keys(configs).forEach((key) => {
        if (keys.includes(key)) {
          const configKey = key as keyof ConfigState["configs"];
          const value = configs[configKey];
          if (
            configKey === "aiApiKey" &&
            (typeof value !== "string" ||
              (value !== "" && !isEncryptedKey(value)))
          ) {
            return;
          }
          (newConfigs as Record<string, unknown>)[configKey] =
            configKey === "liveScreenRefreshRate"
              ? normalizeLiveScreenFrameRate(
                  typeof value === "number" ? value : Number.NaN,
                )
              : value;
        }
      });

      const mergedConfigs = { ...state.configs, ...newConfigs };

      // 批量标记导入的 key 为已配置
      const newConfiguredKeys = new Set(state.configuredKeys);
      if (configuredKeys) {
        for (const key of configuredKeys) {
          newConfiguredKeys.add(key);
        }
      }
      Object.keys(newConfigs).forEach((key) => newConfiguredKeys.add(key));

      return { configs: mergedConfigs, configuredKeys: newConfiguredKeys };
    });
  },
  // 已配置追踪
  configuredKeys: new Set<string>(),
  markAsConfigured(key) {
    set((state) => {
      if (state.configuredKeys.has(key)) return state;
      const newKeys = new Set(state.configuredKeys);
      newKeys.add(key);
      return { configuredKeys: newKeys };
    });
  },
  isConfigured(key) {
    return get().configuredKeys.has(key);
  },
  // 恢复默认
  resetConfig(key) {
    if (key === "aiApiKey") apiKeyWriteVersion++;
    const defaultValue = configDefaults[key];
    set((state) => {
      const newConfigs = { ...state.configs, [key]: defaultValue };

      return { configs: newConfigs };
    });
  },
  resetAllConfigs() {
    apiKeyWriteVersion++;
    set({ configs: { ...defaultConfigs }, configuredKeys: new Set() });
  },
  // 状态
  status: {
    showConfigPanel: false,
    showAIHistoryPanel: false,
    showFileConfigPanel: false,
    showLocalFilePanel: false,
    showFieldSortModal: false,
    rightPanelWidth: 350,
  },
  setStatus(key, value) {
    set((state) => ({
      status: { ...state.status, [key]: value },
    }));
  },
}));

const CONFIG_STORAGE_KEY = "_mpe_config";

export function saveConfigCache(): void {
  const configState = useConfigStore.getState();
  const aiApiKey = isEncryptedKey(configState.configs.aiApiKey)
    ? configState.configs.aiApiKey
    : "";
  localStorage.setItem(
    CONFIG_STORAGE_KEY,
    JSON.stringify({
      ...configState.configs,
      aiApiKey,
      __configuredKeys: [...configState.configuredKeys],
    }),
  );
}

export function restoreConfigCache(): void {
  const config = localStorage.getItem(CONFIG_STORAGE_KEY);
  if (!config) return;

  const parsed = JSON.parse(config);
  const configuredKeys = Array.isArray(parsed.__configuredKeys)
    ? parsed.__configuredKeys.filter((key: unknown) => typeof key === "string")
    : undefined;

  delete parsed.__configuredKeys;
  useConfigStore.getState().replaceConfig(parsed, configuredKeys);
}

export function initializeConfigCache(): () => void {
  try {
    restoreConfigCache();
  } catch (error) {
    console.error("[Config] 恢复配置缓存失败:", error);
  }

  return useConfigStore.subscribe((state, prevState) => {
    if (
      state.configs !== prevState.configs ||
      state.configuredKeys !== prevState.configuredKeys
    ) {
      try {
        saveConfigCache();
      } catch (error) {
        console.error("[Config] 保存配置缓存失败:", error);
      }
    }
  });
}
