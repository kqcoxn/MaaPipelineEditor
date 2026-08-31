import { describe, expect, it } from "vitest";

import {
  AvoidanceRouteCache,
  type AvoidanceRouteRequest,
  type NodeBoundsChange,
} from "./avoidanceRoutingCache";
import {
  DEFAULT_AVOIDANCE_CONFIG,
  type AvoidancePathResult,
  type NodeBounds,
} from "./avoidanceUtils";

function createRequest(
  overrides: Partial<AvoidanceRouteRequest> = {},
): AvoidanceRouteRequest {
  return {
    edgeId: "edge-1",
    sourceId: "source",
    targetId: "target",
    sourceXY: { x: 0, y: 0 },
    targetXY: { x: 100, y: 0 },
    sourcePosition: "right",
    targetPosition: "left",
    config: DEFAULT_AVOIDANCE_CONFIG,
    ...overrides,
  };
}

function createBounds(
  id: string,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): NodeBounds {
  return { id, minX, minY, maxX, maxY };
}

function createResult(blockingNodeIds: string[] = []): AvoidancePathResult {
  return {
    path: "M 0 0 L 100 0",
    labelX: 50,
    labelY: 0,
    points: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ],
    blockingNodeIds,
  };
}

function change(
  id: string,
  previous: NodeBounds | undefined,
  next: NodeBounds | undefined,
): [string, NodeBoundsChange] {
  return [id, { previous, next }];
}

describe("AvoidanceRouteCache", () => {
  it("相同请求命中缓存，计算函数只执行一次", () => {
    const cache = new AvoidanceRouteCache();
    const request = createRequest();
    const bounds = new Map<string, NodeBounds>();
    let calculateCount = 0;
    const calculate = () => {
      calculateCount += 1;
      return createResult();
    };

    const first = cache.get(request, bounds, new Map(), calculate);
    const second = cache.get(request, bounds, new Map(), calculate);

    expect(second).toBe(first);
    expect(calculateCount).toBe(1);
    expect(cache.getStats()).toMatchObject({ hits: 1, misses: 1 });
  });

  it("无关节点变化继续复用缓存", () => {
    const cache = new AvoidanceRouteCache();
    const request = createRequest();
    const initialBounds = new Map<string, NodeBounds>();
    const result = createResult();
    let calculateCount = 0;

    cache.get(request, initialBounds, new Map(), () => {
      calculateCount += 1;
      return result;
    });

    const unrelated = createBounds("unrelated", 500, 500, 600, 600);
    const nextBounds = new Map(initialBounds).set(unrelated.id, unrelated);
    const changes = new Map([
      change(unrelated.id, undefined, unrelated),
    ]);
    expect(cache.get(request, nextBounds, changes, () => {
      calculateCount += 1;
      return createResult();
    })).toBe(result);
    expect(calculateCount).toBe(1);
  });

  it("历史阻挡节点变化会使结果失效", () => {
    const cache = new AvoidanceRouteCache();
    const request = createRequest();
    const blocker = createBounds("blocker", 40, -10, 60, 10);
    const initialBounds = new Map([[blocker.id, blocker]]);
    let calculateCount = 0;

    cache.get(request, initialBounds, new Map(), () => {
      calculateCount += 1;
      return createResult([blocker.id]);
    });

    const movedBlocker = createBounds("blocker", 400, 400, 420, 420);
    const nextBounds = new Map([[movedBlocker.id, movedBlocker]]);
    const changes = new Map([
      change(blocker.id, blocker, movedBlocker),
    ]);
    cache.invalidate(changes);

    cache.get(request, nextBounds, new Map(), () => {
      calculateCount += 1;
      return createResult();
    });
    expect(calculateCount).toBe(2);
    expect(cache.getStats().invalidations).toBe(1);
  });

  it("新节点进入旧路径包围盒时使结果失效", () => {
    const cache = new AvoidanceRouteCache();
    const request = createRequest();
    const initialBounds = new Map<string, NodeBounds>();
    let calculateCount = 0;

    cache.get(request, initialBounds, new Map(), () => {
      calculateCount += 1;
      return createResult();
    });

    const newObstacle = createBounds("new-obstacle", 40, -10, 60, 10);
    const nextBounds = new Map([[newObstacle.id, newObstacle]]);
    const changes = new Map([
      change(newObstacle.id, undefined, newObstacle),
    ]);
    cache.get(request, nextBounds, changes, () => {
      calculateCount += 1;
      return createResult([newObstacle.id]);
    });

    // Provider 的 effect 随后提交同一批变化，不应删除当前修订刚生成的结果。
    cache.invalidate(changes);
    cache.get(request, nextBounds, new Map(), () => {
      calculateCount += 1;
      return createResult();
    });
    expect(calculateCount).toBe(2);
  });

  it("端点坐标和平行边信息变化时重新计算", () => {
    const cache = new AvoidanceRouteCache();
    const request = createRequest({
      parallelEdgeInfo: { edgeIndex: 0, totalParallelEdges: 2 },
    });
    const bounds = new Map<string, NodeBounds>();
    let calculateCount = 0;
    const calculate = () => {
      calculateCount += 1;
      return createResult();
    };

    cache.get(request, bounds, new Map(), calculate);
    cache.get(
      { ...request, sourceXY: { x: 1, y: 0 } },
      bounds,
      new Map(),
      calculate,
    );
    cache.get(
      {
        ...request,
        parallelEdgeInfo: { edgeIndex: 1, totalParallelEdges: 2 },
      },
      bounds,
      new Map(),
      calculate,
    );

    expect(calculateCount).toBe(3);
    expect(cache.getStats().invalidations).toBe(2);
  });

  it("按现有边裁剪并支持清理缓存", () => {
    const cache = new AvoidanceRouteCache();
    const bounds = new Map<string, NodeBounds>();
    let calculateCount = 0;
    const calculate = () => {
      calculateCount += 1;
      return createResult();
    };

    cache.get(createRequest({ edgeId: "edge-1" }), bounds, new Map(), calculate);
    cache.get(createRequest({ edgeId: "edge-2" }), bounds, new Map(), calculate);
    cache.prune(new Set(["edge-1"]));
    cache.get(createRequest({ edgeId: "edge-2" }), bounds, new Map(), calculate);
    expect(calculateCount).toBe(3);

    cache.clear();
    expect(cache.getStats()).toEqual({ hits: 0, misses: 0, invalidations: 0 });
    cache.get(createRequest({ edgeId: "edge-1" }), bounds, new Map(), calculate);
    expect(calculateCount).toBe(4);
  });
});
