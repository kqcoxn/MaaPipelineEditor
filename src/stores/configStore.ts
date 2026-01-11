import { create } from "zustand";
import type { HandleDirection } from "../components/flow/nodes/constants";

/**固有配置 */
export const globalConfig = {
  dev: true,
  version: `0.15.0`,
  betaIteration: 3,
  mfwVersion: "5.3",
  protocolVersion: "0.3",
};

if (globalConfig.dev) {
  globalConfig.version = `${globalConfig.version}_beta_${globalConfig.betaIteration}`;
}

/**配置分类 */
export type ConfigCategory = "panel" | "pipeline" | "communication" | "ai";

/**字段面板模式 */
export type FieldPanelMode = "fixed" | "draggable" | "inline";

/**配置分类映射 - 用于确定哪些配置属于哪个类别 */
export const configCategoryMap: Record<string, ConfigCategory> = {
  // Pipeline 配置
  nodeAttrExportStyle: "pipeline",
  defaultHandleDirection: "pipeline",
  // 面板配置
  nodeStyle: "panel",
  historyLimit: "panel",
  isRealTimePreview: "panel",
  showEdgeLabel: "panel",
  showEdgeControlPoint: "panel",
  isAutoFocus: "panel",
  focusOpacity: "panel",
  configHandlingMode: "panel",
  isExportConfig: "panel",
  useDarkMode: "panel",
  canvasBackgroundMode: "panel",
  fieldPanelMode: "panel",
  inlinePanelScale: "panel",
  showNodeTemplateImages: "panel",
  saveFilesBeforeDebug: "panel",
  // 本地通信配置
  wsPort: "communication",
  wsAutoConnect: "communication",
  fileAutoReload: "communication",
  // AI 配置
  aiApiUrl: "ai",
  aiApiKey: "ai",
  aiModel: "ai",
};

/**获取可导出的配置 */
export const getExportableConfigs = (
  configs: ConfigState["configs"],
  excludeCategories: ConfigCategory[] = []
): Partial<ConfigState["configs"]> => {
  const result: Record<string, any> = {};
  Object.entries(configs).forEach(([key, value]) => {
    const category = configCategoryMap[key];
    if (category && !excludeCategories.includes(category)) {
      result[key] = value;
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

// 画布背景模式
export type CanvasBackgroundMode = "pure" | "eyecare";

/**配置 */
type ConfigState = {
  // 设置
  configs: {
    isRealTimePreview: boolean;
    isExportConfig: boolean;
    configHandlingMode: ConfigHandlingMode;
    showEdgeLabel: boolean;
    isAutoFocus: boolean;
    useDarkMode: boolean;
    historyLimit: number;
    nodeStyle: NodeStyleType;
    nodeAttrExportStyle: NodeAttrExportStyle;
    defaultHandleDirection: HandleDirection;
    wsPort: number;
    wsAutoConnect: boolean;
    fileAutoReload: boolean;
    saveFilesBeforeDebug: boolean;
    // AI 配置
    aiApiUrl: string;
    aiApiKey: string;
    aiModel: string;
    // 聚焦透明度
    focusOpacity: number;
    // 边控制点
    showEdgeControlPoint: boolean;
    // 画布背景模式
    canvasBackgroundMode: CanvasBackgroundMode;
    // 字段面板模式
    fieldPanelMode: FieldPanelMode;
    // 内嵌面板缩放比例
    inlinePanelScale: number;
    // 节点显示 template 图片
    showNodeTemplateImages: boolean;
  };
  setConfig: <K extends keyof ConfigState["configs"]>(
    key: K,
    value: ConfigState["configs"][K]
  ) => void;
  replaceConfig: (configs: any) => void;
  // 状态
  status: {
    showConfigPanel: boolean;
    showAIHistoryPanel: boolean;
    showLocalFilePanel: boolean;
    rightPanelWidth: number;
  };
  setStatus: <K extends keyof ConfigState["status"]>(
    key: K,
    value: ConfigState["status"][K]
  ) => void;
};

export const useConfigStore = create<ConfigState>()((set) => ({
  // 设置
  configs: {
    isRealTimePreview: false,
    isExportConfig: true,
    configHandlingMode: "integrated" as ConfigHandlingMode,
    showEdgeLabel: true,
    isAutoFocus: true,
    useDarkMode: false,
    historyLimit: 100,
    nodeStyle: "modern" as NodeStyleType,
    nodeAttrExportStyle: "object" as NodeAttrExportStyle,
    defaultHandleDirection: "left-right" as HandleDirection,
    wsPort: 9066,
    wsAutoConnect: false,
    fileAutoReload: false,
    saveFilesBeforeDebug: true,
    // AI 配置
    aiApiUrl: "",
    aiApiKey: "",
    aiModel: "",
    // 聚焦透明度
    focusOpacity: 0.3,
    // 边控制点
    showEdgeControlPoint: true,
    // 画布背景模式
    canvasBackgroundMode: "eyecare" as CanvasBackgroundMode,
    // 字段面板模式
    fieldPanelMode: "fixed" as FieldPanelMode,
    // 内嵌面板缩放比例
    inlinePanelScale: 0.8,
    // 节点显示 template 图片
    showNodeTemplateImages: false,
  },
  setConfig(key, value) {
    set((state) => {
      const newConfigs = { ...state.configs, [key]: value };

      // 同步 isExportConfig 与 configHandlingMode
      if (key === "configHandlingMode") {
        newConfigs.isExportConfig = value !== "none";
      } else if (key === "isExportConfig") {
        newConfigs.configHandlingMode = value ? "integrated" : "none";
      }

      return { configs: newConfigs };
    });
  },
  replaceConfig(configs) {
    set((state) => {
      const keys = Object.keys(state.configs);
      const newConfigs: Record<string, any> = {};
      Object.keys(configs).forEach((key) => {
        if (keys.includes(key)) newConfigs[key] = configs[key];
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

      return { configs: mergedConfigs };
    });
  },
  // 状态
  status: {
    showConfigPanel: false,
    showAIHistoryPanel: false,
    showLocalFilePanel: false,
    rightPanelWidth: 350,
  },
  setStatus(key, value) {
    set((state) => ({
      status: { ...state.status, [key]: value },
    }));
  },
}));
