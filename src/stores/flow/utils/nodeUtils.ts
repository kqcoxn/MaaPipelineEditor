import type {
  NodeType,
  PipelineNodeType,
  ExternalNodeType,
  AnchorNodeType,
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
