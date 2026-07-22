import ELK from "elkjs/lib/elk.bundled.js";

import { NodeTypeEnum } from "../../components/flow/nodes";
import type { NodeType } from "../../stores/flow";
import type { PipelineFlowProjection } from "./types";

const elk = new ELK();
const layoutOptions = {
  "elk.algorithm": "layered",
  "elk.direction": "RIGHT",
  "elk.layered.spacing.nodeNodeBetweenLayers": "100",
  "elk.spacing.nodeNode": "80",
  "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
  "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
  "elk.layered.cycleBreaking.strategy": "GREEDY",
};

export async function layoutPipelineProjection(
  projection: PipelineFlowProjection,
): Promise<PipelineFlowProjection> {
  if (projection.hasAuthoredPositions || projection.nodes.length === 0) {
    return projection;
  }
  let result;
  try {
    result = await elk.layout({
      id: "pipeline-projection",
      layoutOptions,
      children: projection.nodes.map((node) => ({
        id: node.id,
        width: nodeDimension(node, "width"),
        height: nodeDimension(node, "height"),
      })),
      edges: projection.edges.map((edge) => ({
        id: edge.id,
        sources: [edge.source],
        targets: [edge.target],
      })),
    });
  } catch (error) {
    console.error("Pipeline projection layout failed:", error);
    return projection;
  }
  const positions = new Map(
    result.children?.map((node) => [
      node.id,
      { x: node.x ?? 0, y: node.y ?? 0 },
    ]) ?? [],
  );
  return {
    ...projection,
    nodes: projection.nodes.map((node) => ({
      ...node,
      position: positions.get(node.id) ?? node.position,
    })),
  };
}

function nodeDimension(node: NodeType, dimension: "width" | "height"): number {
  const measured = node.measured?.[dimension];
  if (typeof measured === "number") return measured;
  const styled = (node as NodeType & { style?: Record<string, unknown> }).style?.[
    dimension
  ];
  if (typeof styled === "number") return styled;
  if (node.type === NodeTypeEnum.Group) return dimension === "width" ? 400 : 300;
  if (node.type === NodeTypeEnum.Sticker) return dimension === "width" ? 180 : 140;
  return dimension === "width" ? 280 : 180;
}
