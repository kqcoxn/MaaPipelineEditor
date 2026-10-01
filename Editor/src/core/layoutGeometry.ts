import type { NodeType } from "../stores/flow/types";
import { NodeTypeEnum } from "../components/flow/nodes/constants";
import { getNodeAbsoluteRect, resolveParentChain } from "../stores/flow/utils/coordinateUtils";

export const GROUP_PADDING = 40;
export const GROUP_HEADER = 36;
export const MIXED_SCOPE_MESSAGE = "请选择同一分组内的节点，或选择分组框进行整体操作";
export const parentId = (node: NodeType) => (node as NodeType & { parentId?: string }).parentId;
export const isGroup = (node: NodeType) => node.type === NodeTypeEnum.Group;
export const dimensions = (node: NodeType) => {
  const rect = getNodeAbsoluteRect(node, []);
  return {
    ...rect,
    width: Number.isFinite(rect.width) && rect.width > 0 ? rect.width : 200,
    height: Number.isFinite(rect.height) && rect.height > 0 ? rect.height : 100,
  };
};

/** 去掉已选祖先的后代，避免父子重复移动。所有返回值均来自最新快照。 */
export function layoutRoots(nodes: NodeType[], ids?: string[]): NodeType[] {
  if (!ids) return nodes.filter((node) => !parentId(node));
  const selected = new Set(ids);
  const lookup = new Map(nodes.map((node) => [node.id, node]));
  return nodes.filter((node) => selected.has(node.id) &&
    !resolveParentChain(node, lookup).some((parent) => selected.has(parent.id)));
}

export function requireSameParent(nodes: NodeType[]) {
  if (new Set(nodes.map(parentId)).size > 1) throw new Error(MIXED_SCOPE_MESSAGE);
}

/** 包住直属内容；调整左上边界时补偿子节点坐标，保持其绝对位置。 */
export function fitGroup(nodes: NodeType[], id: string, shrink = false): NodeType[] {
  const group = nodes.find((node) => node.id === id && isGroup(node));
  if (!group) return nodes;
  const children = nodes.filter((node) => parentId(node) === id);
  const old = dimensions(group);
  const minX = children.length ? Math.min(...children.map((node) => node.position.x)) - GROUP_PADDING : 0;
  const minY = children.length ? Math.min(...children.map((node) => node.position.y)) - GROUP_PADDING - GROUP_HEADER : 0;
  const left = shrink ? minX : Math.min(0, minX);
  const top = shrink ? minY : Math.min(0, minY);
  const right = (children.length ? Math.max(...children.map((node) => node.position.x + dimensions(node).width + GROUP_PADDING)) : 0);
  const bottom = (children.length ? Math.max(...children.map((node) => node.position.y + dimensions(node).height + GROUP_PADDING)) : 0);
  const width = Math.max(200, (shrink ? right : Math.max(old.width, right)) - left);
  const height = Math.max(150, (shrink ? bottom : Math.max(old.height, bottom)) - top);
  return nodes.map((node) => {
    if (node.id === id) return {
      ...node,
      position: { x: node.position.x + left, y: node.position.y + top },
      style: { ...("style" in node ? node.style : {}), width, height },
      // 后续外层布局必须立即读到新尺寸，无需等待 DOM 再测量。
      measured: { width, height },
      width, height,
    };
    if (parentId(node) === id && (left || top)) return {
      ...node, position: { x: node.position.x - left, y: node.position.y - top },
    };
    return node;
  });
}

export function growAncestors(nodes: NodeType[], changedIds: string[]): NodeType[] {
  const lookup = new Map(nodes.map((node) => [node.id, node]));
  const ancestors = new Map<string, number>();
  for (const id of changedIds) {
    const node = lookup.get(id);
    if (node) resolveParentChain(node, lookup).forEach((parent, depth) => ancestors.set(parent.id, depth));
  }
  for (const [id] of [...ancestors].sort((a, b) => b[1] - a[1])) nodes = fitGroup(nodes, id);
  return nodes;
}

export function shiftLayoutNodes(nodes: NodeType[], direction: "horizontal" | "vertical", delta: number, ids?: string[]): NodeType[] {
  const targets = layoutRoots(nodes, ids);
  requireSameParent(targets);
  if (targets.length < 2) return nodes;
  const axis = direction === "horizontal" ? "x" : "y";
  const min = Math.min(...targets.map((node) => node.position[axis]));
  const selected = new Set(targets.map((node) => node.id));
  const result = nodes.map((node) => selected.has(node.id) ? {
    ...node, position: { ...node.position, [axis]: node.position[axis] + (node.position[axis] - min) * delta / 100 },
  } : node);
  return growAncestors(result, [...selected]);
}
