import type { EdgeType, NodeType } from "@/stores/flow/types";
import { NodeTypeEnum, SourceHandleTypeEnum } from "@/components/flow/nodes/constants";
import { useAchievementStore } from "@/stores/achievement/achievementStore";
import { emitAchievementEvent } from "./bus";

export interface ManualConnectionGraph {
  nodes: NodeType[];
  edges: EdgeType[];
  beforeEdges: EdgeType[];
}

type Adjacency = Map<string, Set<string>>;

function adjacency(edges: EdgeType[], reverse = false): Adjacency {
  const result: Adjacency = new Map();
  for (const edge of edges) {
    const source = reverse ? edge.target : edge.source;
    const target = reverse ? edge.source : edge.target;
    if (!result.has(source)) result.set(source, new Set());
    result.get(source)!.add(target);
  }
  return result;
}

function reachable(start: string, graph: Adjacency): Set<string> {
  const seen = new Set([start]);
  const pending = [start];
  while (pending.length) {
    for (const target of graph.get(pending.pop()!) ?? []) {
      if (seen.has(target)) continue;
      seen.add(target);
      pending.push(target);
    }
  }
  return seen;
}

/**只搜索经过本次连接的简单路径；环路中的同一节点不能重复凑数。 */
function hasLongPath(edge: EdgeType, next: Adjacency, previous: Adjacency): boolean {
  if (edge.source === edge.target) return false;
  const candidates = new Set([...reachable(edge.source, previous), ...reachable(edge.target, next)]);
  if (candidates.size < 21) return false;
  const visited = new Set([edge.source, edge.target]);
  function forward(node: string): boolean {
    if (visited.size >= 21) return true;
    for (const target of next.get(node) ?? []) {
      if (visited.has(target)) continue;
      visited.add(target);
      const found = forward(target);
      visited.delete(target);
      if (found) return true;
    }
    return false;
  }
  function backward(node: string): boolean {
    if (forward(edge.target)) return true;
    for (const source of previous.get(node) ?? []) {
      if (visited.has(source)) continue;
      visited.add(source);
      const found = backward(source);
      visited.delete(source);
      if (found) return true;
    }
    return false;
  }
  return backward(edge.source);
}

export function recordManualConnection({ nodes, edges, beforeEdges }: ManualConnectionGraph) {
  const pipelineIds = new Set(nodes.filter((node) => node.type === NodeTypeEnum.Pipeline).map((node) => node.id));
  const validEdges = edges.filter((edge) => pipelineIds.has(edge.source) && pipelineIds.has(edge.target));
  const previousIds = new Set(beforeEdges.map((edge) => edge.id));
  const added = validEdges.filter((edge) => !previousIds.has(edge.id));
  if (!added.length) return;
  const nextEdges = validEdges.filter((edge) => edge.sourceHandle === SourceHandleTypeEnum.Next);
  const next = adjacency(nextEdges);
  const previous = adjacency(nextEdges, true);
  const errorEdges = validEdges.filter((edge) => edge.sourceHandle === SourceHandleTypeEnum.Error);
  const award = (id: string) => emitAchievementEvent(`achievement:${id}`);
  for (const edge of added) {
    if (edge.sourceHandle === SourceHandleTypeEnum.Next) {
      if ((next.get(edge.source)?.size ?? 0) > 5) award("connection_many_paths");
      if ((previous.get(edge.target)?.size ?? 0) >= 3) award("connection_merge");
      if (edge.source !== edge.target && reachable(edge.target, next).has(edge.source)) award("connection_cycle");
      if (!useAchievementStore.getState().unlocked.connection_chain && hasLongPath(edge, next, previous)) award("connection_chain");
    } else if (edge.sourceHandle === SourceHandleTypeEnum.Error) {
      // 本次连接可以是两层 on_error 中的任意一层。
      if (errorEdges.some((other) => other.id !== edge.id && (other.source === edge.target || other.target === edge.source))) {
        award("connection_error_chain");
      }
    }
  }
}
