/**
 * 节点磁吸对齐工具函数
 */

/** 对齐参考线 */
export type SnapGuideline = {
  type: "horizontal" | "vertical";
  position: number; // flow 坐标系中的位置
};

/** 对齐结果 */
export type SnapResult = {
  position: { x: number; y: number };
  guidelines: SnapGuideline[];
};

type NodeRect = {
  id: string;
  position: { x: number; y: number };
  measured?: { width: number; height: number };
};

/** 计算节点的对齐坐标 */
function getSnapPoints(node: NodeRect) {
  const w = node.measured?.width ?? 0;
  const h = node.measured?.height ?? 0;
  return {
    left: node.position.x,
    centerX: node.position.x + w / 2,
    right: node.position.x + w,
    top: node.position.y,
    centerY: node.position.y + h / 2,
    bottom: node.position.y + h,
  };
}

/**
 * 计算拖拽节点与其他节点的磁吸对齐
 * @param draggedNode 正在拖拽的节点
 * @param otherNodes 其他节点（不含拖拽节点）
 * @param threshold 吸附阈值（flow 坐标）
 */
export function findSnapAlignment(
  draggedNode: NodeRect,
  otherNodes: NodeRect[],
  threshold = 5
): SnapResult {
  const dragPoints = getSnapPoints(draggedNode);
  const dragXKeys = ["left", "centerX", "right"] as const;
  const dragYKeys = ["top", "centerY", "bottom"] as const;

  let bestXDist = threshold;
  let snapX: number | null = null;
  let bestXLine: number | null = null;

  let bestYDist = threshold;
  let snapY: number | null = null;
  let bestYLine: number | null = null;

  for (const other of otherNodes) {
    if (!other.measured) continue;
    const otherPoints = getSnapPoints(other);

    // X 轴（垂直参考线）
    for (const dk of dragXKeys) {
      for (const ok of dragXKeys) {
        const dist = Math.abs(dragPoints[dk] - otherPoints[ok]);
        if (dist < bestXDist) {
          bestXDist = dist;
          snapX = otherPoints[ok] - (dragPoints[dk] - draggedNode.position.x);
          bestXLine = otherPoints[ok];
        }
      }
    }

    // Y 轴（水平参考线）
    for (const dk of dragYKeys) {
      for (const ok of dragYKeys) {
        const dist = Math.abs(dragPoints[dk] - otherPoints[ok]);
        if (dist < bestYDist) {
          bestYDist = dist;
          snapY = otherPoints[ok] - (dragPoints[dk] - draggedNode.position.y);
          bestYLine = otherPoints[ok];
        }
      }
    }
  }

  const guidelines: SnapGuideline[] = [];
  if (bestXLine !== null) {
    guidelines.push({ type: "vertical", position: bestXLine });
  }
  if (bestYLine !== null) {
    guidelines.push({ type: "horizontal", position: bestYLine });
  }

  return {
    position: {
      x: snapX ?? draggedNode.position.x,
      y: snapY ?? draggedNode.position.y,
    },
    guidelines,
  };
}
