import { create } from "zustand";
import { message } from "antd";
import type { NodeType, EdgeType } from "./flow/types";

type ClipboardState = {
  clipboardNodes: NodeType[];
  clipboardEdges: EdgeType[];
  copy: (nodes?: NodeType[], edges?: EdgeType[]) => void;
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
      return;
    }

    set({
      clipboardNodes: nodes || [],
      clipboardEdges: edges || [],
    });

    message.success("已将选中节点加载至内部粘贴板");
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
