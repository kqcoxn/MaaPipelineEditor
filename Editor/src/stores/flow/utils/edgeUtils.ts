import type { EdgeType } from "../types";
import { SourceHandleTypeEnum } from "../../../components/flow/nodes";

export interface ConnectionEndpoints {
  source: string;
  sourceHandle?: string | null;
  target: string;
  targetHandle?: string | null;
}

export function getConnectionKey(connection: ConnectionEndpoints): string {
  return [
    connection.source,
    connection.sourceHandle ?? "",
    connection.target,
    connection.targetHandle ?? "",
  ].join("|");
}

export function hasMatchingConnection(
  edges: EdgeType[],
  connection: ConnectionEndpoints,
): boolean {
  const connectionKey = getConnectionKey(connection);
  return edges.some((edge) => getConnectionKey(edge) === connectionKey);
}

// 查找边
export function findEdgeById(
  edges: EdgeType[],
  id: string,
): EdgeType | undefined {
  return edges.find((edge) => edge.id === id);
}

// 筛选选中的边
export function getSelectedEdges(edges: EdgeType[]): EdgeType[] {
  return edges.filter((edge) => edge.selected);
}

// 计算链接次序
export function calcuLinkOrder(
  edges: EdgeType[],
  source: string,
  type: SourceHandleTypeEnum,
): number {
  let order = 1;

  edges.forEach((edge) => {
    if (edge.source === source && edge.sourceHandle === type) {
      order++;
    }
  });
  return order;
}
