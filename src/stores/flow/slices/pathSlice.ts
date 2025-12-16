import type { StateCreator } from "zustand";
import type { FlowStore, FlowPathState, EdgeType } from "../types";

/**
 * 使用BFS查找从起始节点到结束节点的路径
 * @returns 路径上的节点ID数组（包含起始和结束节点），如果没有路径则返回null
 */
function findPath(
  startId: string,
  endId: string,
  edges: EdgeType[]
): { nodeIds: string[]; edgeIds: string[] } | null {
  if (startId === endId) {
    return { nodeIds: [startId], edgeIds: [] };
  }

  // 构建邻接表
  const adjacencyList = new Map<string, { nodeId: string; edgeId: string }[]>();
  for (const edge of edges) {
    if (!adjacencyList.has(edge.source)) {
      adjacencyList.set(edge.source, []);
    }
    adjacencyList.get(edge.source)!.push({
      nodeId: edge.target,
      edgeId: edge.id,
    });
  }

  // BFS 查找路径
  const visited = new Set<string>();
  const queue: { nodeId: string; path: string[]; edgePath: string[] }[] = [
    { nodeId: startId, path: [startId], edgePath: [] },
  ];
  visited.add(startId);

  while (queue.length > 0) {
    const { nodeId, path, edgePath } = queue.shift()!;

    const neighbors = adjacencyList.get(nodeId) || [];
    for (const neighbor of neighbors) {
      if (neighbor.nodeId === endId) {
        return {
          nodeIds: [...path, endId],
          edgeIds: [...edgePath, neighbor.edgeId],
        };
      }

      if (!visited.has(neighbor.nodeId)) {
        visited.add(neighbor.nodeId);
        queue.push({
          nodeId: neighbor.nodeId,
          path: [...path, neighbor.nodeId],
          edgePath: [...edgePath, neighbor.edgeId],
        });
      }
    }
  }

  return null;
}

export const createPathSlice: StateCreator<FlowStore, [], [], FlowPathState> = (
  set,
  get
) => ({
  // 初始状态
  pathMode: false,
  pathStartNodeId: null,
  pathEndNodeId: null,
  pathNodeIds: new Set<string>(),
  pathEdgeIds: new Set<string>(),

  // 设置路径模式
  setPathMode(enabled: boolean) {
    set({ pathMode: enabled });
    if (!enabled) {
      get().clearPath();
    }
  },

  // 设置起始节点
  setPathStartNode(nodeId: string | null) {
    set({ pathStartNodeId: nodeId });
    // 计算路径
    if (nodeId && get().pathEndNodeId) {
      get().calculatePath();
    } else {
      // 清除路径
      set({ pathNodeIds: new Set<string>(), pathEdgeIds: new Set<string>() });
    }
  },

  // 设置结束节点
  setPathEndNode(nodeId: string | null) {
    set({ pathEndNodeId: nodeId });
    // 计算路径
    if (nodeId && get().pathStartNodeId) {
      get().calculatePath();
    } else {
      // 清除路径
      set({ pathNodeIds: new Set<string>(), pathEdgeIds: new Set<string>() });
    }
  },

  // 计算路径
  calculatePath() {
    const { pathStartNodeId, pathEndNodeId, edges } = get();
    if (!pathStartNodeId || !pathEndNodeId) {
      set({ pathNodeIds: new Set<string>(), pathEdgeIds: new Set<string>() });
      return;
    }

    const result = findPath(pathStartNodeId, pathEndNodeId, edges);
    if (result) {
      set({
        pathNodeIds: new Set(result.nodeIds),
        pathEdgeIds: new Set(result.edgeIds),
      });
    } else {
      // 没有找到路径
      set({ pathNodeIds: new Set<string>(), pathEdgeIds: new Set<string>() });
    }
  },

  // 清除路径
  clearPath() {
    set({
      pathStartNodeId: null,
      pathEndNodeId: null,
      pathNodeIds: new Set<string>(),
      pathEdgeIds: new Set<string>(),
    });
  },
});
