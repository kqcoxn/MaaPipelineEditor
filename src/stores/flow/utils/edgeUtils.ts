import type { EdgeType } from "../types";
import { SourceHandleTypeEnum } from "../../../components/flow/nodes";

// 查找边
export function findEdgeById(
  edges: EdgeType[],
  id: string
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
  type: SourceHandleTypeEnum
): number {
  let order = 1;
  const isNextGroup =
    type === SourceHandleTypeEnum.Next ||
    type === SourceHandleTypeEnum.JumpBack;

  edges.forEach((edge) => {
    if (edge.source === source) {
      if (isNextGroup) {
        // next、jump_back
        if (
          edge.sourceHandle === SourceHandleTypeEnum.Next ||
          edge.sourceHandle === SourceHandleTypeEnum.JumpBack
        ) {
          order++;
        }
      } else {
        // 其他类型
        if (edge.sourceHandle === type) order++;
      }
    }
  });
  return order;
}
