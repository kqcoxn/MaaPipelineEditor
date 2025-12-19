import { create } from "zustand";

/**固有配置 */
export const globalConfig = {
  dev: true,
  version: `0.11.3`,
  betaIteration: 2,
  mfwVersion: "5.3",
  protocolVersion: "0.2",
};

if (globalConfig.dev) {
  globalConfig.version = `${globalConfig.version}_beta_${globalConfig.betaIteration}`;
}

// 节点风格类型
export type NodeStyleType = "modern" | "classic";

// 节点属性导出形式
export type NodeAttrExportStyle = "object" | "prefix";

/**配置 */
type ConfigState = {
  // 设置
  configs: {
    isRealTimePreview: boolean;
    isExportConfig: boolean;
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
    set((state) => ({
      configs: { ...state.configs, [key]: value },
    }));
  },
  replaceConfig(configs) {
    set((state) => {
      const keys = Object.keys(state.configs);
      const newConfigs: Record<string, any> = {};
      Object.keys(configs).forEach((key) => {
        if (keys.includes(key)) newConfigs[key] = configs[key];
      });
      return { configs: { ...state.configs, ...newConfigs } };
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
