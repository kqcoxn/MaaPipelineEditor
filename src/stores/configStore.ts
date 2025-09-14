import { create } from "zustand";

import { useFlowStore, type NodeType, type EdgeType } from "./flowStore";
import { message } from "antd";
import { JsonHelper } from "../utils/jsonHelper";

/**固有配置 */
const mainVersion = "0.5.2";
const betaIndex = 4;
export const globalConfig = {
  dev: true,
  version: `v${mainVersion}`,
};
if (globalConfig.dev) {
  globalConfig.version += `_beta${betaIndex}`;
}

/**配置 */
type ConfigState = {
  // 设置
  configs: {
    isRealTimePreview: boolean;
    isExportConfig: boolean;
    showEdgeLabel: boolean;
    isAutoFocus: boolean;
    isShowV1: boolean;
  };
  setConfig: <K extends keyof ConfigState["configs"]>(
    key: K,
    value: ConfigState["configs"][K],
    refresh?: boolean
  ) => void;
  replaceConfig: (configs: any) => void;
  // 状态
  status: {
    showConfigPanel: boolean;
  };
  setStatus: <K extends keyof ConfigState["status"]>(
    key: K,
    value: ConfigState["status"][K],
    refreshAll?: boolean
  ) => void;
  // 粘贴板
  clipBoard: { nodes: NodeType[]; edges: EdgeType[] };
  setClipBoard: (nodes?: NodeType[], edges?: EdgeType[]) => void;
  applyClipBoard: () => void;
};
export const useConfigStore = create<ConfigState>()((set) => ({
  // 设置
  configs: {
    isRealTimePreview: false,
    isExportConfig: true,
    showEdgeLabel: true,
    isAutoFocus: true,
    isShowV1: true,
  },
  setConfig(key, value, refresh = false) {
    set((state) => {
      const configs = state.configs;
      configs[key] = value;
      return refresh ? { ...configs } : {};
    });
  },
  replaceConfig(configs) {
    set((state) => {
      if (JsonHelper.isStringObj(configs)) configs = JSON.parse(configs);
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
  setStatus(key, value, refresh = false) {
    set((state) => {
      const status = state.status;
      status[key] = value;
      return refresh ? { ...status } : {};
    });
  },
  // 粘贴板
  clipBoard: {
    nodes: [],
    edges: [],
  },
  setClipBoard(nodes, edges) {
    set(() => {
      const flowState = useFlowStore.getState();
      if (!nodes) nodes = flowState.selectedNodes;
      if (!edges) edges = flowState.selectedEdges;

      if (nodes.length === 0) {
        message.error("未选中节点");
        return {};
      }

      message.success("已将选中节点加载至内部粘贴板");
      return { clipBoard: { nodes, edges } };
    });
  },
  applyClipBoard() {
    set((state) => {
      const clipBoard = state.clipBoard;
      if (clipBoard.nodes.length === 0) {
        message.error("粘贴板中无已复制节点");
        return {};
      }
      const paste = useFlowStore.getState().paste;
      paste(clipBoard.nodes, clipBoard.edges);
      message.success("粘贴成功");
      return {};
    });
  },
}));
