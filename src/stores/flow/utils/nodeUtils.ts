import type {
  NodeType,
  PipelineNodeType,
  ExternalNodeType,
  AnchorNodeType,
  StickerNodeType,
  StickerColorTheme,
  GroupNodeType,
  GroupColorTheme,
  PositionType,
} from "../types";
import { NodeTypeEnum } from "../../../components/flow/nodes";

// 创建 Pipeline 节点
export function createPipelineNode(
  id: string,
  options?: {
    label?: string;
    position?: PositionType;
    select?: boolean;
    datas?: any;
  }
): PipelineNodeType {
  const {
    label = id,
    position = { x: 0, y: 0 },
    select = false,
    datas = {},
  } = options ?? {};

  // 自动生成 label
  const { label: _removedLabel, ...templateData } = datas;

  const node: PipelineNodeType = {
    id,
    type: NodeTypeEnum.Pipeline,
    data: {
      label,
      recognition: {
        type: "DirectHit",
        param: {},
      },
      action: {
        type: "DoNothing",
        param: {},
      },
      others: {},
      extras: {},
      ...templateData,
    },
    position,
    selected: select,
  };
  return node;
}

// 创建 External 节点
export function createExternalNode(
  id: string,
  options?: {
    label?: string;
    position?: PositionType;
    select?: boolean;
    datas?: any;
  }
): ExternalNodeType {
  const {
    label = id,
    position = { x: 0, y: 0 },
    select = false,
    datas = {},
  } = options ?? {};

  // 自动生成 label
  const { label: _removedLabel, ...templateData } = datas;

  const node: ExternalNodeType = {
    id,
    type: NodeTypeEnum.External,
    data: { label, ...templateData },
    position,
    selected: select,
  };
  return node;
}

// 创建 Anchor 重定向节点
export function createAnchorNode(
  id: string,
  options?: {
    label?: string;
    position?: PositionType;
    select?: boolean;
    datas?: any;
  }
): AnchorNodeType {
  const {
    label = id,
    position = { x: 0, y: 0 },
    select = false,
    datas = {},
  } = options ?? {};

  // 自动生成 label
  const { label: _removedLabel, ...templateData } = datas;

  const node: AnchorNodeType = {
    id,
    type: NodeTypeEnum.Anchor,
    data: { label, ...templateData },
    position,
    selected: select,
  };
  return node;
}

// 创建 Sticker 便签节点
export function createStickerNode(
  id: string,
  options?: {
    label?: string;
    position?: PositionType;
    select?: boolean;
    datas?: {
      content?: string;
      color?: StickerColorTheme;
    };
  }
): StickerNodeType {
  const {
    label = "便签",
    position = { x: 0, y: 0 },
    select = false,
    datas = {},
  } = options ?? {};

  const node: StickerNodeType = {
    id,
    type: NodeTypeEnum.Sticker,
    data: {
      label,
      content: datas.content ?? "",
      color: datas.color ?? "yellow",
    },
    position,
    selected: select,
    style: { width: 200, height: 160 },
  };
  return node;
}

// 查找节点
export function findNodeById(
  nodes: NodeType[],
  id: string
): NodeType | undefined {
  return nodes.find((node) => node.id === id);
}

export function findNodeIndexById(nodes: NodeType[], id: string): number {
  return nodes.findIndex((node) => node.id === id);
}

export function findNodeLabelById(
  nodes: NodeType[],
  id: string
): string | undefined {
  const node = findNodeById(nodes, id);
  return node?.data?.label;
}

export function findNodeByLabel(
  nodes: NodeType[],
  label: string
): NodeType | undefined {
  return nodes.find((node) => node.data.label === label);
}

// 筛选选中的节点
export function getSelectedNodes(nodes: NodeType[]): NodeType[] {
  return nodes.filter((node) => node.selected);
}

// 计算新节点位置
export function calcuNodePosition(
  selectedNodes: NodeType[],
  viewport: { x: number; y: number; zoom: number },
  size: { width: number; height: number }
): PositionType {
  // 有选中节点
  if (selectedNodes.length > 0) {
    let rightestPosition = { x: -Infinity, y: -Infinity };
    selectedNodes.forEach((node) => {
      if ((node as PipelineNodeType).position.x > rightestPosition.x) {
        rightestPosition = (node as PipelineNodeType).position;
      }
    });
    return {
      x: rightestPosition.x + 260,
      y: rightestPosition.y,
    };
  }
  // 无选中节点
  else {
    return {
      x: -((viewport.x - size.width) / viewport.zoom + 260),
      y: -((viewport.y - size.height / 2) / viewport.zoom + 80),
    };
  }
}

// 节点名查重
export function checkRepeatNodeLabelList(
  nodes: NodeType[],
  config: { isExportConfig: boolean; prefix: string }
): string[] {
  const repates: string[] = [];
  const isAddPrefix = config.isExportConfig && config.prefix;
  let prefix = config.prefix;
  if (isAddPrefix) prefix += "_";

  // 查重
  const counter: Record<string, number> = {};
  for (const node of nodes) {
    // 跳过便签节点和分组节点
    if (node.type === NodeTypeEnum.Sticker || node.type === NodeTypeEnum.Group)
      continue;
    let label = node.data.label;
    if (isAddPrefix && node.type === NodeTypeEnum.Pipeline) {
      label = prefix + label;
    }
    counter[label] = (counter[label] ?? 0) + 1;
    if (counter[label] === 2) {
      repates.push(label);
    }
  }

  return repates;
}

// 创建 Group 分组节点
export function createGroupNode(
  id: string,
  options?: {
    label?: string;
    position?: PositionType;
    select?: boolean;
    datas?: {
      color?: GroupColorTheme;
    };
    style?: Record<string, any>;
  }
): GroupNodeType {
  const {
    label = "分组",
    position = { x: 0, y: 0 },
    select = false,
    datas = {},
    style,
  } = options ?? {};

  const node: GroupNodeType = {
    id,
    type: NodeTypeEnum.Group,
    data: {
      label,
      color: datas.color ?? "blue",
    },
    position,
    selected: select,
    style: style ?? { width: 400, height: 300 },
  };
  return node;
}

/**
 * 确保 Group 节点在其子节点之前出现在数组中
 * React Flow 要求 parent 节点排在 children 之前
 */
export function ensureGroupNodeOrder(nodes: NodeType[]): NodeType[] {
  const groupNodes: NodeType[] = [];
  const otherNodes: NodeType[] = [];

  for (const node of nodes) {
    if (node.type === NodeTypeEnum.Group) {
      groupNodes.push(node);
    } else {
      otherNodes.push(node);
    }
  }

  return [...groupNodes, ...otherNodes];
}
