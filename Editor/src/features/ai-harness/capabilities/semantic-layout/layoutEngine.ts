import type { NodeType } from "@/stores/flow";
import type { CanvasGraphState } from "../canvas/commandBus";
import { isSemanticLayoutNode } from "./semanticGraph";
import { layoutNodesInSemanticBlocks } from "./blockLayout";
import type {
  SemanticLayoutIntent,
  SemanticLayoutLane,
  SemanticLayoutResult,
} from "./types";

export class SemanticLayoutError extends Error {}

export async function calculateSemanticLayout(
  graph: CanvasGraphState,
  intent: SemanticLayoutIntent,
): Promise<SemanticLayoutResult> {
  const layoutableNodes = graph.nodes.filter(isSemanticLayoutNode);
  if (layoutableNodes.length === 0) {
    throw new SemanticLayoutError("当前画布没有可语义重排的顶层流程节点");
  }
  const { lanes, autoAssignedNodeIds } = normalizeLanes(
    layoutableNodes,
    intent.lanes,
  );
  validateRelations(lanes, intent.relations);
  const positions = layoutNodesInSemanticBlocks(
    layoutableNodes,
    graph.edges,
    lanes,
    intent.relations,
    intent.direction,
  );
  preserveCanvasOrigin(positions, layoutableNodes);
  return {
    positions,
    laneCount: lanes.length,
    autoAssignedNodeIds,
  };
}

function normalizeLanes(
  nodes: NodeType[],
  requestedLanes: SemanticLayoutLane[],
): { lanes: SemanticLayoutLane[]; autoAssignedNodeIds: string[] } {
  const validNodeIds = new Set(nodes.map((node) => node.id));
  const laneIds = new Set<string>();
  const assignedNodeIds = new Set<string>();
  const lanes = requestedLanes.map((lane) => {
    if (laneIds.has(lane.id)) {
      throw new SemanticLayoutError(`布局泳道 ID 重复: ${lane.id}`);
    }
    laneIds.add(lane.id);
    lane.nodeIds.forEach((nodeId) => {
      if (!validNodeIds.has(nodeId)) {
        throw new SemanticLayoutError(`布局泳道引用了不可用节点: ${nodeId}`);
      }
      if (assignedNodeIds.has(nodeId)) {
        throw new SemanticLayoutError(`节点被分配到多个布局泳道: ${nodeId}`);
      }
      assignedNodeIds.add(nodeId);
    });
    if (lane.anchorNodeId && !validNodeIds.has(lane.anchorNodeId)) {
      throw new SemanticLayoutError(
        `布局泳道引用了不可用锚定节点: ${lane.anchorNodeId}`,
      );
    }
    return { ...lane, nodeIds: [...lane.nodeIds] };
  });
  const autoAssignedNodeIds = nodes
    .map((node) => node.id)
    .filter((nodeId) => !assignedNodeIds.has(nodeId));
  autoAssignedNodeIds.forEach((nodeId, index) => {
    lanes.push({
      id: `auto_lane_${index + 1}`,
      role: "support",
      nodeIds: [nodeId],
    });
  });
  return { lanes, autoAssignedNodeIds };
}

function validateRelations(
  lanes: SemanticLayoutLane[],
  relations: SemanticLayoutIntent["relations"],
): void {
  const laneIds = new Set(lanes.map((lane) => lane.id));
  relations.forEach((relation) => {
    if (!laneIds.has(relation.sourceLaneId)) {
      throw new SemanticLayoutError(
        `布局关系引用了未知来源泳道: ${relation.sourceLaneId}`,
      );
    }
    if (!laneIds.has(relation.targetLaneId)) {
      throw new SemanticLayoutError(
        `布局关系引用了未知目标泳道: ${relation.targetLaneId}`,
      );
    }
    if (relation.sourceLaneId === relation.targetLaneId) {
      throw new SemanticLayoutError("布局关系不能指向同一泳道");
    }
  });
}

function preserveCanvasOrigin(
  positions: Record<string, { x: number; y: number }>,
  originalNodes: NodeType[],
): void {
  const originalMinX = Math.min(...originalNodes.map((node) => node.position.x));
  const originalMinY = Math.min(...originalNodes.map((node) => node.position.y));
  const nextPositions = Object.values(positions);
  const nextMinX = Math.min(...nextPositions.map((position) => position.x));
  const nextMinY = Math.min(...nextPositions.map((position) => position.y));
  Object.values(positions).forEach((position) => {
    position.x += originalMinX - nextMinX;
    position.y += originalMinY - nextMinY;
  });
}
