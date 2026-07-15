import { useMemo } from "react";
import { useShallow } from "zustand/shallow";

import { useFlowStore } from "../../../../stores/flow";
import {
  NodeTypeEnum,
  SourceHandleTypeEnum,
  TargetHandleTypeEnum,
} from "../constants";

type NodeFlowItem = {
  label: string;
  variant: "normal" | "jumpback" | "anchor";
};

export function useNodeFlowItems(nodeId: string) {
  const edges = useFlowStore((state) => state.edges);
  const outEdges = useMemo(
    () =>
      edges
        .filter((edge) => edge.source === nodeId)
        .sort((a, b) => a.label - b.label),
    [edges, nodeId],
  );
  const targetNodeIds = useMemo(
    () => new Set(outEdges.map((edge) => edge.target)),
    [outEdges],
  );
  const targetNodes = useFlowStore(
    useShallow((state) =>
      state.nodes.filter((node) => targetNodeIds.has(node.id)),
    ),
  );

  return useMemo(() => {
    const nodeMap = new Map(targetNodes.map((node) => [node.id, node]));
    const nextItems: NodeFlowItem[] = [];
    const errorItems: NodeFlowItem[] = [];

    for (const edge of outEdges) {
      const targetNode = nodeMap.get(edge.target);
      const label = targetNode?.data.label ?? edge.target;
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
  }, [outEdges, targetNodes]);
}
