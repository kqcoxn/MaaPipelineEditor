import { useMemo } from "react";

import { useFlowStore } from "../../../../stores/flow";
import {
  NodeTypeEnum,
  SourceHandleTypeEnum,
  TargetHandleTypeEnum,
} from "../constants";
import type { EdgeType } from "../../../../stores/flow";

type NodeFlowItem = {
  label: string;
  variant: "normal" | "jumpback" | "anchor";
};

const EMPTY_EDGE_IDS: string[] = [];

export function useNodeFlowItems(nodeId: string) {
  const graphRevision = useFlowStore(
    (state) => `${state.semanticRevision}:${state.topologyRevision}`,
  );

  return useMemo(() => {
    // The revision is the invalidation key; read the matching snapshot below.
    void graphRevision;
    const state = useFlowStore.getState();
    const outEdges = (state.outgoingEdgeIdsByNodeId.get(nodeId) ?? EMPTY_EDGE_IDS)
      .map((edgeId) => state.edgeById.get(edgeId))
      .filter((edge): edge is EdgeType => edge !== undefined);
    const nextItems: NodeFlowItem[] = [];
    const errorItems: NodeFlowItem[] = [];

    const sortedEdges = outEdges
      .map((edge) => ({
        edge,
        targetNode: state.nodeSemanticById.get(edge.target),
      }))
      .sort((left, right) => left.edge.label - right.edge.label);
    for (const { edge, targetNode } of sortedEdges) {
      const label = targetNode?.label ?? edge.target;
      const isJumpBack = edge.targetHandle === TargetHandleTypeEnum.JumpBack;
      const isAnchor =
        targetNode?.type === NodeTypeEnum.Anchor || !!edge.attributes?.anchor;
      const variant = isJumpBack ? "jumpback" : isAnchor ? "anchor" : "normal";

      if (edge.sourceHandle === SourceHandleTypeEnum.Next) {
        nextItems.push({ label, variant });
      } else if (edge.sourceHandle === SourceHandleTypeEnum.Error) {
        errorItems.push({ label, variant });
      }
    }

    return { nextItems, errorItems };
  }, [graphRevision, nodeId]);
}
