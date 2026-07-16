import type { NodeType, EdgeType } from "./types";
import { NodeTypeEnum } from "../../components/flow/nodes";
import { getNodeAbsolutePosition } from "../../stores/flow/utils/coordinateUtils";

/**
 * 视觉副本就近匹配
 *
 * 同 label 的 External / Anchor 节点视为同一逻辑目标的视觉副本。
 * 导入阶段的 linkEdge 仅按 label 找到首个匹配作为目标，导致后续副本上没有任何边相连。
 * 本函数遍历每条以 External / Anchor 为 target 的边，按 source 与各副本的欧氏距离，
 * 改写 target 为最近的副本 id。
 *
 * 局限：用户故意"放歪"副本（让一条边走远路）会被错位。属于已知限制。
 */
export function rerouteEdgesToNearestReplica(
  nodes: NodeType[],
  edges: EdgeType[],
): EdgeType[] {
  // 按 (type, label) 分桶收集副本
  const replicaBuckets = new Map<string, NodeType[]>();
  for (const node of nodes) {
    if (
      node.type !== NodeTypeEnum.External &&
      node.type !== NodeTypeEnum.Anchor
    ) {
      continue;
    }
    const key = `${node.type}::${node.data.label}`;
    let bucket = replicaBuckets.get(key);
    if (!bucket) {
      bucket = [];
      replicaBuckets.set(key, bucket);
    }
    bucket.push(node);
  }

  // 没有任何副本（每个 label 仅 1 个）→ 直接返回
  let hasReplica = false;
  for (const bucket of replicaBuckets.values()) {
    if (bucket.length > 1) {
      hasReplica = true;
      break;
    }
  }
  if (!hasReplica) return edges;

  const nodeMap = new Map<string, NodeType>();
  for (const node of nodes) nodeMap.set(node.id, node);

  return edges.map((edge) => {
    const target = nodeMap.get(edge.target);
    if (!target) return edge;
    if (
      target.type !== NodeTypeEnum.External &&
      target.type !== NodeTypeEnum.Anchor
    ) {
      return edge;
    }

    const bucket = replicaBuckets.get(`${target.type}::${target.data.label}`);
    if (!bucket || bucket.length <= 1) return edge;

    const source = nodeMap.get(edge.source);
    if (!source) return edge;

    const sourcePos = getNodeAbsolutePosition(source, nodes);
    let bestId = target.id;
    let bestDist = Infinity;
    for (const replica of bucket) {
      const replicaPos = getNodeAbsolutePosition(replica, nodes);
      const dx = replicaPos.x - sourcePos.x;
      const dy = replicaPos.y - sourcePos.y;
      const dist = dx * dx + dy * dy;
      if (dist < bestDist) {
        bestDist = dist;
        bestId = replica.id;
      }
    }

    if (bestId === edge.target) return edge;

    return {
      ...edge,
      target: bestId,
      id: `${edge.source}_${edge.sourceHandle}_${bestId}`,
    };
  });
}
