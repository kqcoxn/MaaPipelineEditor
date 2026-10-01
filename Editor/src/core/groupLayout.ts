import ELK from "elkjs/lib/elk.bundled.js";
import type { EdgeType, NodeType } from "../stores/flow/types";
import { dimensions, fitGroup, GROUP_HEADER, GROUP_PADDING, growAncestors, isGroup, layoutRoots, parentId, requireSameParent } from "./layoutGeometry";

const elk = new ELK();
const options = {
  "elk.algorithm": "layered",
  "elk.direction": "RIGHT",
  "elk.layered.spacing.nodeNodeBetweenLayers": "100",
  "elk.spacing.nodeNode": "80",
  "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
  "elk.layered.crossingMinimization.semiInteractiveCrossingMinimization": "true",
  "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
  "elk.layered.cycleBreaking.strategy": "GREEDY",
  "elk.compaction.postCompaction.strategy": "LEFT_RIGHT_CONSTRAINT_LOCKING",
  "elk.layered.selfLoopPlacement": "NORTH",
};

/** 仅供布局使用的连线投影，不更改业务连线端点。 */
export function projectLayoutEdges(nodes: NodeType[], edges: EdgeType[], roots: NodeType[]) {
  const lookup = new Map(nodes.map((node) => [node.id, node]));
  const ids = new Set(roots.map((node) => node.id));
  const owner = (id: string): string | undefined => {
    const visited = new Set<string>();
    while (!visited.has(id)) {
      if (ids.has(id)) return id;
      visited.add(id);
      const node = lookup.get(id);
      const parent = node && parentId(node);
      if (!parent) return;
      id = parent;
    }
  };
  const seen = new Set<string>();
  return edges.flatMap((edge) => {
    const source = owner(edge.source);
    const target = owner(edge.target);
    const key = JSON.stringify([source, target]);
    if (!source || !target || source === target || seen.has(key)) return [];
    seen.add(key);
    return [{ id: edge.id, sources: [source], targets: [target] }];
  });
}

export interface LayoutRequest { ids?: string[] }

export async function layoutGraph(original: NodeType[], edges: EdgeType[], request: LayoutRequest = {}): Promise<NodeType[]> {
  let nodes = original;
  const roots = layoutRoots(nodes, request.ids);
  requireSameParent(roots);
  if (!roots.length) return nodes;
  if (request.ids && roots.length === 1 && !isGroup(roots[0])) return nodes;

  const arrange = async (ids: string[], insideGroup?: string) => {
    const selected = new Set(ids);
    const targets = nodes.filter((node) => selected.has(node.id));
    if (!targets.length) return;
    const scope = parentId(targets[0]);
    const result = await elk.layout({
      id: "root", layoutOptions: options,
      children: targets.map((node) => ({ id: node.id, width: dimensions(node).width, height: dimensions(node).height })),
      edges: projectLayoutEdges(nodes, edges, targets),
    });
    const children = result.children ?? [];
    if (!children.length) return;
    const minX = Math.min(...children.map((node) => node.x ?? 0));
    const minY = Math.min(...children.map((node) => node.y ?? 0));
    const originX = insideGroup ? GROUP_PADDING : Math.max(scope ? GROUP_PADDING : -Infinity, Math.min(...targets.map((node) => node.position.x)));
    let originY = insideGroup ? GROUP_PADDING + GROUP_HEADER : Math.max(scope ? GROUP_PADDING + GROUP_HEADER : -Infinity, Math.min(...targets.map((node) => node.position.y)));

    // 局部结果作为整体避让未选中的同层节点，不移动未选节点。
    const obstacles = nodes.filter((node) => parentId(node) === scope && !selected.has(node.id));
    const width = Math.max(...children.map((node) => (node.x ?? 0) + (node.width ?? 0))) - minX;
    const height = Math.max(...children.map((node) => (node.y ?? 0) + (node.height ?? 0))) - minY;
    for (let i = 0; i <= obstacles.length; i++) {
      const collisions = obstacles.filter((node) => {
        const size = dimensions(node);
        return originX < node.position.x + size.width + 40 && originX + width + 40 > node.position.x &&
          originY < node.position.y + size.height + 40 && originY + height + 40 > node.position.y;
      });
      if (!collisions.length) break;
      originY = Math.max(...collisions.map((node) => node.position.y + dimensions(node).height + 40));
    }
    const positions = new Map(children.map((node) => [node.id, { x: (node.x ?? 0) - minX + originX, y: (node.y ?? 0) - minY + originY }]));
    nodes = nodes.map((node) => positions.has(node.id) ? { ...node, position: positions.get(node.id)! } : node);
    if (insideGroup) nodes = fitGroup(nodes, insideGroup);
    nodes = growAncestors(nodes, ids);
  };

  const visit = async (node: NodeType, visiting = new Set<string>()) => {
    if (!isGroup(node)) return;
    if (visiting.has(node.id)) throw new Error("分组层级存在循环，无法自动布局");
    const next = new Set(visiting).add(node.id);
    const children = nodes.filter((child) => parentId(child) === node.id);
    for (const child of children) await visit(child, next);
    await arrange(children.map((child) => child.id), node.id);
  };
  for (const root of roots) await visit(root);
  // 单组选中时仅重排组内，保留该分组在外层的位置。
  if (!(request.ids && roots.length === 1 && isGroup(roots[0]))) {
    await arrange(roots.map((node) => node.id));
  }
  return nodes;
}
