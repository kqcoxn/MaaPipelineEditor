import { create } from "zustand";

export const globalConfig = {
  dev: true,
  version: "v0.5.0",
};

/**配置 */
type ConfigState = {
  // 设置
  configs: {
    isRealTimePreview: boolean;
  };
  setConfig: <K extends keyof ConfigState["configs"]>(
    key: K,
    value: ConfigState["configs"][K],
    refresh?: boolean
  ) => void;
  // 状态
  status: {
    isShowConfigPanel: boolean;
  };
  setStatus: <K extends keyof ConfigState["status"]>(
    key: K,
    value: ConfigState["status"][K],
    refreshAll?: boolean
  ) => void;
};
export const useConfigStore = create<ConfigState>()((set) => ({
  // 设置
  configs: { isRealTimePreview: false },
  setConfig(key, value, refresh = false) {
    set((state) => {
      const configs = state.configs;
      configs[key] = value;
      return refresh ? { ...configs } : {};
    });
  },
  // 状态
  status: { isShowConfigPanel: true },
  setStatus(key, value, refresh = false) {
    set((state) => {
      const status = state.status;
      status[key] = value;
      return refresh ? { ...status } : {};
    });
  },
}));
