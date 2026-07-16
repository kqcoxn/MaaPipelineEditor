import { message } from "antd";
import type { ReactNode } from "react";
import { LayoutHelper, AlignmentEnum } from "../../core/layout";
import { flowToPipeline } from "../../core/parser";
import { useClipboardStore } from "../../stores/clipboardStore";
import { useFlowStore, type EdgeType, type NodeType } from "../../stores/flow";
import { ClipboardHelper } from "../../utils/ui/clipboard";
import { NodeTypeEnum } from "./nodes";

export interface SelectionContextMenuSelection {
  selectedNodes: NodeType[];
  selectedEdges: EdgeType[];
}

export interface SelectionContextMenuItem {
  key: string;
  label: string;
  icon: ReactNode | string;
  iconSize?: number;
  onClick: (selection: SelectionContextMenuSelection) => void | Promise<void>;
  disabled?: boolean | ((selection: SelectionContextMenuSelection) => boolean);
  visible?: (selection: SelectionContextMenuSelection) => boolean;
  danger?: boolean;
}

export interface SelectionContextMenuSubItem {
  key: string;
  label: string;
  onClick: (selection: SelectionContextMenuSelection) => void | Promise<void>;
  disabled?: boolean | ((selection: SelectionContextMenuSelection) => boolean);
}

export interface SelectionContextMenuWithChildren {
  key: string;
  label: string;
  icon: ReactNode | string;
  iconSize?: number;
  children: SelectionContextMenuSubItem[];
  visible?: (selection: SelectionContextMenuSelection) => boolean;
}

export interface SelectionContextMenuDivider {
  type: "divider";
  key: string;
}

export type SelectionContextMenuConfig =
  | SelectionContextMenuItem
  | SelectionContextMenuDivider
  | SelectionContextMenuWithChildren;

function getSelectionRelatedEdges(
  selection: SelectionContextMenuSelection,
): EdgeType[] {
  const { edges } = useFlowStore.getState();
  const selectedNodeIds = new Set(
    selection.selectedNodes.map((node) => node.id),
  );
  const relatedEdges = new Map(
    selection.selectedEdges.map((edge) => [edge.id, edge]),
  );

  if (selectedNodeIds.size === 0) {
    return Array.from(relatedEdges.values());
  }

  edges.forEach((edge) => {
    if (selectedNodeIds.has(edge.source) && selectedNodeIds.has(edge.target)) {
      relatedEdges.set(edge.id, edge);
    }
  });

  return Array.from(relatedEdges.values());
}

function getSelectionConnectedEdges(
  selection: SelectionContextMenuSelection,
): EdgeType[] {
  const { edges } = useFlowStore.getState();
  const selectedNodeIds = new Set(
    selection.selectedNodes.map((node) => node.id),
  );
  const connectedEdges = new Map(
    selection.selectedEdges.map((edge) => [edge.id, edge]),
  );

  if (selectedNodeIds.size === 0) {
    return Array.from(connectedEdges.values());
  }

  edges.forEach((edge) => {
    if (selectedNodeIds.has(edge.source) || selectedNodeIds.has(edge.target)) {
      connectedEdges.set(edge.id, edge);
    }
  });

  return Array.from(connectedEdges.values());
}

function hasSelectedNodes(selection: SelectionContextMenuSelection): boolean {
  return selection.selectedNodes.length > 0;
}

function hasMultiSelectedNodes(
  selection: SelectionContextMenuSelection,
): boolean {
  return selection.selectedNodes.length >= 2;
}

function hasGroupNodes(selection: SelectionContextMenuSelection): boolean {
  return selection.selectedNodes.some(
    (node) => node.type === NodeTypeEnum.Group,
  );
}

function hasNonGroupNodes(selection: SelectionContextMenuSelection): boolean {
  return selection.selectedNodes.some(
    (node) => node.type !== NodeTypeEnum.Group,
  );
}

function hasGroupedNodes(selection: SelectionContextMenuSelection): boolean {
  return selection.selectedNodes.some(
    (node) =>
      node.type !== NodeTypeEnum.Group && Boolean((node as any).parentId),
  );
}

function handleCopySelection(selection: SelectionContextMenuSelection): void {
  if (!hasSelectedNodes(selection)) {
    message.error("未选中节点");
    return;
  }

  useClipboardStore
    .getState()
    .copy(selection.selectedNodes, getSelectionRelatedEdges(selection));
}

function handleDuplicateSelection(
  selection: SelectionContextMenuSelection,
): void {
  if (!hasSelectedNodes(selection)) {
    message.error("未选中节点");
    return;
  }

  useFlowStore
    .getState()
    .paste(selection.selectedNodes, getSelectionRelatedEdges(selection));
  message.success("已创建副本");
}

async function handleDeleteSelection(
  selection: SelectionContextMenuSelection,
): Promise<void> {
  const { selectedNodes, selectedEdges } = selection;
  if (selectedNodes.length === 0 && selectedEdges.length === 0) {
    return;
  }

  const { instance, edges, updateEdges, updateNodes } = useFlowStore.getState();
  if (instance) {
    await instance.deleteElements({
      nodes: selectedNodes,
      edges: selectedEdges,
    });
    return;
  }

  const edgeIds = new Set(selectedEdges.map((edge) => edge.id));
  const selectedNodeIds = new Set(selectedNodes.map((node) => node.id));

  edges.forEach((edge) => {
    if (selectedNodeIds.has(edge.source) || selectedNodeIds.has(edge.target)) {
      edgeIds.add(edge.id);
    }
  });

  if (edgeIds.size > 0) {
    updateEdges(
      Array.from(edgeIds, (id) => ({
        id,
        type: "remove" as const,
      })),
    );
  }

  if (selectedNodes.length > 0) {
    updateNodes(
      selectedNodes.map((node) => ({
        id: node.id,
        type: "remove" as const,
      })),
    );
  }
}

function handlePartialExport(selection: SelectionContextMenuSelection): void {
  if (!hasSelectedNodes(selection)) {
    message.error("未选中节点");
    return;
  }

  const exported = flowToPipeline({
    nodes: selection.selectedNodes,
    edges: getSelectionRelatedEdges(selection),
  });

  if (Object.keys(exported).length === 0) {
    return;
  }

  void ClipboardHelper.write(exported, {
    successMsg: "已将选中内容导出到剪贴板",
  });
}

function handleAlignSelection(
  direction: AlignmentEnum,
  selection: SelectionContextMenuSelection,
): void {
  if (!hasMultiSelectedNodes(selection)) {
    message.error("请至少选择两个节点");
    return;
  }

  LayoutHelper.align(direction, selection.selectedNodes);
}

function handleShiftSelection(
  direction: "horizontal" | "vertical",
  delta: number,
  selection: SelectionContextMenuSelection,
): void {
  if (!hasMultiSelectedNodes(selection)) {
    message.error("请至少选择两个节点");
    return;
  }

  useFlowStore.getState().shiftNodes(
    direction,
    delta,
    selection.selectedNodes.map((node) => node.id),
  );
}

function handleCreateGroup(selection: SelectionContextMenuSelection): void {
  if (!hasNonGroupNodes(selection)) {
    message.error("未选中可分组节点");
    return;
  }

  useFlowStore.getState().groupSelectedNodes();
  message.success("已创建分组");
}

function handleDetachSelectionFromGroup(
  selection: SelectionContextMenuSelection,
): void {
  const nodeIds = selection.selectedNodes
    .filter(
      (node) =>
        node.type !== NodeTypeEnum.Group && Boolean((node as any).parentId),
    )
    .map((node) => node.id);

  if (nodeIds.length === 0) {
    message.error("选中节点不在分组中");
    return;
  }

  const { detachNodeFromGroup } = useFlowStore.getState();
  nodeIds.forEach((nodeId) => detachNodeFromGroup(nodeId));
  message.success("已将节点移出分组");
}

function handleUngroupSelection(
  selection: SelectionContextMenuSelection,
): void {
  const groupIds = selection.selectedNodes
    .filter((node) => node.type === NodeTypeEnum.Group)
    .map((node) => node.id);

  if (groupIds.length === 0) {
    message.error("未选中分组");
    return;
  }

  const { ungroupNodes } = useFlowStore.getState();
  groupIds.forEach((groupId) => ungroupNodes(groupId));
  message.success("已解散所选分组");
}

function handleAutoLayoutSelection(
  selection: SelectionContextMenuSelection,
): void {
  if (!hasMultiSelectedNodes(selection)) {
    message.error("请至少选择两个节点");
    return;
  }

  LayoutHelper.autoPartial(selection.selectedNodes);
}

function handleResetEdgeControls(
  selection: SelectionContextMenuSelection,
): void {
  const targetEdgeIds = getSelectionConnectedEdges(selection).map(
    (edge) => edge.id,
  );

  if (targetEdgeIds.length === 0) {
    message.error("未选中可还原的连线");
    return;
  }

  useFlowStore.getState().resetEdgeControls(targetEdgeIds);
  message.success("已还原所选连线路径");
}

export function getSelectionContextMenuConfig(
  selection: SelectionContextMenuSelection,
): SelectionContextMenuConfig[] {
  const hasSelection =
    selection.selectedNodes.length > 0 || selection.selectedEdges.length > 0;

  return [
    {
      key: "copy-selection",
      label: "复制",
      icon: "icon-a-copyfubenfuzhi",
      iconSize: 16,
      onClick: handleCopySelection,
      disabled: (selection) => !hasSelectedNodes(selection),
    },
    {
      key: "duplicate-selection",
      label: "创建副本",
      icon: "icon-beifen",
      iconSize: 16,
      onClick: handleDuplicateSelection,
      disabled: (selection) => !hasSelectedNodes(selection),
    },
    {
      key: "partial-export-selection",
      label: "部分导出",
      icon: "icon-daoru",
      iconSize: 16,
      onClick: handlePartialExport,
      disabled: (selection) => !hasSelectedNodes(selection),
    },
    {
      type: "divider",
      key: "divider-layout",
    },
    {
      key: "align-selection",
      label: "对齐",
      icon: "icon-jurassic_horizalign-center",
      iconSize: 16,
      children: [
        {
          key: "align-left",
          label: "左对齐",
          onClick: (selection) =>
            handleAlignSelection(AlignmentEnum.Left, selection),
          disabled: (selection) => !hasMultiSelectedNodes(selection),
        },
        {
          key: "align-center",
          label: "水平居中",
          onClick: (selection) =>
            handleAlignSelection(AlignmentEnum.Center, selection),
          disabled: (selection) => !hasMultiSelectedNodes(selection),
        },
        {
          key: "align-right",
          label: "右对齐",
          onClick: (selection) =>
            handleAlignSelection(AlignmentEnum.Right, selection),
          disabled: (selection) => !hasMultiSelectedNodes(selection),
        },
        {
          key: "align-top",
          label: "顶部对齐",
          onClick: (selection) =>
            handleAlignSelection(AlignmentEnum.Top, selection),
          disabled: (selection) => !hasMultiSelectedNodes(selection),
        },
        {
          key: "align-middle",
          label: "垂直居中",
          onClick: (selection) =>
            handleAlignSelection(AlignmentEnum.Middle, selection),
          disabled: (selection) => !hasMultiSelectedNodes(selection),
        },
        {
          key: "align-bottom",
          label: "底部对齐",
          onClick: (selection) =>
            handleAlignSelection(AlignmentEnum.Bottom, selection),
          disabled: (selection) => !hasMultiSelectedNodes(selection),
        },
      ],
      visible: (selection) => selection.selectedNodes.length > 0,
    },
    {
      key: "spacing-selection",
      label: "间距",
      icon: "icon-jurassic_HorFensan-align",
      iconSize: 16,
      children: [
        {
          key: "spacing-horizontal-decrease",
          label: "减小水平间距",
          onClick: (selection) =>
            handleShiftSelection("horizontal", -5, selection),
          disabled: (selection) => !hasMultiSelectedNodes(selection),
        },
        {
          key: "spacing-horizontal-increase",
          label: "增大水平间距",
          onClick: (selection) =>
            handleShiftSelection("horizontal", 5, selection),
          disabled: (selection) => !hasMultiSelectedNodes(selection),
        },
        {
          key: "spacing-vertical-decrease",
          label: "减小垂直间距",
          onClick: (selection) =>
            handleShiftSelection("vertical", -5, selection),
          disabled: (selection) => !hasMultiSelectedNodes(selection),
        },
        {
          key: "spacing-vertical-increase",
          label: "增大垂直间距",
          onClick: (selection) =>
            handleShiftSelection("vertical", 5, selection),
          disabled: (selection) => !hasMultiSelectedNodes(selection),
        },
      ],
      visible: (selection) => selection.selectedNodes.length > 0,
    },
    {
      key: "auto-layout-selection",
      label: "局部自动布局",
      icon: "icon-liuchengtu",
      iconSize: 16,
      onClick: handleAutoLayoutSelection,
      disabled: (selection) => !hasMultiSelectedNodes(selection),
      visible: (selection) => selection.selectedNodes.length > 0,
    },
    {
      key: "reset-edge-controls",
      label: "还原连线路径",
      icon: "icon-connecting_line",
      iconSize: 16,
      onClick: handleResetEdgeControls,
      disabled: (selection) =>
        getSelectionConnectedEdges(selection).length === 0,
    },
    {
      key: "group-selection",
      label: "分组",
      icon: "icon-kuangxuanzhong",
      iconSize: 16,
      children: [
        {
          key: "create-group",
          label: "创建分组",
          onClick: handleCreateGroup,
          disabled: (selection) => !hasNonGroupNodes(selection),
        },
        {
          key: "detach-from-group",
          label: "移出当前分组",
          onClick: handleDetachSelectionFromGroup,
          disabled: (selection) => !hasGroupedNodes(selection),
        },
        {
          key: "ungroup-selection",
          label: "解散所选分组",
          onClick: handleUngroupSelection,
          disabled: (selection) => !hasGroupNodes(selection),
        },
      ],
      visible: (selection) => selection.selectedNodes.length > 0,
    },
    {
      type: "divider",
      key: "divider-delete",
    },
    {
      key: "delete-selection",
      label: "删除",
      icon: "icon-shanchu",
      iconSize: 16,
      onClick: handleDeleteSelection,
      disabled: () => !hasSelection,
      danger: true,
    },
  ];
}
