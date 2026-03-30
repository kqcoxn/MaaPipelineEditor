import type { StateCreator } from "zustand";
import type { FlowStore, FlowAnchorRefState, NodeType } from "../types";
import { NodeTypeEnum } from "../../../components/flow/nodes";

/**
 * 从节点数据中提取 anchor 名称列表
 * anchor 字段支持三种格式：
 * - 字符串: "MyAnchor"
 * - 字符串数组: ["A", "B"]
 * - 对象: {"A": "TargetNode", "B": ""}
 */
function extractAnchorNames(anchorValue: unknown): string[] {
  if (!anchorValue) return [];

  if (typeof anchorValue === "string") {
    return anchorValue.trim() ? [anchorValue.trim()] : [];
  }

  if (Array.isArray(anchorValue)) {
    return anchorValue
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter((item) => item);
  }

  if (typeof anchorValue === "object") {
    return Object.keys(anchorValue).filter((key) => key.trim());
  }

  return [];
}

/**
 * 构建节点列表的 anchor 引用索引
 */
function buildAnchorIndex(nodes: NodeType[]): Map<string, Set<string>> {
  const index = new Map<string, Set<string>>();

  for (const node of nodes) {
    // 只处理 Pipeline 节点
    if (node.type !== NodeTypeEnum.Pipeline) continue;

    const anchorValue = (node.data as any).others?.anchor;
    const anchorNames = extractAnchorNames(anchorValue);

    for (const anchorName of anchorNames) {
      if (!index.has(anchorName)) {
        index.set(anchorName, new Set());
      }
      index.get(anchorName)!.add(node.id);
    }
  }

  return index;
}

export const createAnchorRefSlice: StateCreator<
  FlowStore,
  [],
  [],
  FlowAnchorRefState
> = (set, get) => ({
  // 初始状态
  anchorReferenceIndex: new Map(),
  anchorRefHighlightedNodeIds: new Set(),
  selectedAnchorName: null,

  // 重建 anchor 引用索引
  rebuildAnchorReferenceIndex() {
    const nodes = get().nodes;
    const newIndex = buildAnchorIndex(nodes);
    set({ anchorReferenceIndex: newIndex });
  },

  // 设置选中的 anchor 名称
  setSelectedAnchorName(anchorName: string | null) {
    if (anchorName === get().selectedAnchorName) return;

    const index = get().anchorReferenceIndex;
    let highlightedIds: Set<string>;
    if (anchorName) {
      const found = index.get(anchorName);
      highlightedIds = found ? new Set(found) : new Set();
    } else {
      highlightedIds = new Set();
    }

    set({
      selectedAnchorName: anchorName,
      anchorRefHighlightedNodeIds: highlightedIds,
    });
  },

  // 获取使用指定 anchor 的节点 ID 列表
  getNodesUsingAnchor(anchorName: string): string[] {
    const index = get().anchorReferenceIndex;
    const nodeIds = index.get(anchorName);
    return nodeIds ? Array.from(nodeIds) : [];
  },
});
