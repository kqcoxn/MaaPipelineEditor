import { message } from "antd";
import type { ReactNode } from "react";
import { FlagOutlined, PlayCircleOutlined } from "@ant-design/icons";
import type { Node } from "@xyflow/react";
import { NodeTypeEnum, HANDLE_DIRECTION_OPTIONS } from "./constants";
import type { HandleDirection } from "./constants";
import type {
  PipelineNodeDataType,
  ExternalNodeDataType,
  AnchorNodeDataType,
  StickerNodeDataType,
  GroupNodeDataType,
  StickerColorTheme,
} from "../../../stores/flow";
import { useFlowStore } from "../../../stores/flow";
import {
  copyNodeName,
  saveNodeAsTemplate,
  deleteNode,
  copyNodeRecoJSON,
} from "./utils/nodeOperations";
import { useDebugModalMemoryStore } from "@/stores/debug/debugModalMemoryStore";
import type {
  DebugCapabilityManifest,
  DebugRunMode,
} from "../../../features/debug/types";
import {
  applyDebugNodeTarget,
  getDebugNodeTarget,
} from "../../../features/debug/actions/nodeTargetActions";
import { requestDebugRun } from "../../../features/debug/actions/debugRunRequestBridge";
import { isEmbedEnvironment } from "../../../utils/embedBridge";
import { showEmbedServiceNotice } from "../../../features/embed/components/serviceNotice";

/**菜单项类型 */
export interface NodeContextMenuItem {
  key: string;
  label: string;
  icon: ReactNode | string;
  iconSize?: number;
  onClick: (node: NodeContextMenuNode) => void;
  disabled?: boolean | ((node: NodeContextMenuNode) => boolean);
  disabledTip?: string;
  visible?: (node: NodeContextMenuNode) => boolean;
  danger?: boolean;
}

/**子菜单项类型 */
export interface NodeContextMenuSubItem {
  key: string;
  label: string;
  icon?: ReactNode | string;
  iconSize?: number;
  onClick: (node: NodeContextMenuNode) => void;
  disabled?: boolean | ((node: NodeContextMenuNode) => boolean);
  checked?: boolean | ((node: NodeContextMenuNode) => boolean);
}

/**带子菜单的菜单项类型 */
export interface NodeContextMenuWithChildren {
  key: string;
  label: string;
  icon: ReactNode | string;
  iconSize?: number;
  children: NodeContextMenuSubItem[];
  visible?: (node: NodeContextMenuNode) => boolean;
}

/**分隔线类型 */
export interface NodeContextMenuDivider {
  type: "divider";
  key: string;
}

/**菜单配置项联合类型 */
export type NodeContextMenuConfig =
  | NodeContextMenuItem
  | NodeContextMenuDivider
  | NodeContextMenuWithChildren;

/**节点类型联合 */
export type NodeContextMenuNode =
  | Node<PipelineNodeDataType, NodeTypeEnum.Pipeline>
  | Node<ExternalNodeDataType, NodeTypeEnum.External>
  | Node<AnchorNodeDataType, NodeTypeEnum.Anchor>
  | Node<StickerNodeDataType, NodeTypeEnum.Sticker>
  | Node<GroupNodeDataType, NodeTypeEnum.Group>;

type NodeDataWithHandleDirection = {
  handleDirection?: HandleDirection;
};

type NodeDataWithColor = {
  color?: string;
};

/**复制节点名处理器 */
function handleCopyNodeName(node: NodeContextMenuNode) {
  copyNodeName(node.data.label, node.type);
}

/**保存为模板处理器 */
function handleSaveAsTemplate(node: NodeContextMenuNode) {
  if (node.type !== NodeTypeEnum.Pipeline) {
    message.error("仅支持 Pipeline 节点保存为模板");
    return;
  }

  const pipelineNode = node as Node<
    PipelineNodeDataType,
    NodeTypeEnum.Pipeline
  >;
  saveNodeAsTemplate(pipelineNode.data.label, pipelineNode.data);
}

/**删除节点处理器 */
function handleDeleteNode(node: NodeContextMenuNode) {
  deleteNode(node.id);
}

/**复制 Reco JSON 处理器 */
function handleCopyRecoJSON(node: NodeContextMenuNode) {
  copyNodeRecoJSON(node.id);
}

/**设置节点端点位置处理器 */
function handleSetNodeDirection(
  node: NodeContextMenuNode,
  direction: HandleDirection,
) {
  const { nodes, setNodes, saveHistory } = useFlowStore.getState();
  const newNodes = nodes.map((n) => {
    if (n.id === node.id) {
      return {
        ...n,
        data: {
          ...n.data,
          handleDirection: direction === "left-right" ? undefined : direction,
        },
      };
    }
    return n;
  });
  setNodes(newNodes);
  saveHistory(0, {
    category: "node",
    action: "update",
    description: "设置端点位置",
    targetIds: [node.id],
  });
  message.success(
    `端点位置已设置为「${
      HANDLE_DIRECTION_OPTIONS.find((o) => o.value === direction)?.label
    }」`,
  );
}

/**获取当前节点的端点位置 */
function getNodeDirection(node: NodeContextMenuNode): HandleDirection {
  return (
    (node.data as NodeDataWithHandleDirection).handleDirection || "left-right"
  );
}

/**解散分组处理器 */
function handleUngroupNodes(node: NodeContextMenuNode) {
  useFlowStore.getState().ungroupNodes(node.id);
}

/**更改分组颜色处理器 */
function handleSetGroupColor(node: NodeContextMenuNode, color: string) {
  useFlowStore.getState().setNodeData(node.id, "direct", "color", color);
  useFlowStore.getState().saveHistory(0, {
    category: "group",
    action: "update",
    description: "更改分组颜色",
    targetIds: [node.id],
  });
}

/**更改便签颜色处理器 */
function handleSetStickerColor(
  node: NodeContextMenuNode,
  color: StickerColorTheme,
) {
  if (node.type !== NodeTypeEnum.Sticker) return;

  useFlowStore.getState().setNodeData(node.id, "sticker", "color", color);
  useFlowStore.getState().saveHistory(0, {
    category: "node",
    action: "update",
    description: "更改便签颜色",
    targetIds: [node.id],
  });
}

/**复制便签内容处理器 */
function handleCopyStickerContent(node: NodeContextMenuNode) {
  if (node.type !== NodeTypeEnum.Sticker) return;

  const content = (node.data as StickerNodeDataType).content;
  if (content) {
    navigator.clipboard.writeText(content);
    message.success("便签内容已复制到剪贴板");
  } else {
    message.info("便签内容为空");
  }
}

/**编辑 JSON 处理器 */
function handleEditNodeJson(node: NodeContextMenuNode) {
  // 触发全局事件
  const event = new CustomEvent("mpe:edit-node-json", {
    detail: { node },
  });
  window.dispatchEvent(event);
}

function handleDebugRunMode(node: NodeContextMenuNode, mode: DebugRunMode) {
  if (node.type !== NodeTypeEnum.Pipeline) return;
  if (isEmbedEnvironment()) {
    showEmbedServiceNotice("流程调试");
    return;
  }

  const target = getDebugNodeTarget(node.id);
  if (!target) {
    message.warning("请选择可调试的 Pipeline 节点");
    return;
  }
  applyDebugNodeTarget(target, {
    focusCanvas: true,
    rememberEntryNodeId: true,
  });
  useDebugModalMemoryStore.getState().setLastRunMode(mode);
  if (!requestDebugRun({ target, mode })) {
    message.error("FlowScope 调试服务尚未就绪，请稍后重试");
  }
}

function handleSetDebugEntry(node: NodeContextMenuNode) {
  if (node.type !== NodeTypeEnum.Pipeline) return;
  if (isEmbedEnvironment()) {
    showEmbedServiceNotice("流程调试");
    return;
  }

  applyDebugNodeTarget(getDebugNodeTarget(node.id), {
    focusCanvas: true,
    openPanel: "overview",
    rememberPanel: true,
    setEntry: true,
    successMessage: "已设为调试入口节点",
  });
}

function isDebugRunModeUnavailable(
  mode: DebugRunMode,
  capabilities?: DebugCapabilityManifest,
): boolean {
  return !capabilities?.runModes.includes(mode);
}

/**删除分组（先解散子节点再删除）处理器 */
function handleDeleteGroup(node: NodeContextMenuNode) {
  // 先解散子节点
  useFlowStore.getState().ungroupNodes(node.id);
}

/**获取节点右键菜单配置 */
export function getNodeContextMenuConfig(
  node: NodeContextMenuNode,
  options: { debugCapabilities?: DebugCapabilityManifest } = {},
): NodeContextMenuConfig[] {
  // Group 节点使用专用菜单
  if (node.type === NodeTypeEnum.Group) {
    const groupColors = [
      { key: "blue", label: "蓝色" },
      { key: "green", label: "绿色" },
      { key: "purple", label: "紫色" },
      { key: "orange", label: "橙色" },
      { key: "gray", label: "灰色" },
    ];
    return [
      {
        key: "group-color",
        label: "分组颜色",
        icon: "icon-tiaoseban",
        iconSize: 16,
        children: groupColors.map((c) => ({
          key: `group-color-${c.key}`,
          label: c.label,
          onClick: (node) => handleSetGroupColor(node, c.key),
          checked: (node) => (node.data as NodeDataWithColor).color === c.key,
        })),
      },
      {
        type: "divider",
        key: "divider-group-1",
      },
      {
        key: "ungroup",
        label: "解散分组",
        icon: "icon-quxiaoguanlian",
        iconSize: 16,
        onClick: handleUngroupNodes,
      },
      {
        key: "delete-group",
        label: "删除分组",
        icon: "icon-shanchu",
        iconSize: 16,
        onClick: handleDeleteGroup,
        danger: true,
      },
    ];
  }

  const config: NodeContextMenuConfig[] = [
    {
      key: "debug-set-entry",
      label: "设为入口节点",
      icon: <FlagOutlined />,
      onClick: handleSetDebugEntry,
      visible: (node) => node.type === NodeTypeEnum.Pipeline,
    },
    {
      key: "debug-run-from-node",
      label: "从此节点运行",
      icon: <PlayCircleOutlined />,
      onClick: (node) => handleDebugRunMode(node, "run-from-node"),
      visible: (node) => node.type === NodeTypeEnum.Pipeline,
      disabled: () =>
        isDebugRunModeUnavailable(
          "run-from-node",
          options.debugCapabilities,
        ),
      disabledTip: "当前 LocalBridge 未暴露 run-from-node 能力",
    },
    {
      key: "debug-single-node-run",
      label: "单节点运行",
      icon: <PlayCircleOutlined />,
      onClick: (node) => handleDebugRunMode(node, "single-node-run"),
      visible: (node) => node.type === NodeTypeEnum.Pipeline,
      disabled: () =>
        isDebugRunModeUnavailable(
          "single-node-run",
          options.debugCapabilities,
        ),
      disabledTip: "当前 LocalBridge 未暴露 single-node-run 能力",
    },
    {
      key: "debug-recognition-only",
      label: "仅识别",
      icon: <PlayCircleOutlined />,
      onClick: (node) => handleDebugRunMode(node, "recognition-only"),
      visible: (node) => node.type === NodeTypeEnum.Pipeline,
      disabled: () =>
        isDebugRunModeUnavailable(
          "recognition-only",
          options.debugCapabilities,
        ),
      disabledTip: "当前 LocalBridge 未暴露 recognition-only 能力",
    },
    {
      key: "debug-action-only",
      label: "仅动作",
      icon: <PlayCircleOutlined />,
      onClick: (node) => handleDebugRunMode(node, "action-only"),
      visible: (node) => node.type === NodeTypeEnum.Pipeline,
      disabled: () =>
        isDebugRunModeUnavailable("action-only", options.debugCapabilities),
      disabledTip: "当前 LocalBridge 未暴露 action-only 能力",
      danger: true,
    },
    {
      type: "divider",
      key: "divider-debug",
    },
    // 复制节点名
    {
      key: "copy-node-name",
      label: "复制节点名",
      icon: "icon-a-copyfubenfuzhi",
      iconSize: 16,
      onClick: handleCopyNodeName,
    },
    // 编辑 JSON (所有节点)
    {
      key: "edit-json",
      label: "编辑 JSON",
      icon: "icon-JSON",
      iconSize: 16,
      onClick: handleEditNodeJson,
    },
    // 复制便签内容 (仅 Sticker 节点)
    {
      key: "copy-sticker-content",
      label: "复制便签内容",
      icon: "icon-fuzhi",
      iconSize: 16,
      onClick: handleCopyStickerContent,
      visible: (node) => node.type === NodeTypeEnum.Sticker,
    },
    // 复制 Reco JSON (仅 Pipeline 节点)
    {
      key: "copy-reco-json",
      label: "复制 Reco JSON",
      icon: "icon-kapianshibie",
      iconSize: 18,
      onClick: handleCopyRecoJSON,
      visible: (node) => node.type === NodeTypeEnum.Pipeline,
    },
    // 保存为模板 (仅 Pipeline 节点)
    {
      key: "save-as-template",
      label: "保存为模板",
      icon: "icon-biaodanmoban",
      iconSize: 16,
      onClick: handleSaveAsTemplate,
      visible: (node) => node.type === NodeTypeEnum.Pipeline,
    },
    // 便签颜色子菜单 (仅 Sticker 节点)
    {
      key: "sticker-color",
      label: "便签颜色",
      icon: "icon-tiaoseban",
      iconSize: 16,
      visible: (node) => node.type === NodeTypeEnum.Sticker,
      children: [
        {
          key: "color-yellow",
          label: "黄色",
          onClick: (node) => handleSetStickerColor(node, "yellow"),
          checked: (node) =>
            (node.data as StickerNodeDataType).color === "yellow",
        },
        {
          key: "color-green",
          label: "绿色",
          onClick: (node) => handleSetStickerColor(node, "green"),
          checked: (node) =>
            (node.data as StickerNodeDataType).color === "green",
        },
        {
          key: "color-blue",
          label: "蓝色",
          onClick: (node) => handleSetStickerColor(node, "blue"),
          checked: (node) =>
            (node.data as StickerNodeDataType).color === "blue",
        },
        {
          key: "color-pink",
          label: "粉色",
          onClick: (node) => handleSetStickerColor(node, "pink"),
          checked: (node) =>
            (node.data as StickerNodeDataType).color === "pink",
        },
        {
          key: "color-purple",
          label: "紫色",
          onClick: (node) => handleSetStickerColor(node, "purple"),
          checked: (node) =>
            (node.data as StickerNodeDataType).color === "purple",
        },
      ],
    },
    // 端点位置子菜单 (除 Sticker 和 Group 节点外)
    {
      key: "node-direction",
      label: "端点位置",
      icon: "icon-lianjie",
      iconSize: 16,
      visible: (node) =>
        node.type !== NodeTypeEnum.Sticker && node.type !== NodeTypeEnum.Group,
      children: HANDLE_DIRECTION_OPTIONS.map((option) => ({
        key: `direction-${option.value}`,
        label: option.label,
        onClick: (node) => handleSetNodeDirection(node, option.value),
        checked: (node) => getNodeDirection(node) === option.value,
      })),
    },
  ];

  config.push(
    // 分隔线
    {
      type: "divider",
      key: "divider-1",
    },
    // 删除
    {
      key: "delete-node",
      label: "删除",
      icon: "icon-shanchu",
      iconSize: 16,
      onClick: handleDeleteNode,
      danger: true,
    },
  );

  return config;
}
