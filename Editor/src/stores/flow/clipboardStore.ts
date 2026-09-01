import { create } from "zustand";
import { message } from "antd";
import { cloneDeep } from "lodash";
import type { NodeType, EdgeType } from "./types";
import {
  runWithProcess,
  shouldShowBulkProcess,
  type ProcessUpdate,
} from "@/stores/ui/processStore";

type ClipboardState = {
  clipboardNodes: NodeType[];
  clipboardEdges: EdgeType[];
  copy: (nodes?: NodeType[], edges?: EdgeType[]) => Promise<void>;
  paste: () => { nodes: NodeType[]; edges: EdgeType[] } | null;
  hasContent: () => boolean;
};

export const useClipboardStore = create<ClipboardState>()((set, get) => ({
  clipboardNodes: [],
  clipboardEdges: [],

  // 复制节点和边到剪贴板
  copy(nodes, edges) {
    if (!nodes || nodes.length === 0) {
      message.error("未选中节点");
      return Promise.resolve();
    }

    const sourceEdges = edges ?? [];
    const executeCopy = (
      updateProcess?: (update: ProcessUpdate) => void,
    ) => {
      const clipboardNodes = cloneDeep(nodes);
      const clipboardEdges = cloneDeep(sourceEdges);
      updateProcess?.({ detail: "正在写入内部粘贴板", progress: 96 });
      set({ clipboardNodes, clipboardEdges });
      message.success("已将选中节点加载至内部粘贴板");
    };

    if (shouldShowBulkProcess(nodes.length)) {
      return runWithProcess("正在复制节点", executeCopy, {
        detail: `正在复制 ${nodes.length} 个节点`,
        progress: 28,
      });
    }

    executeCopy();
    return Promise.resolve();
  },

  // 从剪贴板粘贴
  paste() {
    const state = get();
    if (state.clipboardNodes.length === 0) {
      message.error("粘贴板中无已复制节点");
      return null;
    }

    return {
      nodes: state.clipboardNodes,
      edges: state.clipboardEdges,
    };
  },

  // 检查是否有内容
  hasContent() {
    return get().clipboardNodes.length > 0;
  },
}));
