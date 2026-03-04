/**
 * 节点列表类型定义
 */

import { NodeTypeEnum } from "../../../flow/nodes/constants";

/**
 * 节点列表项信息
 */
export interface NodeListItemInfo {
  /** 节点 ID */
  id: string;
  /** 节点标签 */
  label: string;
  /** 节点类型 */
  nodeType: NodeTypeEnum;
  /** 识别类型（仅 Pipeline 节点） */
  recognitionType?: string;
  /** 动作类型（仅 Pipeline 节点） */
  actionType?: string;
  /** 识别参数（仅 Pipeline 节点） */
  recognitionParam?: Record<string, any>;
  /** 动作参数（仅 Pipeline 节点） */
  actionParam?: Record<string, any>;
  /** 其他参数（仅 Pipeline 节点） */
  others?: Record<string, any>;
  /** 模板图片路径列表 */
  templatePaths?: string[];
  /** 入边数量 */
  inEdgeCount: number;
  /** 出边数量 */
  outEdgeCount: number;
}

/**
 * 节点分组类型
 */
export interface NodeGroup {
  /** 分组类型 */
  type: NodeTypeEnum;
  /** 分组名称 */
  name: string;
  /** 分组图标 */
  icon: string;
  /** 节点列表 */
  nodes: NodeListItemInfo[];
  /** 节点数量 */
  count: number;
}

/**
 * 节点类型配置
 */
export const NODE_TYPE_CONFIG: Record<
  NodeTypeEnum,
  { name: string; icon: string }
> = {
  [NodeTypeEnum.Pipeline]: { name: "Pipeline", icon: "📁" },
  [NodeTypeEnum.External]: { name: "External", icon: "📁" },
  [NodeTypeEnum.Anchor]: { name: "Anchor", icon: "📁" },
  [NodeTypeEnum.Sticker]: { name: "Sticker", icon: "📁" },
  [NodeTypeEnum.Group]: { name: "Group", icon: "📁" },
};
