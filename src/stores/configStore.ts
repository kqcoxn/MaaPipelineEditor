import { create } from "zustand";

export const globalConfig = {
  dev: true,
  version: "v0.5.0",
};

export type ConfigType = {
  filename?: string;
  version?: string;
  prefix?: string;
  [key: string]: any;
};

/**配置 */
type ConfigState = {} & ConfigType;
export const useConfigStore = create<ConfigState>()((set) => ({}));
