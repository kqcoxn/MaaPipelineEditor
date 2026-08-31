import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useCallback,
  type PropsWithChildren,
} from "react";
import { useShallow } from "zustand/shallow";

import { useFlowStore } from "../../stores/flow";
import type { EdgeType, NodeType } from "../../stores/flow/types";
import {
  calculateAvoidancePath,
  DEFAULT_AVOIDANCE_CONFIG,
  buildAvoidanceNodeBounds,
  buildParallelEdgeInfo,
  type NodeBounds,
  type ParallelEdgeInfo,
} from "../../core/avoidanceUtils";
import {
  AvoidanceRouteCache,
  type AvoidanceRouteRequest,
  type NodeBoundsChange,
} from "../../core/avoidanceRoutingCache";
import type { AvoidancePathResult } from "../../core/avoidanceUtils";

export type AvoidanceRoutingContextValue = {
  nodeBoundsList: NodeBounds[];
  nodeBoundsById: ReadonlyMap<string, NodeBounds>;
  parallelEdgeInfoById: ReadonlyMap<string, ParallelEdgeInfo>;
  layoutRevision: number;
  topologyRevision: number;
  getAvoidancePath: (
    request: Omit<AvoidanceRouteRequest, "parallelEdgeInfo" | "config"> & {
      config?: AvoidanceRouteRequest["config"];
    },
  ) => AvoidancePathResult;
};

const EMPTY_NODES: NodeType[] = [];
const EMPTY_EDGES: EdgeType[] = [];
const EMPTY_BOUNDS: NodeBounds[] = [];
const EMPTY_BOUNDS_BY_ID = new Map<string, NodeBounds>();
const EMPTY_PARALLEL_EDGE_INFO = new Map<string, ParallelEdgeInfo>();
const EMPTY_CHANGED_NODE_BOUNDS = new Map<string, NodeBoundsChange>();
const EMPTY_PATH_RESULT: AvoidancePathResult = {
  path: "",
  labelX: 0,
  labelY: 0,
  points: [],
  blockingNodeIds: [],
};

const EMPTY_CONTEXT: AvoidanceRoutingContextValue = {
  nodeBoundsList: EMPTY_BOUNDS,
  nodeBoundsById: EMPTY_BOUNDS_BY_ID,
  parallelEdgeInfoById: EMPTY_PARALLEL_EDGE_INFO,
  layoutRevision: -1,
  topologyRevision: -1,
  getAvoidancePath: () => EMPTY_PATH_RESULT,
};

const AvoidanceRoutingContext = createContext<AvoidanceRoutingContextValue>(
  EMPTY_CONTEXT,
);

type AvoidanceRoutingProviderProps = PropsWithChildren<{
  enabled: boolean;
}>;

/**
 * 在画布级共享避让算法的公共输入。
 * 节点边界依赖布局修订号，平行边索引依赖拓扑修订号；单条边不再订阅整图。
 */
export function AvoidanceRoutingProvider({
  enabled,
  children,
}: AvoidanceRoutingProviderProps) {
  const { nodes, edges, layoutRevision, topologyRevision } = useFlowStore(
    useShallow((state) =>
      enabled
        ? {
            nodes: state.nodes,
            edges: state.edges,
            layoutRevision: state.layoutRevision,
            topologyRevision: state.topologyRevision,
          }
        : {
            nodes: EMPTY_NODES,
            edges: EMPTY_EDGES,
            layoutRevision: -1,
            topologyRevision: -1,
          },
    ),
  );
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const routeCacheRef = useRef(new AvoidanceRouteCache());
  const previousNodeBoundsByIdRef = useRef<ReadonlyMap<string, NodeBounds>>(
    EMPTY_BOUNDS_BY_ID,
  );
  const changedNodeBoundsRef = useRef<ReadonlyMap<string, NodeBoundsChange>>(
    EMPTY_CHANGED_NODE_BOUNDS,
  );
  const changedLayoutRevisionRef = useRef(-1);
  nodesRef.current = nodes;
  edgesRef.current = edges;

  const nodeBoundsList = useMemo(() => {
    if (!enabled || layoutRevision < 0) return EMPTY_BOUNDS;

    // buildAvoidanceNodeBounds 内部使用一次 ID Map 解析父链，避免每个节点反复扫描数组。
    return buildAvoidanceNodeBounds(nodesRef.current);
  }, [enabled, layoutRevision]);

  const nodeBoundsById = useMemo(
    () =>
      nodeBoundsList.length === 0
        ? EMPTY_BOUNDS_BY_ID
        : new Map(nodeBoundsList.map((bounds) => [bounds.id, bounds])),
    [nodeBoundsList],
  );

  const parallelEdgeInfoById = useMemo(() => {
    if (!enabled || topologyRevision < 0) return EMPTY_PARALLEL_EDGE_INFO;
    return buildParallelEdgeInfo(edgesRef.current);
  }, [enabled, topologyRevision]);

  const changedNodeBounds = useMemo(() => {
    if (!enabled || layoutRevision < 0) {
      previousNodeBoundsByIdRef.current = EMPTY_BOUNDS_BY_ID;
      changedNodeBoundsRef.current = EMPTY_CHANGED_NODE_BOUNDS;
      changedLayoutRevisionRef.current = layoutRevision;
      return EMPTY_CHANGED_NODE_BOUNDS;
    }

    if (changedLayoutRevisionRef.current === layoutRevision) {
      return changedNodeBoundsRef.current;
    }

    const previous = previousNodeBoundsByIdRef.current;
    const changes = new Map<string, NodeBoundsChange>();
    const ids = new Set([...previous.keys(), ...nodeBoundsById.keys()]);
    for (const nodeId of ids) {
      const previousBounds = previous.get(nodeId);
      const nextBounds = nodeBoundsById.get(nodeId);
      if (
        previousBounds?.minX === nextBounds?.minX &&
        previousBounds?.minY === nextBounds?.minY &&
        previousBounds?.maxX === nextBounds?.maxX &&
        previousBounds?.maxY === nextBounds?.maxY
      ) {
        continue;
      }
      changes.set(nodeId, { previous: previousBounds, next: nextBounds });
    }
    previousNodeBoundsByIdRef.current = nodeBoundsById;
    changedNodeBoundsRef.current = changes;
    changedLayoutRevisionRef.current = layoutRevision;
    return changes;
  }, [enabled, layoutRevision, nodeBoundsById]);

  useEffect(() => {
    if (!enabled) {
      routeCacheRef.current.clear();
      return;
    }
    routeCacheRef.current.invalidate(changedNodeBounds);
    routeCacheRef.current.prune(new Set(parallelEdgeInfoById.keys()));
  }, [changedNodeBounds, enabled, parallelEdgeInfoById]);

  const getAvoidancePath = useCallback(
    (
      request: Omit<AvoidanceRouteRequest, "parallelEdgeInfo" | "config"> & {
        config?: AvoidanceRouteRequest["config"];
      },
    ): AvoidancePathResult => {
      if (!enabled) return EMPTY_PATH_RESULT;

      const config = request.config ?? DEFAULT_AVOIDANCE_CONFIG;
      const parallelEdgeInfo = parallelEdgeInfoById.get(request.edgeId);
      const fullRequest: AvoidanceRouteRequest = {
        ...request,
        config,
        parallelEdgeInfo,
      };

      return routeCacheRef.current.get(
        fullRequest,
        nodeBoundsById,
        changedNodeBounds,
        () =>
          calculateAvoidancePath(
            request.sourceXY,
            request.targetXY,
            request.sourcePosition,
            request.targetPosition,
            nodeBoundsList,
            new Set([request.sourceId, request.targetId]),
            config,
            parallelEdgeInfo?.edgeIndex ?? 0,
            parallelEdgeInfo?.totalParallelEdges ?? 1,
          ),
      );
    },
    [
      changedNodeBounds,
      enabled,
      nodeBoundsById,
      nodeBoundsList,
      parallelEdgeInfoById,
    ],
  );

  const value = useMemo<AvoidanceRoutingContextValue>(
    () => ({
      nodeBoundsList,
      nodeBoundsById,
      parallelEdgeInfoById,
      layoutRevision,
      topologyRevision,
      getAvoidancePath,
    }),
    [
      layoutRevision,
      nodeBoundsById,
      nodeBoundsList,
      parallelEdgeInfoById,
      getAvoidancePath,
      topologyRevision,
    ],
  );

  return (
    <AvoidanceRoutingContext.Provider value={value}>
      {children}
    </AvoidanceRoutingContext.Provider>
  );
}

export function useAvoidanceRoutingContext(): AvoidanceRoutingContextValue {
  return useContext(AvoidanceRoutingContext);
}
