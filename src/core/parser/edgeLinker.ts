import { createExternalNode } from "../../stores/flow";
import type { NodeType, EdgeType, IdLabelPairsType } from "./types";
import { SourceHandleTypeEnum } from "../../components/flow/nodes";

// 全局ID计数器
let idCounter = 1;

/**
 * 重置ID计数器
 */
export function resetIdCounter(): void {
  idCounter = 1;
}

/**
 * 获取下一个ID
 */
export function getNextId(): number {
  return idCounter++;
}

/**
 * 链接边 - 创建源节点到目标节点的连接
 * @param oSourceLabel 源节点标签
 * @param oTargetLabels 目标节点标签数组
 * @param type 连接类型
 * @param idOLPairs 现有的ID-Label对应关系
 * @returns [新增的边数组, 新增的节点数组, 新增的ID-Label对应关系]
 */
export function linkEdge(
  oSourceLabel: string,
  oTargetLabels: string[],
  type: SourceHandleTypeEnum,
  idOLPairs: IdLabelPairsType
): [EdgeType[], NodeType[], IdLabelPairsType] {
  // 检索源节点ID
  const sourceId = idOLPairs.find((pair) => pair.label === oSourceLabel)
    ?.id as string;

  const edges: EdgeType[] = [];
  const nodes: NodeType[] = [];
  const newIdOLPairs: IdLabelPairsType = [];

  // 确保目标标签是数组
  if (!Array.isArray(oTargetLabels)) {
    oTargetLabels = [oTargetLabels];
  }

  oTargetLabels.forEach((targetLabel, index) => {
    let targetId = idOLPairs.find((pair) => pair.label === targetLabel)?.id;

    // 如果目标节点不存在，创建外部节点
    const externalId = "e_" + idCounter++;
    if (!targetId) {
      const node = createExternalNode(externalId, { label: targetLabel });
      targetId = node.id;
      nodes.push(node);
      newIdOLPairs.push({
        id: targetId,
        label: targetLabel,
      });
    }

    // 创建连接
    edges.push({
      id: `${sourceId}_${type}_${targetId}`,
      source: sourceId,
      sourceHandle: type,
      target: targetId ?? externalId,
      targetHandle: "target",
      label: index + 1,
      type: "marked",
    });
  });

  return [edges, nodes, newIdOLPairs];
}
