import { message } from "antd";
import type { ReactNode } from "react";
import type { Node } from "@xyflow/react";
import { NodeTypeEnum } from "./constants";
import type {
  PipelineNodeDataType,
  ExternalNodeDataType,
  AnchorNodeDataType,
} from "../../../stores/flow";
import {
  copyNodeName,
  saveNodeAsTemplate,
  deleteNode,
} from "./utils/nodeOperations";

/**菜单项类型 */
export interface NodeContextMenuItem {
  key: string;
  label: string;
  icon: ReactNode | string;
  onClick: (node: NodeContextMenuNode) => void;
  disabled?: boolean | ((node: NodeContextMenuNode) => boolean);
  disabledTip?: string;
  visible?: (node: NodeContextMenuNode) => boolean;
  danger?: boolean;
}

/**分隔线类型 */
export interface NodeContextMenuDivider {
  type: "divider";
  key: string;
}

/**菜单配置项联合类型 */
export type NodeContextMenuConfig =
  | NodeContextMenuItem
  | NodeContextMenuDivider;

/**节点类型联合 */
export type NodeContextMenuNode =
  | Node<PipelineNodeDataType, NodeTypeEnum.Pipeline>
  | Node<ExternalNodeDataType, NodeTypeEnum.External>
  | Node<AnchorNodeDataType, NodeTypeEnum.Anchor>;

/**复制节点名处理器 */
function handleCopyNodeName(node: NodeContextMenuNode) {
  copyNodeName(node.data.label);
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

/**获取节点右键菜单配置 */
export function getNodeContextMenuConfig(
  node: NodeContextMenuNode
): NodeContextMenuConfig[] {
  const config: NodeContextMenuConfig[] = [
    // 复制节点名
    {
      key: "copy-node-name",
      label: "复制节点名",
      icon: "icon-a-copyfubenfuzhi",
      onClick: handleCopyNodeName,
    },
    // 保存为模板
    {
      key: "save-as-template",
      label: "保存为模板",
      icon: "icon-biaodanmoban",
      onClick: handleSaveAsTemplate,
      visible: (node) => node.type === NodeTypeEnum.Pipeline,
    },
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
      onClick: handleDeleteNode,
      danger: true,
    },
  ];

  return config;
}
