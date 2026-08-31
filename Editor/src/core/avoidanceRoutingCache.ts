import type {
  AvoidanceConfig,
  AvoidancePathResult,
  NodeBounds,
  Point,
  ParallelEdgeInfo,
} from "./avoidanceUtils";

export type AvoidanceRouteRequest = {
  edgeId: string;
  sourceId: string;
  targetId: string;
  sourceXY: Point;
  targetXY: Point;
  sourcePosition: string;
  targetPosition: string;
  parallelEdgeInfo?: ParallelEdgeInfo;
  config: AvoidanceConfig;
};

export type NodeBoundsChange = {
  previous?: NodeBounds;
  next?: NodeBounds;
};

export type AvoidanceRouteCacheStats = {
  hits: number;
  misses: number;
  invalidations: number;
};

type RouteBounds = Omit<NodeBounds, "id">;

type RouteCacheEntry = {
  key: string;
  sourceId: string;
  targetId: string;
  result: AvoidancePathResult;
  routeBounds: RouteBounds;
  dependencyNodeIds: ReadonlySet<string>;
  dependencyBoundsById: ReadonlyMap<string, NodeBounds | undefined>;
  changeSet: ReadonlyMap<string, NodeBoundsChange>;
};

const EMPTY_STATS: AvoidanceRouteCacheStats = {
  hits: 0,
  misses: 0,
  invalidations: 0,
};

function createRouteKey(request: AvoidanceRouteRequest): string {
  const parallelEdgeInfo = request.parallelEdgeInfo;
  return JSON.stringify([
    request.edgeId,
    request.sourceId,
    request.targetId,
    request.sourceXY.x,
    request.sourceXY.y,
    request.targetXY.x,
    request.targetXY.y,
    request.sourcePosition,
    request.targetPosition,
    parallelEdgeInfo?.edgeIndex ?? 0,
    parallelEdgeInfo?.totalParallelEdges ?? 1,
    request.config.maxRecursionDepth,
    request.config.avoidMargin,
    request.config.cornerRadius,
    request.config.directLineMaxDistance,
    request.config.edgeOffsetStep,
  ]);
}

function sameBounds(
  left: NodeBounds | undefined,
  right: NodeBounds | undefined,
): boolean {
  if (!left || !right) return left === right;
  return (
    left.minX === right.minX &&
    left.minY === right.minY &&
    left.maxX === right.maxX &&
    left.maxY === right.maxY
  );
}

function boundsIntersect(left: RouteBounds, right: NodeBounds): boolean {
  return !(
    left.maxX < right.minX ||
    left.minX > right.maxX ||
    left.maxY < right.minY ||
    left.minY > right.maxY
  );
}

function createRouteBounds(
  points: Point[],
  margin: number,
): RouteBounds {
  const first = points[0] ?? { x: 0, y: 0 };
  let minX = first.x;
  let minY = first.y;
  let maxX = first.x;
  let maxY = first.y;

  for (const point of points.slice(1)) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }

  return {
    minX: minX - margin,
    minY: minY - margin,
    maxX: maxX + margin,
    maxY: maxY + margin,
  };
}

function isEntryAffected(
  entry: RouteCacheEntry,
  request: AvoidanceRouteRequest,
  nodeBoundsById: ReadonlyMap<string, NodeBounds>,
  changedNodeBounds: ReadonlyMap<string, NodeBoundsChange>,
): boolean {
  // 先比较历史阻挡节点的边界版本，覆盖障碍物移出路径或被删除的情况。
  for (const nodeId of entry.dependencyNodeIds) {
    if (
      !sameBounds(
        entry.dependencyBoundsById.get(nodeId),
        nodeBoundsById.get(nodeId),
      )
    ) {
      return true;
    }
  }

  // 新障碍物可能之前没有参与路径计算；只检查发生变化的节点与该路径的空间交集。
  for (const change of changedNodeBounds.values()) {
    if (
      (change.previous && boundsIntersect(entry.routeBounds, change.previous)) ||
      (change.next && boundsIntersect(entry.routeBounds, change.next))
    ) {
      return true;
    }
  }

  // 端点坐标通常会进入 key；这里保留显式判断，避免端点来自未测量节点时复用旧结果。
  return entry.sourceId !== request.sourceId || entry.targetId !== request.targetId;
}

function isEntryAffectedByChanges(
  entry: RouteCacheEntry,
  changedNodeBounds: ReadonlyMap<string, NodeBoundsChange>,
): boolean {
  // 当前修订内刚计算出的结果已经使用了最新边界，不要被提交后的清理 effect 再次移除。
  if (entry.changeSet === changedNodeBounds) return false;

  for (const nodeId of entry.dependencyNodeIds) {
    const change = changedNodeBounds.get(nodeId);
    if (!change) continue;
    if (!sameBounds(entry.dependencyBoundsById.get(nodeId), change.next)) {
      return true;
    }
  }

  for (const change of changedNodeBounds.values()) {
    if (
      (change.previous && boundsIntersect(entry.routeBounds, change.previous)) ||
      (change.next && boundsIntersect(entry.routeBounds, change.next))
    ) {
      return true;
    }
  }

  return false;
}

export class AvoidanceRouteCache {
  private readonly entries = new Map<string, RouteCacheEntry>();

  private stats: AvoidanceRouteCacheStats = { ...EMPTY_STATS };

  get(
    request: AvoidanceRouteRequest,
    nodeBoundsById: ReadonlyMap<string, NodeBounds>,
    changedNodeBounds: ReadonlyMap<string, NodeBoundsChange>,
    calculate: () => AvoidancePathResult,
  ): AvoidancePathResult {
    const key = createRouteKey(request);
    const cached = this.entries.get(request.edgeId);

    if (
      cached &&
      cached.key === key &&
      !isEntryAffected(cached, request, nodeBoundsById, changedNodeBounds)
    ) {
      this.stats.hits += 1;
      return cached.result;
    }

    if (cached) this.stats.invalidations += 1;
    this.stats.misses += 1;

    const result = calculate();
    const dependencyNodeIds = new Set(result.blockingNodeIds);
    dependencyNodeIds.add(request.sourceId);
    dependencyNodeIds.add(request.targetId);
    const dependencyBoundsById = new Map<string, NodeBounds | undefined>();
    for (const nodeId of dependencyNodeIds) {
      dependencyBoundsById.set(nodeId, nodeBoundsById.get(nodeId));
    }

    this.entries.set(request.edgeId, {
      key,
      sourceId: request.sourceId,
      targetId: request.targetId,
      result,
      routeBounds: createRouteBounds(result.points, request.config.avoidMargin),
      dependencyNodeIds,
      dependencyBoundsById,
      changeSet: changedNodeBounds,
    });

    return result;
  }

  /**
   * 在布局修订提交后主动移除受影响条目，避免未挂载边错过某次变化。
   */
  invalidate(changedNodeBounds: ReadonlyMap<string, NodeBoundsChange>): void {
    if (changedNodeBounds.size === 0) return;

    for (const [edgeId, entry] of this.entries) {
      if (!isEntryAffectedByChanges(entry, changedNodeBounds)) continue;
      this.entries.delete(edgeId);
      this.stats.invalidations += 1;
    }
  }

  clear(): void {
    this.entries.clear();
    this.stats = { ...EMPTY_STATS };
  }

  prune(edgeIds: ReadonlySet<string>): void {
    for (const edgeId of this.entries.keys()) {
      if (!edgeIds.has(edgeId)) this.entries.delete(edgeId);
    }
  }

  getStats(): AvoidanceRouteCacheStats {
    return { ...this.stats };
  }
}
