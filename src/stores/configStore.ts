import { create } from "zustand";

/**固有配置 */
export const globalConfig = {
  dev: true,
  version: `0.8.0`,
  betaIteration: 1,
  mfwVersion: "5.0",
};

if (globalConfig.dev) {
  globalConfig.version = `${globalConfig.version}_beta_${globalConfig.betaIteration}`;
}

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
    wsPort: number;
    wsConnected: boolean;
    wsConnecting: boolean;
    wsAutoConnect: boolean;
  };
  setConfig: <K extends keyof ConfigState["configs"]>(
    key: K,
    value: ConfigState["configs"][K]
  ) => void;
  replaceConfig: (configs: any) => void;
  // 状态
  status: {
    showConfigPanel: boolean;
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
    wsPort: 9066,
    wsConnected: false,
    wsConnecting: false,
    wsAutoConnect: false,
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
  status: { showConfigPanel: false },
  setStatus(key, value) {
    set((state) => ({
      status: { ...state.status, [key]: value },
    }));
  },
}));
