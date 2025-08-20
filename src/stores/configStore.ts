import { create } from "zustand";

export const globalConfig = {
  dev: true,
  version: "v0.5.0",
};

export type PipelineConfigType = {
  filename?: string;
  version?: string;
  prefix?: string;
  [key: string]: any;
};

/**配置 */
type ConfigState = {} & PipelineConfigType;
export const useConfigStore = create<ConfigState>()((set) => ({}));
