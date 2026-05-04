import { create } from "zustand";
import type { HandleDirection } from "../components/flow/nodes/constants";
import type { FieldSortConfig } from "../core/sorting/types";
import { encryptApiKey } from "../utils/ai/crypto";

/**固有配置 */
export const globalConfig = {
  dev: true,
  version: `1.5.2`,
  betaIteration: 2,
  mfwVersion: "5.10.4",
  protocolVersion: "1.0.2",
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
  showNodeDetailFields: "node",
  showNodeTemplateImages: "node",
  enableNodeSnap: "node",
  snapOnlyInViewport: "node",
  defaultHandleDirection: "node",
  // 连接配置
  edgePathMode: "connection",
  showEdgeLabel: "connection",
  showEdgeControlPoint: "connection",
  quickCreateNodeOnConnectBlank: "connection",
  // 画布配置
  canvasBackgroundMode: "canvas",
  isAutoFocus: "canvas",
  focusOpacity: "canvas",
  useDarkMode: "canvas",
  // 组件配置
  isExportConfig: "component",
  saveFilesBeforeDebug: "component",
  fieldPanelMode: "component",
  inlinePanelScale: "component",
  enableLiveScreen: "component",
  liveScreenRefreshRate: "component",
  historyLimit: "component",
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

/**配置默认值 */
const defaultConfigs = {
  isExportConfig: true,
  configHandlingMode: "integrated" as ConfigHandlingMode,
  showEdgeLabel: true,
  isAutoFocus: true,
  useDarkMode: false,
  historyLimit: 100,
  nodeStyle: "modern" as NodeStyleType,
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
  fileAutoReload: false,
  saveFilesBeforeDebug: true,
  enableCrossFileSearch: true,
  crossFileSearchFolderFilter: "",
  // AI 配置
  aiApiUrl: "",
  aiApiKey: "",
  aiModel: "",
  aiTemperature: 0.7,
  aiProviderType: "custom" as const,
  aiUseProxy: true,
  // 聚焦透明度
  focusOpacity: 0.3,
  // 边控制点
  showEdgeControlPoint: true,
  // 边走线模式
  edgePathMode: "bezier" as EdgePathMode,
  // 画布背景模式
  canvasBackgroundMode: "eyecare" as CanvasBackgroundMode,
  // 字段面板模式
  fieldPanelMode: "fixed" as FieldPanelMode,
  // 内嵌面板缩放比例
  inlinePanelScale: 0.8,
  // 节点显示 template 图片
  showNodeTemplateImages: true,
  // 渲染节点详细字段
  showNodeDetailFields: true,
  // 节点磁吸对齐
  enableNodeSnap: false,
  // 磁吸对齐仅限可视范围
  snapOnlyInViewport: true,
  // 实时画面预览
  enableLiveScreen: true,
  // 实时画面刷新间隔（毫秒）
  liveScreenRefreshRate: 1000,
};

/**配置默认值（只读），用于重置和对比 */
export const configDefaults: Readonly<ConfigState["configs"]> = defaultConfigs;

/**配置 */
export type ConfigState = {
  // 设置
  configs: {
    isExportConfig: boolean;
    configHandlingMode: ConfigHandlingMode;
    showEdgeLabel: boolean;
    isAutoFocus: boolean;
    useDarkMode: boolean;
    historyLimit: number;
    nodeStyle: NodeStyleType;
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
    fileAutoReload: boolean;
    saveFilesBeforeDebug: boolean;
    crossFileSearchFolderFilter: string;
    // AI 配置
    aiApiUrl: string;
    aiApiKey: string;
    aiModel: string;
    aiTemperature: number;
    aiProviderType: string;
    aiUseProxy: boolean;
    // 聚焦透明度
    focusOpacity: number;
    // 边控制点
    showEdgeControlPoint: boolean;
    // 边走线模式
    edgePathMode: EdgePathMode;
    // 启用跨文件搜索
    enableCrossFileSearch: boolean;
    // 画布背景模式
    canvasBackgroundMode: CanvasBackgroundMode;
    // 字段面板模式
    fieldPanelMode: FieldPanelMode;
    // 内嵌面板缩放比例
    inlinePanelScale: number;
    // 节点显示 template 图片
    showNodeTemplateImages: boolean;
    // 渲染节点详细字段
    showNodeDetailFields: boolean;
    // 节点磁吸对齐
    enableNodeSnap: boolean;
    // 磁吸对齐仅限可视范围
    snapOnlyInViewport: boolean;
    // 实时画面预览
    enableLiveScreen: boolean;
    // 实时画面刷新间隔（毫秒）
    liveScreenRefreshRate: number;
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
    showFileConfigPanel: boolean;
    showAIHistoryPanel: boolean;
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
    // 加密 API Key
    if (
      key === "aiApiKey" &&
      typeof value === "string" &&
      value &&
      !value.startsWith("ENC:")
    ) {
      encryptApiKey(value).then((encrypted) => {
        set((state) => {
          state.configuredKeys.add(key as string);
          return {
            configs: { ...state.configs, [key]: encrypted },
            configuredKeys: new Set(state.configuredKeys),
          };
        });
      });
      return;
    }

    set((state) => {
      const newConfigs = { ...state.configs, [key]: value };

      // 同步 isExportConfig 与 configHandlingMode
      if (key === "configHandlingMode") {
        newConfigs.isExportConfig = value !== "none";
      } else if (key === "isExportConfig") {
        newConfigs.configHandlingMode = value ? "integrated" : "none";
      }

      // 标记为已配置
      state.configuredKeys.add(key as string);

      return {
        configs: newConfigs,
        configuredKeys: new Set(state.configuredKeys),
      };
    });
  },
  replaceConfig(configs, configuredKeys) {
    set((state) => {
      const keys = Object.keys(state.configs);
      const newConfigs: Partial<ConfigState["configs"]> = {};
      Object.keys(configs).forEach((key) => {
        if (keys.includes(key)) {
          const configKey = key as keyof ConfigState["configs"];
          (newConfigs as Record<string, unknown>)[configKey] =
            configs[configKey];
        }
      });

      const mergedConfigs = { ...state.configs, ...newConfigs };

      // 从 isExportConfig 迁移至 configHandlingMode
      if (
        !mergedConfigs.configHandlingMode &&
        "isExportConfig" in mergedConfigs
      ) {
        mergedConfigs.configHandlingMode = mergedConfigs.isExportConfig
          ? "integrated"
          : "none";
      }

      // 同步 isExportConfig
      if (mergedConfigs.configHandlingMode) {
        mergedConfigs.isExportConfig =
          mergedConfigs.configHandlingMode !== "none";
      }

      // 批量标记导入的 key 为已配置
      const newConfiguredKeys = new Set(state.configuredKeys);
      if (configuredKeys) {
        for (const key of configuredKeys) {
          newConfiguredKeys.add(key);
        }
      }
      Object.keys(newConfigs).forEach((key) => newConfiguredKeys.add(key));

      // 迁移明文 API Key 为加密格式
      if (
        mergedConfigs.aiApiKey &&
        !mergedConfigs.aiApiKey.startsWith("ENC:")
      ) {
        const plainKey = mergedConfigs.aiApiKey;
        encryptApiKey(plainKey).then((encrypted) => {
          set((s) => ({
            configs: { ...s.configs, aiApiKey: encrypted },
          }));
        });
      }

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
    const defaultValue = configDefaults[key];
    set((state) => {
      const newConfigs = { ...state.configs, [key]: defaultValue };

      // 同步 isExportConfig 与 configHandlingMode
      if (key === "configHandlingMode") {
        newConfigs.isExportConfig = defaultValue !== "none";
      } else if (key === "isExportConfig") {
        newConfigs.configHandlingMode = defaultValue ? "integrated" : "none";
      }

      return { configs: newConfigs };
    });
  },
  resetAllConfigs() {
    set({ configs: { ...defaultConfigs }, configuredKeys: new Set() });
  },
  // 状态
  status: {
    showConfigPanel: false,
    showFileConfigPanel: false,
    showAIHistoryPanel: false,
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
  localStorage.setItem(
    CONFIG_STORAGE_KEY,
    JSON.stringify({
      ...configState.configs,
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
