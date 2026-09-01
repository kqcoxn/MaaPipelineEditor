/**
 * 节点磁吸对齐工具函数
 */

/** 对齐参考线 */
export type SnapGuideline = {
  type: "horizontal" | "vertical";
  position: number;
};

/** 对齐结果 */
export type SnapResult = {
  position: { x: number; y: number };
  guidelines: SnapGuideline[];
};

export type IndexedSnapResult = SnapResult & {
  inspectedCoordinates: number;
};

export type SnapNodeRect = {
  id: string;
  position: { x: number; y: number };
  measured?: { width: number; height: number };
};

/** 视口信息 */
export type SnapViewportInfo = {
  x: number;
  y: number;
  zoom: number;
  width: number;
  height: number;
};

type AxisEntry = {
  coordinate: number;
  nodeOrder: number;
  pointOrder: number;
};

type AxisBucket = AxisEntry;

export type SnapAlignmentIndex = {
  x: AxisBucket[];
  y: AxisBucket[];
  candidateCount: number;
};

const X_KEYS = ["left", "centerX", "right"] as const;
const Y_KEYS = ["top", "centerY", "bottom"] as const;

/**
 * 判断节点是否在视口范围内。
 */
export function isNodeInViewport(
  node: SnapNodeRect,
  viewport: SnapViewportInfo,
  margin = 50,
): boolean {
  const { x, y, zoom, width, height } = viewport;
  const nodeW = node.measured?.width ?? 0;
  const nodeH = node.measured?.height ?? 0;
  const viewportLeft = -x / zoom - margin;
  const viewportRight = (-x + width) / zoom + margin;
  const viewportTop = -y / zoom - margin;
  const viewportBottom = (-y + height) / zoom + margin;
  const nodeLeft = node.position.x;
  const nodeRight = node.position.x + nodeW;
  const nodeTop = node.position.y;
  const nodeBottom = node.position.y + nodeH;

  return !(
    nodeRight < viewportLeft ||
    nodeLeft > viewportRight ||
    nodeBottom < viewportTop ||
    nodeTop > viewportBottom
  );
}

/**
 * 过滤出视口范围内的节点。
 */
export function filterNodesInViewport<T extends SnapNodeRect>(
  nodes: T[],
  viewport: SnapViewportInfo,
): T[] {
  return nodes.filter((node) => isNodeInViewport(node, viewport));
}

function getSnapPoints(node: SnapNodeRect) {
  const width = node.measured?.width ?? 0;
  const height = node.measured?.height ?? 0;
  return {
    left: node.position.x,
    centerX: node.position.x + width / 2,
    right: node.position.x + width,
    top: node.position.y,
    centerY: node.position.y + height / 2,
    bottom: node.position.y + height,
  };
}

function compareAxisEntries(left: AxisEntry, right: AxisEntry): number {
  return (
    left.coordinate - right.coordinate ||
    left.nodeOrder - right.nodeOrder ||
    left.pointOrder - right.pointOrder
  );
}

function buildAxisBuckets(entries: AxisEntry[]): AxisBucket[] {
  entries.sort(compareAxisEntries);
  const buckets: AxisBucket[] = [];

  for (const entry of entries) {
    const previous = buckets.at(-1);
    if (previous?.coordinate !== entry.coordinate) {
      buckets.push(entry);
      continue;
    }

    if (
      entry.nodeOrder < previous.nodeOrder ||
      (entry.nodeOrder === previous.nodeOrder &&
        entry.pointOrder < previous.pointOrder)
    ) {
      buckets[buckets.length - 1] = entry;
    }
  }

  return buckets;
}

/**
 * 为一次拖动构建按 left/center/right 与 top/center/bottom 排序的坐标索引。
 */
export function buildSnapAlignmentIndex(
  nodes: SnapNodeRect[],
): SnapAlignmentIndex {
  const xEntries: AxisEntry[] = [];
  const yEntries: AxisEntry[] = [];

  nodes.forEach((node, nodeOrder) => {
    if (!node.measured) return;
    const points = getSnapPoints(node);
    X_KEYS.forEach((key, pointOrder) => {
      xEntries.push({
        coordinate: points[key],
        nodeOrder,
        pointOrder,
      });
    });
    Y_KEYS.forEach((key, pointOrder) => {
      yEntries.push({
        coordinate: points[key],
        nodeOrder,
        pointOrder,
      });
    });
  });

  return {
    x: buildAxisBuckets(xEntries),
    y: buildAxisBuckets(yEntries),
    candidateCount: nodes.length,
  };
}

function lowerBound(buckets: AxisBucket[], coordinate: number): number {
  let low = 0;
  let high = buckets.length;

  while (low < high) {
    const middle = (low + high) >>> 1;
    if (buckets[middle].coordinate < coordinate) low = middle + 1;
    else high = middle;
  }

  return low;
}

type AxisSnap = {
  offset: number | null;
  line: number | null;
  inspectedCoordinates: number;
};

function findAxisSnap(
  dragCoordinates: number[],
  dragOrigin: number,
  buckets: AxisBucket[],
  threshold: number,
): AxisSnap {
  let bestDistance = threshold;
  let bestRank = Number.POSITIVE_INFINITY;
  let offset: number | null = null;
  let line: number | null = null;
  let inspectedCoordinates = 0;

  dragCoordinates.forEach((dragCoordinate, dragPointOrder) => {
    const insertionIndex = lowerBound(buckets, dragCoordinate);
    const bucketIndexes = [insertionIndex - 1, insertionIndex];

    for (const bucketIndex of bucketIndexes) {
      const bucket = buckets[bucketIndex];
      if (!bucket) continue;
      inspectedCoordinates += 1;
      const distance = Math.abs(dragCoordinate - bucket.coordinate);
      if (distance >= threshold) continue;

      // 与原线性算法的 node -> dragged point -> candidate point 顺序一致。
      const rank =
        bucket.nodeOrder * 9 + dragPointOrder * 3 + bucket.pointOrder;
      if (distance > bestDistance) continue;
      if (distance === bestDistance && rank >= bestRank) continue;

      bestDistance = distance;
      bestRank = rank;
      offset = bucket.coordinate - (dragCoordinate - dragOrigin);
      line = bucket.coordinate;
    }
  });

  return { offset, line, inspectedCoordinates };
}

/**
 * 使用拖动期索引查询最近吸附坐标。每个轴最多检查六个排序坐标桶。
 */
export function findSnapAlignmentWithIndex(
  draggedNode: SnapNodeRect,
  index: SnapAlignmentIndex,
  threshold = 5,
): IndexedSnapResult {
  const dragPoints = getSnapPoints(draggedNode);
  const xSnap = findAxisSnap(
    X_KEYS.map((key) => dragPoints[key]),
    draggedNode.position.x,
    index.x,
    threshold,
  );
  const ySnap = findAxisSnap(
    Y_KEYS.map((key) => dragPoints[key]),
    draggedNode.position.y,
    index.y,
    threshold,
  );
  const guidelines: SnapGuideline[] = [];

  if (xSnap.line !== null) {
    guidelines.push({ type: "vertical", position: xSnap.line });
  }
  if (ySnap.line !== null) {
    guidelines.push({ type: "horizontal", position: ySnap.line });
  }

  return {
    position: {
      x: xSnap.offset ?? draggedNode.position.x,
      y: ySnap.offset ?? draggedNode.position.y,
    },
    guidelines,
    inspectedCoordinates:
      xSnap.inspectedCoordinates + ySnap.inspectedCoordinates,
  };
}

/**
 * 一次性调用兼容入口。拖动热路径应复用 buildSnapAlignmentIndex 的结果。
 */
export function findSnapAlignment(
  draggedNode: SnapNodeRect,
  otherNodes: SnapNodeRect[],
  threshold = 5,
): SnapResult {
  return findSnapAlignmentWithIndex(
    draggedNode,
    buildSnapAlignmentIndex(otherNodes),
    threshold,
  );
}
