import { message } from "antd";
import type { ReactNode } from "react";
import type { Node } from "@xyflow/react";
import { NodeTypeEnum, HANDLE_DIRECTION_OPTIONS } from "./constants";
import type { HandleDirection } from "./constants";
import type {
  PipelineNodeDataType,
  ExternalNodeDataType,
  AnchorNodeDataType,
} from "../../../stores/flow";
import { useFlowStore } from "../../../stores/flow";
import {
  copyNodeName,
  saveNodeAsTemplate,
  deleteNode,
  copyNodeRecoJSON,
} from "./utils/nodeOperations";
import { useDebugStore } from "../../../stores/debugStore";

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
  | Node<AnchorNodeDataType, NodeTypeEnum.Anchor>;

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

/**切换断点处理器 */
function handleToggleBreakpoint(node: NodeContextMenuNode) {
  const { toggleBreakpoint, breakpoints } = useDebugStore.getState();
  const hasBreakpoint = breakpoints.has(node.id);

  toggleBreakpoint(node.id);

  message.success(hasBreakpoint ? "断点已移除" : "断点已设置");
}

/**设为调试开始节点处理器 */
function handleSetDebugEntry(node: NodeContextMenuNode) {
  const { setConfig } = useDebugStore.getState();
  // 使用 node.id 而非 label，这样才能与 DebugPanel 中的选择器匹配
  setConfig("entryNode", node.id);
  message.success(`已将 "${node.data.label}" 设为调试开始节点`);
}

/**复制 Reco JSON 处理器 */
function handleCopyRecoJSON(node: NodeContextMenuNode) {
  copyNodeRecoJSON(node.id);
}

/**设置节点端点位置处理器 */
function handleSetNodeDirection(
  node: NodeContextMenuNode,
  direction: HandleDirection
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
  saveHistory(0);
  message.success(
    `端点位置已设置为「${
      HANDLE_DIRECTION_OPTIONS.find((o) => o.value === direction)?.label
    }」`
  );
}

/**获取当前节点的端点位置 */
function getNodeDirection(node: NodeContextMenuNode): HandleDirection {
  return (node.data as any).handleDirection || "left-right";
}

/**获取节点右键菜单配置 */
export function getNodeContextMenuConfig(
  node: NodeContextMenuNode
): NodeContextMenuConfig[] {
  const { debugMode, breakpoints } = useDebugStore.getState();
  const hasBreakpoint = breakpoints.has(node.id);

  const config: NodeContextMenuConfig[] = [
    // 复制节点名
    {
      key: "copy-node-name",
      label: "复制节点名",
      icon: "icon-a-copyfubenfuzhi",
      iconSize: 16,
      onClick: handleCopyNodeName,
    },
    // 复制 Reco JSON
    {
      key: "copy-reco-json",
      label: "复制 Reco JSON",
      icon: "icon-kapianshibie",
      iconSize: 18,
      onClick: handleCopyRecoJSON,
      visible: (node) => node.type === NodeTypeEnum.Pipeline,
    },
    // 保存为模板
    {
      key: "save-as-template",
      label: "保存为模板",
      icon: "icon-biaodanmoban",
      iconSize: 16,
      onClick: handleSaveAsTemplate,
      visible: (node) => node.type === NodeTypeEnum.Pipeline,
    },
    // 端点位置子菜单
    {
      key: "node-direction",
      label: "端点位置",
      icon: "icon-lianjie",
      iconSize: 16,
      children: HANDLE_DIRECTION_OPTIONS.map((option) => ({
        key: `direction-${option.value}`,
        label: option.label,
        onClick: (node) => handleSetNodeDirection(node, option.value),
        checked: (node) => getNodeDirection(node) === option.value,
      })),
    },
  ];

  // 调试模式下添加断点选项
  if (debugMode) {
    config.push(
      {
        type: "divider",
        key: "divider-debug",
      },
      {
        key: "set-debug-entry",
        label: "设为调试开始节点",
        icon: "icon-tiaoshibeifen",
        iconSize: 16,
        onClick: handleSetDebugEntry,
      },
      {
        key: "toggle-breakpoint",
        label: hasBreakpoint ? "移除断点" : "设置断点",
        icon: "icon-duandian",
        iconSize: 16,
        onClick: handleToggleBreakpoint,
      }
    );
  }

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
    }
  );

  return config;
}
