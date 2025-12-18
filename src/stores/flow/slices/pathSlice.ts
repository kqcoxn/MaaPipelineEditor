import type { StateCreator } from "zustand";
import type { FlowStore, FlowPathState, EdgeType } from "../types";

/**
 * 查找从起始节点到结束节点之间所有可达路径上的节点和边
 * 使用 DFS 遍历所有可能的路径，收集途经的所有节点和边
 * @returns 所有路径上的节点ID集合和边ID集合，如果没有任何路径则返回null
 */
function findAllReachablePaths(
  startId: string,
  endId: string,
  edges: EdgeType[]
): { nodeIds: Set<string>; edgeIds: Set<string> } | null {
  if (startId === endId) {
    return { nodeIds: new Set([startId]), edgeIds: new Set() };
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

  // 结果集合
  const resultNodeIds = new Set<string>();
  const resultEdgeIds = new Set<string>();
  let foundAnyPath = false;

  // DFS 查找所有路径
  function dfs(
    currentId: string,
    pathNodes: Set<string>,
    pathEdges: Set<string>
  ): boolean {
    if (currentId === endId) {
      // 将路径上的所有节点和边加入结果集合
      for (const nodeId of pathNodes) {
        resultNodeIds.add(nodeId);
      }
      resultNodeIds.add(endId);
      for (const edgeId of pathEdges) {
        resultEdgeIds.add(edgeId);
      }
      return true;
    }

    const neighbors = adjacencyList.get(currentId) || [];
    let reachable = false;

    for (const neighbor of neighbors) {
      if (pathNodes.has(neighbor.nodeId)) {
        continue;
      }

      // 继续 DFS
      pathNodes.add(neighbor.nodeId);
      pathEdges.add(neighbor.edgeId);

      if (dfs(neighbor.nodeId, pathNodes, pathEdges)) {
        reachable = true;
        foundAnyPath = true;
      }

      pathNodes.delete(neighbor.nodeId);
      pathEdges.delete(neighbor.edgeId);
    }

    return reachable;
  }

  // 从起始节点开始 DFS
  const initialPathNodes = new Set<string>([startId]);
  const initialPathEdges = new Set<string>();
  dfs(startId, initialPathNodes, initialPathEdges);

  if (foundAnyPath) {
    return { nodeIds: resultNodeIds, edgeIds: resultEdgeIds };
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

    const result = findAllReachablePaths(pathStartNodeId, pathEndNodeId, edges);
    if (result) {
      set({
        pathNodeIds: result.nodeIds,
        pathEdgeIds: result.edgeIds,
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
