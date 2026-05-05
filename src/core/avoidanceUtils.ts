/**
 * 边避让走线算法
 */

import type { NodeType } from "../stores/flow/types";
import { getNodeAbsolutePosition } from "../stores/flow/utils/coordinateUtils";

/** 点坐标 */
export type Point = { x: number; y: number };

/** 节点边界框 */
export type NodeBounds = {
  id: string;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

/** 避让算法配置 */
export type AvoidanceConfig = {
  maxRecursionDepth: number; // 最大递归深度，默认 3
  avoidMargin: number; // 避让边距，默认 20
  cornerRadius: number; // 转角圆角半径，默认 8
  directLineMaxDistance: number; // 直线连接最大距离，默认 200
  edgeOffsetStep: number; // 边之间避让的偏移步长，默认 15
};

/** 默认配置 */
export const DEFAULT_AVOIDANCE_CONFIG: AvoidanceConfig = {
  maxRecursionDepth: 3,
  avoidMargin: 20,
  cornerRadius: 8,
  directLineMaxDistance: 200,
  edgeOffsetStep: 15,
};

const EPSILON = 1e-6;

/**
 * 判断点是否在矩形内
 * @param point 点坐标
 * @param box 矩形边界框
 * @param excludeBoundary 如果为 true，只检测点是否在矩形内部（不包括边界）
 */
function isPointInBox(
  point: Point,
  box: NodeBounds,
  excludeBoundary: boolean = false,
): boolean {
  if (excludeBoundary) {
    return (
      point.x > box.minX &&
      point.x < box.maxX &&
      point.y > box.minY &&
      point.y < box.maxY
    );
  }
  return (
    point.x >= box.minX &&
    point.x <= box.maxX &&
    point.y >= box.minY &&
    point.y <= box.maxY
  );
}

/**
 * 判断线段是否与矩形相交
 * 使用 Cohen-Sutherland 线段裁剪算法的思路，但更直接
 * @param a 线段起点
 * @param b 线段终点
 * @param box 节点边界框
 * @param excludeBoundary 如果为 true，只检测线段是否穿过矩形内部（不包括边界）
 * @returns true 表示相交，false 表示不相交
 */
function lineIntersectsBox(
  a: Point,
  b: Point,
  box: NodeBounds,
  excludeBoundary: boolean = false,
): boolean {
  // 1. 快速排斥试验：如果线段的包围盒与矩形不相交，则线段不可能与矩形相交
  const lineMinX = Math.min(a.x, b.x);
  const lineMaxX = Math.max(a.x, b.x);
  const lineMinY = Math.min(a.y, b.y);
  const lineMaxY = Math.max(a.y, b.y);

  if (excludeBoundary) {
    // 排除边界：使用严格不等式
    if (
      lineMaxX <= box.minX ||
      lineMinX >= box.maxX ||
      lineMaxY <= box.minY ||
      lineMinY >= box.maxY
    ) {
      return false;
    }
  } else {
    if (
      lineMaxX < box.minX ||
      lineMinX > box.maxX ||
      lineMaxY < box.minY ||
      lineMinY > box.maxY
    ) {
      return false;
    }
  }

  // 2. 跨立试验：检查线段是否与矩形的任何一条边相交
  // 如果任一端点在矩形内，则相交
  if (
    isPointInBox(a, box, excludeBoundary) ||
    isPointInBox(b, box, excludeBoundary)
  ) {
    return true;
  }

  // 检查线段是否与矩形的四条边相交
  const rectEdges: [Point, Point][] = [
    [
      { x: box.minX, y: box.minY },
      { x: box.maxX, y: box.minY },
    ], // 上边
    [
      { x: box.maxX, y: box.minY },
      { x: box.maxX, y: box.maxY },
    ], // 右边
    [
      { x: box.maxX, y: box.maxY },
      { x: box.minX, y: box.maxY },
    ], // 下边
    [
      { x: box.minX, y: box.maxY },
      { x: box.minX, y: box.minY },
    ], // 左边
  ];

  for (const [edgeStart, edgeEnd] of rectEdges) {
    if (lineSegmentsIntersect(a, b, edgeStart, edgeEnd)) {
      return true;
    }
  }

  return false;
}

/**
 * 判断两条线段是否相交（不包括端点接触）
 * 使用向量叉积法
 */
function lineSegmentsIntersect(
  a1: Point,
  a2: Point,
  b1: Point,
  b2: Point,
): boolean {
  const cross = (p1: Point, p2: Point, p3: Point): number => {
    return (p2.x - p1.x) * (p3.y - p1.y) - (p2.y - p1.y) * (p3.x - p1.x);
  };

  const d1 = cross(b1, b2, a1);
  const d2 = cross(b1, b2, a2);
  const d3 = cross(a1, a2, b1);
  const d4 = cross(a1, a2, b2);

  // 检查是否跨立
  if (
    ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
    ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
  ) {
    return true;
  }

  // 检查是否共线且重叠（这里我们不需要太严格，因为前面已经做了包围盒检测）
  if (Math.abs(d1) < EPSILON && onSegment(b1, b2, a1)) return true;
  if (Math.abs(d2) < EPSILON && onSegment(b1, b2, a2)) return true;
  if (Math.abs(d3) < EPSILON && onSegment(a1, a2, b1)) return true;
  if (Math.abs(d4) < EPSILON && onSegment(a1, a2, b2)) return true;

  return false;
}

/**
 * 判断点是否在线段上（包含端点）
 */
function onSegment(s1: Point, s2: Point, p: Point): boolean {
  return (
    p.x >= Math.min(s1.x, s2.x) - EPSILON &&
    p.x <= Math.max(s1.x, s2.x) + EPSILON &&
    p.y >= Math.min(s1.y, s2.y) - EPSILON &&
    p.y <= Math.max(s1.y, s2.y) + EPSILON
  );
}

/**
 * 找出阻挡线段的最近节点
 * @param outputXY 起点（源节点 handle 位置）
 * @param inputXY 终点（目标节点 handle 位置）
 * @param nodeBoundsList 所有节点边界框列表
 * @param excludeIds 需要排除的节点 ID（源节点和目标节点）
 * @param checkInternalOnly 如果为 true，只检测线段是否穿过节点内部（不包括边界），用于检测目标节点是否被穿过
 * @returns 最近的阻挡节点，或 null
 */
function findBlockingNode(
  outputXY: Point,
  inputXY: Point,
  nodeBoundsList: NodeBounds[],
  excludeIds: Set<string>,
  checkInternalOnly: boolean = false,
): NodeBounds | null {
  let closestDistance = Number.MAX_SAFE_INTEGER;
  let closest: NodeBounds | null = null;

  for (const nodeBounds of nodeBoundsList) {
    // 排除源节点
    if (excludeIds.has(nodeBounds.id)) {
      // 如果是目标节点且需要检测内部穿过，则继续检测
      if (!checkInternalOnly) continue;
    }

    // 如果检测内部穿过，排除边界接触
    const isIntersecting = lineIntersectsBox(
      outputXY,
      inputXY,
      nodeBounds,
      checkInternalOnly,
    );

    if (isIntersecting) {
      // 计算节点中心到起点的距离
      const centerX = (nodeBounds.minX + nodeBounds.maxX) / 2;
      const centerY = (nodeBounds.minY + nodeBounds.maxY) / 2;
      const dist = Math.sqrt(
        Math.pow(centerX - outputXY.x, 2) + Math.pow(centerY - outputXY.y, 2),
      );

      if (dist < closestDistance) {
        closest = nodeBounds;
        closestDistance = dist;
      }
    }
  }

  return closest;
}

/**
 * 测试路径是否被任何节点阻挡
 * @param points 路径点数组
 * @param nodeBoundsList 节点边界框列表
 * @param excludeIds 排除的节点 ID
 * @param checkInternalOnly 如果为 true，只检测线段是否穿过节点内部（包括目标节点）
 * @returns 阻挡的节点，或 null
 */
function testPath(
  points: Point[],
  nodeBoundsList: NodeBounds[],
  excludeIds: Set<string>,
  checkInternalOnly: boolean = false,
): NodeBounds | null {
  for (let i = 0; i < points.length - 1; i++) {
    const blocking = findBlockingNode(
      points[i],
      points[i + 1],
      nodeBoundsList,
      excludeIds,
      checkInternalOnly,
    );
    if (blocking) return blocking;
  }
  return null;
}

/**
 * 构建带圆角的 SVG 路径字符串
 * @param points 路径点数组
 * @param cornerRadius 转角圆角半径
 */
function buildPathString(points: Point[], cornerRadius: number): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  if (points.length === 2)
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;

  let path = `M ${points[0].x} ${points[0].y}`;

  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];

    // 计算前后方向
    const dx1 = curr.x - prev.x;
    const dy1 = curr.y - prev.y;
    const dx2 = next.x - curr.x;
    const dy2 = next.y - curr.y;

    // 判断是否为直线段（水平或垂直）
    const isPrevStraight = Math.abs(dx1) < EPSILON || Math.abs(dy1) < EPSILON;
    const isNextStraight = Math.abs(dx2) < EPSILON || Math.abs(dy2) < EPSILON;

    if (isPrevStraight && isNextStraight) {
      // 直角转角，使用圆角
      const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
      const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

      // 如果线段长度为0，跳过圆角处理
      if (len1 < EPSILON || len2 < EPSILON) {
        path += ` L ${curr.x} ${curr.y}`;
      } else {
        const r = Math.min(cornerRadius, len1 / 2, len2 / 2);

        // 转角前的点
        const beforeX = curr.x - (dx1 / len1) * r;
        const beforeY = curr.y - (dy1 / len1) * r;

        // 转角后的点
        const afterX = curr.x + (dx2 / len2) * r;
        const afterY = curr.y + (dy2 / len2) * r;

        path += ` L ${beforeX} ${beforeY}`;
        path += ` Q ${curr.x} ${curr.y} ${afterX} ${afterY}`;
      }
    } else {
      // 非直角，直接连线
      path += ` L ${curr.x} ${curr.y}`;
    }
  }

  // 最后一个点
  const last = points[points.length - 1];
  path += ` L ${last.x} ${last.y}`;

  return path;
}

/**
 * 计算路径的中点
 */
function getPathMidpoint(points: Point[]): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return points[0];

  // 计算总长度
  let totalLength = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const dx = points[i + 1].x - points[i].x;
    const dy = points[i + 1].y - points[i].y;
    totalLength += Math.sqrt(dx * dx + dy * dy);
  }

  // 找到中点所在的段
  const halfLength = totalLength / 2;
  let currentLength = 0;

  for (let i = 0; i < points.length - 1; i++) {
    const dx = points[i + 1].x - points[i].x;
    const dy = points[i + 1].y - points[i].y;
    const segmentLength = Math.sqrt(dx * dx + dy * dy);

    if (currentLength + segmentLength >= halfLength) {
      // 中点在这段上
      const remaining = halfLength - currentLength;
      const ratio = remaining / segmentLength;
      return {
        x: points[i].x + dx * ratio,
        y: points[i].y + dy * ratio,
      };
    }

    currentLength += segmentLength;
  }

  return points[Math.floor(points.length / 2)];
}

/**
 * 计算避让路径的核心函数
 */
function calculateAvoidancePathRecursive(
  sourceXY: Point,
  targetXY: Point,
  sourcePosition: string,
  targetPosition: string,
  nodeBoundsList: NodeBounds[],
  excludeIds: Set<string>,
  config: AvoidanceConfig,
  depth: number,
  blockedCount: Record<string, number>,
): Point[] {
  // 计算距离
  const dx = targetXY.x - sourceXY.x;
  const dy = targetXY.y - sourceXY.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  // 1. 尝试直线连接
  // 首先检测是否有任何节点（包括目标节点）被穿过
  const blockingInternal = findBlockingNode(
    sourceXY,
    targetXY,
    nodeBoundsList,
    excludeIds,
    true, // 检测内部穿过，包括目标节点
  );

  // 如果没有节点被穿过，直接连接
  if (!blockingInternal) {
    return [sourceXY, targetXY];
  }

  // 如果距离太远，即使没有被阻挡也不使用直线
  if (distance >= config.directLineMaxDistance) {
    // 继续尝试其他路径
  }

  // 2. 尝试 45 度斜线路径
  // 水平方向为主（包括相等的情况）
  if (absDx >= absDy) {
    // 水平方向为主
    const goingLeft = targetXY.x < sourceXY.x;
    const offset = goingLeft ? -absDy : absDy;

    // 变体 A：先 45 度，再直线
    const pathA: Point[] = [
      sourceXY,
      { x: targetXY.x - offset, y: sourceXY.y },
      targetXY,
    ];
    if (!testPath(pathA, nodeBoundsList, excludeIds, true)) {
      return pathA;
    }

    // 变体 B：先直线，再 45 度
    const pathB: Point[] = [
      sourceXY,
      { x: sourceXY.x + offset, y: targetXY.y },
      targetXY,
    ];
    if (!testPath(pathB, nodeBoundsList, excludeIds, true)) {
      return pathB;
    }
  }

  // 垂直方向为主
  if (absDx <= absDy) {
    // 垂直方向为主
    const goingUp = targetXY.y < sourceXY.y;
    const offset = goingUp ? -absDx : absDx;

    // 变体 A：先 45 度，再直线
    const pathA: Point[] = [
      sourceXY,
      { x: sourceXY.x, y: targetXY.y - offset },
      targetXY,
    ];
    if (!testPath(pathA, nodeBoundsList, excludeIds, true)) {
      return pathA;
    }

    // 变体 B：先直线，再 45 度
    const pathB: Point[] = [
      sourceXY,
      { x: targetXY.x, y: sourceXY.y + offset },
      targetXY,
    ];
    if (!testPath(pathB, nodeBoundsList, excludeIds, true)) {
      return pathB;
    }
  }

  // 3. 尝试 90 度直角路径
  // 变体 A：先水平后垂直
  const pathStraight90A: Point[] = [
    sourceXY,
    { x: sourceXY.x, y: targetXY.y },
    targetXY,
  ];
  const blockingA = testPath(pathStraight90A, nodeBoundsList, excludeIds, true);
  if (!blockingA) {
    return pathStraight90A;
  }

  // 变体 B：先垂直后水平
  const pathStraight90B: Point[] = [
    sourceXY,
    { x: targetXY.x, y: sourceXY.y },
    targetXY,
  ];
  const blockingB = testPath(pathStraight90B, nodeBoundsList, excludeIds, true);
  if (!blockingB) {
    return pathStraight90B;
  }

  // 4. 递归绕行
  if (depth >= config.maxRecursionDepth) {
    // 达到最大深度，返回直角路径
    return pathStraight90A;
  }

  // 选择阻挡节点进行绕行
  const blocking = blockingA || blockingB;
  if (!blocking) {
    return pathStraight90A;
  }

  // 检查是否被同一节点阻挡太多次
  if (blockedCount[blocking.id] > 3) {
    return pathStraight90A;
  }
  blockedCount[blocking.id] = (blockedCount[blocking.id] || 0) + 1;

  // 计算绕行点
  const margin = config.avoidMargin;
  const bypassPoints: Point[] = [];

  // 根据方向选择绕行策略
  // 计算从哪个方向绕行更近
  const topY = blocking.minY - margin;
  const bottomY = blocking.maxY + margin;
  const leftX = blocking.minX - margin;
  const rightX = blocking.maxX + margin;

  // 计算四种绕行方案的距离
  const distViaTop = Math.abs(sourceXY.y - topY) + Math.abs(targetXY.y - topY);
  const distViaBottom =
    Math.abs(sourceXY.y - bottomY) + Math.abs(targetXY.y - bottomY);
  const distViaLeft =
    Math.abs(sourceXY.x - leftX) + Math.abs(targetXY.x - leftX);
  const distViaRight =
    Math.abs(sourceXY.x - rightX) + Math.abs(targetXY.x - rightX);

  // 选择最短的绕行路径
  const minDist = Math.min(
    distViaTop,
    distViaBottom,
    distViaLeft,
    distViaRight,
  );

  if (minDist === distViaTop) {
    // 从上方绕行：源点 -> 源点上方 -> 目标点上方 -> 目标点
    bypassPoints.push({ x: sourceXY.x, y: topY }, { x: targetXY.x, y: topY });
  } else if (minDist === distViaBottom) {
    // 从下方绕行
    bypassPoints.push(
      { x: sourceXY.x, y: bottomY },
      { x: targetXY.x, y: bottomY },
    );
  } else if (minDist === distViaLeft) {
    // 从左方绕行
    bypassPoints.push({ x: leftX, y: sourceXY.y }, { x: leftX, y: targetXY.y });
  } else {
    // 从右方绕行
    bypassPoints.push(
      { x: rightX, y: sourceXY.y },
      { x: rightX, y: targetXY.y },
    );
  }

  // 递归计算剩余路径
  const lastBypass = bypassPoints[bypassPoints.length - 1];
  const remainingPath = calculateAvoidancePathRecursive(
    lastBypass,
    targetXY,
    sourcePosition,
    targetPosition,
    nodeBoundsList,
    excludeIds,
    config,
    depth + 1,
    blockedCount,
  );

  return [sourceXY, ...bypassPoints, ...remainingPath.slice(1)];
}

/**
 * 计算自循环路径（绕节点矩形路径）
 */
function calculateSelfLoopPath(
  sourceXY: Point,
  targetXY: Point,
  nodeBounds: NodeBounds,
  config: AvoidanceConfig,
): Point[] {
  const margin = config.avoidMargin;

  // 确定绕行方向（根据 handle 位置）
  const sourceOnLeft = sourceXY.x <= nodeBounds.minX + 10;
  const sourceOnRight = sourceXY.x >= nodeBounds.maxX - 10;
  const sourceOnTop = sourceXY.y <= nodeBounds.minY + 10;
  const sourceOnBottom = sourceXY.y >= nodeBounds.maxY - 10;

  const targetOnLeft = targetXY.x <= nodeBounds.minX + 10;
  const targetOnRight = targetXY.x >= nodeBounds.maxX - 10;
  const targetOnTop = targetXY.y <= nodeBounds.minY + 10;
  const targetOnBottom = targetXY.y >= nodeBounds.maxY - 10;

  // 决定绕行方向
  let points: Point[] = [];

  if (sourceOnRight && targetOnLeft) {
    // 右到左：从上方绕行
    const topY = nodeBounds.minY - margin;
    points = [
      sourceXY,
      { x: nodeBounds.maxX + margin, y: sourceXY.y },
      { x: nodeBounds.maxX + margin, y: topY },
      { x: nodeBounds.minX - margin, y: topY },
      { x: nodeBounds.minX - margin, y: targetXY.y },
      targetXY,
    ];
  } else if (sourceOnLeft && targetOnRight) {
    // 左到右：从下方绕行
    const bottomY = nodeBounds.maxY + margin;
    points = [
      sourceXY,
      { x: nodeBounds.minX - margin, y: sourceXY.y },
      { x: nodeBounds.minX - margin, y: bottomY },
      { x: nodeBounds.maxX + margin, y: bottomY },
      { x: nodeBounds.maxX + margin, y: targetXY.y },
      targetXY,
    ];
  } else if (sourceOnBottom && targetOnTop) {
    // 下到上：从右侧绕行
    const rightX = nodeBounds.maxX + margin;
    points = [
      sourceXY,
      { x: sourceXY.x, y: nodeBounds.maxY + margin },
      { x: rightX, y: nodeBounds.maxY + margin },
      { x: rightX, y: nodeBounds.minY - margin },
      { x: targetXY.x, y: nodeBounds.minY - margin },
      targetXY,
    ];
  } else if (sourceOnTop && targetOnBottom) {
    // 上到下：从左侧绕行
    const leftX = nodeBounds.minX - margin;
    points = [
      sourceXY,
      { x: sourceXY.x, y: nodeBounds.minY - margin },
      { x: leftX, y: nodeBounds.minY - margin },
      { x: leftX, y: nodeBounds.maxY + margin },
      { x: targetXY.x, y: nodeBounds.maxY + margin },
      targetXY,
    ];
  } else {
    // 默认：从右侧绕行
    const rightX = nodeBounds.maxX + margin;
    points = [
      sourceXY,
      { x: rightX, y: sourceXY.y },
      { x: rightX, y: targetXY.y },
      targetXY,
    ];
  }

  return points;
}

/**
 * 从节点列表构建边界框列表
 * 使用默认尺寸作为后备，确保所有节点都被包含
 */
export function buildNodeBoundsList(nodes: NodeType[]): NodeBounds[] {
  // 默认节点尺寸
  const DEFAULT_NODE_WIDTH = 200;
  const DEFAULT_NODE_HEIGHT = 100;

  return nodes.map((node) => {
    const width = node.measured?.width ?? DEFAULT_NODE_WIDTH;
    const height = node.measured?.height ?? DEFAULT_NODE_HEIGHT;
    const absolutePosition = getNodeAbsolutePosition(node, nodes);

    return {
      id: node.id,
      minX: absolutePosition.x,
      minY: absolutePosition.y,
      maxX: absolutePosition.x + width,
      maxY: absolutePosition.y + height,
    };
  });
}

/**
 * 计算避让路径（主入口）
 * @param edgeIndex 当前边在平行边组中的索引，用于边-边避让
 * @param totalParallelEdges 平行边的总数
 */
export function calculateAvoidancePath(
  sourceXY: Point,
  targetXY: Point,
  sourcePosition: string,
  targetPosition: string,
  nodeBoundsList: NodeBounds[],
  excludeIds: Set<string>,
  config: AvoidanceConfig = DEFAULT_AVOIDANCE_CONFIG,
  edgeIndex: number = 0,
  totalParallelEdges: number = 1,
): { path: string; labelX: number; labelY: number } {
  // 检查是否为自循环
  // 自循环时 excludeIds 有两个相同元素
  const excludeIdsArray = [...excludeIds];
  const isSelfLoop =
    excludeIdsArray.length === 2 && excludeIdsArray[0] === excludeIdsArray[1];

  // 计算边偏移量，用于边-边避让
  // 当多条边连接相同的源节点和目标节点时，将它们分散开
  let offsetSourceX = 0;
  let offsetSourceY = 0;
  let offsetTargetX = 0;
  let offsetTargetY = 0;

  if (totalParallelEdges > 1) {
    const step = config.edgeOffsetStep;
    // 根据边的索引计算偏移量
    // 将边分布在中心线的两侧
    const offset = (edgeIndex - (totalParallelEdges - 1) / 2) * step;

    // 根据源和目标位置决定偏移方向
    if (sourcePosition === "right" || sourcePosition === "left") {
      offsetSourceY = offset;
    } else {
      offsetSourceX = offset;
    }

    if (targetPosition === "right" || targetPosition === "left") {
      offsetTargetY = offset;
    } else {
      offsetTargetX = offset;
    }
  }

  // 应用偏移量
  const adjustedSourceXY: Point = {
    x: sourceXY.x + offsetSourceX,
    y: sourceXY.y + offsetSourceY,
  };
  const adjustedTargetXY: Point = {
    x: targetXY.x + offsetTargetX,
    y: targetXY.y + offsetTargetY,
  };

  if (isSelfLoop) {
    // 自循环：找到当前节点边界
    const nodeId = excludeIdsArray[0];
    const nodeBounds = nodeBoundsList.find((n) => n.id === nodeId);
    if (nodeBounds) {
      const points = calculateSelfLoopPath(
        adjustedSourceXY,
        adjustedTargetXY,
        nodeBounds,
        config,
      );
      const path = buildPathString(points, config.cornerRadius);
      const mid = getPathMidpoint(points);
      return { path, labelX: mid.x, labelY: mid.y };
    }
  }

  // 正常避让路径计算
  const points = calculateAvoidancePathRecursive(
    adjustedSourceXY,
    adjustedTargetXY,
    sourcePosition,
    targetPosition,
    nodeBoundsList,
    excludeIds,
    config,
    0,
    {},
  );

  const path = buildPathString(points, config.cornerRadius);
  const mid = getPathMidpoint(points);

  return { path, labelX: mid.x, labelY: mid.y };
}
