import { create } from "zustand";

/**固有配置 */
export const globalConfig = {
  dev: true,
  version: `0.13.1`,
  betaIteration: 0,
  mfwVersion: "5.3.0",
  protocolVersion: "0.3", // 通信协议版本
};

if (globalConfig.dev) {
  globalConfig.version = `${globalConfig.version}_beta_${globalConfig.betaIteration}`;
}

// 节点风格类型
export type NodeStyleType = "modern" | "classic";

// 节点属性导出形式
export type NodeAttrExportStyle = "object" | "prefix";

// 配置处理方案类型
export type ConfigHandlingMode = "integrated" | "separated" | "none";

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
    wsPort: number;
    wsAutoConnect: boolean;
    fileAutoReload: boolean;
    // AI 配置
    aiApiUrl: string;
    aiApiKey: string;
    aiModel: string;
    // 聚焦透明度
    focusOpacity: number;
    // 边控制点
    showEdgeControlPoint: boolean;
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
    wsPort: 9066,
    wsAutoConnect: false,
    fileAutoReload: false,
    // AI 配置
    aiApiUrl: "",
    aiApiKey: "",
    aiModel: "",
    // 聚焦透明度
    focusOpacity: 0.3,
    // 边控制点
    showEdgeControlPoint: true,
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
