import type { EdgeType, NodeType } from "@/stores/flow/types";
import { NodeTypeEnum, SourceHandleTypeEnum } from "@/components/flow/nodes/constants";
import { useAchievementStore } from "@/stores/achievement/achievementStore";
import { emitAchievementEvent } from "./bus";
import { createPathSearchQueue, findLongPath, type Adjacency, type PathSearch } from "./longPath";

export interface ManualConnectionGraph {
  nodes: NodeType[];
  edges: EdgeType[];
  beforeEdges: EdgeType[];
}


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

function recordManualConnection({ nodes, edges, beforeEdges }: ManualConnectionGraph, search: (job: PathSearch) => void) {
  const unlocked = useAchievementStore.getState().unlocked;
  if (["connection_chain", "connection_many_paths", "connection_merge", "connection_cycle", "connection_error_chain"].every((id) => unlocked[id])) return;
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
      if (!unlocked.connection_cycle && edge.source !== edge.target && reachable(edge.target, next).has(edge.source)) award("connection_cycle");
      if (!unlocked.connection_chain) search(findLongPath(edge.source, edge.target, next, previous));
    } else if (edge.sourceHandle === SourceHandleTypeEnum.Error) {
      // 本次连接可以是两层 on_error 中的任意一层。
      if (errorEdges.some((other) => other.id !== edge.id && (other.source === edge.target || other.target === edge.source))) {
        award("connection_error_chain");
      }
    }
  }
}

/**搜索任务属于本次成就监听生命周期，卸载时释放快照和计时器。 */
export function createManualConnectionTracker() {
  const queue = createPathSearchQueue(
    () => emitAchievementEvent("achievement:connection_chain"),
    () => !!useAchievementStore.getState().unlocked.connection_chain,
  );
  return {
    record: (graph: ManualConnectionGraph) => recordManualConnection(graph, queue.add),
    dispose: queue.dispose,
  };
}
