import { useMemo } from "react";
import { useShallow } from "zustand/shallow";

import { useFlowStore } from "@/stores/flow";

const useFocusInputs = () =>
  useFlowStore(
    useShallow((state) => ({
      selectedNodeIds: state.selectedNodeIds,
      selectedEdgeIds: state.selectedEdgeIds,
      selectedEdgeEndpointNodeIds: state.selectedEdgeEndpointNodeIds,
      hasSelectedSticker: state.hasSelectedSticker,
      nodeById: state.nodeById,
      outgoingEdgeIdsByNodeId: state.outgoingEdgeIdsByNodeId,
      incomingEdgeIdsByNodeId: state.incomingEdgeIdsByNodeId,
      edgeById: state.edgeById,
      pathMode: state.pathMode,
      pathNodeIds: state.pathNodeIds,
      pathEdgeIds: state.pathEdgeIds,
      anchorRefHighlightedNodeIds: state.anchorRefHighlightedNodeIds,
    })),
  );

interface NodeFocusOptions {
  nodeId: string;
  selected: boolean;
  focusOpacity: number;
  includeAnchorReference?: boolean;
}

export function useNodeFocusState({
  nodeId,
  selected,
  focusOpacity,
  includeAnchorReference = false,
}: NodeFocusOptions): {
  isRelated: boolean;
  isAnchorRefHighlighted: boolean;
} {
  const focusInputs = useFocusInputs();

  return useMemo(() => {
      const isAnchorRefHighlighted =
        includeAnchorReference &&
        focusInputs.anchorRefHighlightedNodeIds.has(nodeId);

      if (focusOpacity === 1 || selected) {
        return { isRelated: true, isAnchorRefHighlighted };
      }
      if (focusInputs.pathMode && focusInputs.pathNodeIds.size > 0) {
        return {
          isRelated: focusInputs.pathNodeIds.has(nodeId),
          isAnchorRefHighlighted,
        };
      }
      if (isAnchorRefHighlighted) {
        return { isRelated: true, isAnchorRefHighlighted };
      }
      if (
        focusInputs.selectedNodeIds.size === 0 &&
        focusInputs.selectedEdgeIds.size === 0
      ) {
        return { isRelated: true, isAnchorRefHighlighted };
      }
      if (focusInputs.hasSelectedSticker) {
        return { isRelated: true, isAnchorRefHighlighted };
      }

      const parentId = (
        focusInputs.nodeById.get(nodeId) as
          | { parentId?: string }
          | undefined
      )?.parentId;
      if (parentId && focusInputs.selectedNodeIds.has(parentId)) {
        return { isRelated: true, isAnchorRefHighlighted };
      }
      if (focusInputs.selectedEdgeEndpointNodeIds.has(nodeId)) {
        return { isRelated: true, isAnchorRefHighlighted };
      }

      if (focusInputs.selectedNodeIds.size > 0) {
        const outgoingIds =
          focusInputs.outgoingEdgeIdsByNodeId.get(nodeId) ?? [];
        for (const edgeId of outgoingIds) {
          const targetId = focusInputs.edgeById.get(edgeId)?.target;
          if (targetId && focusInputs.selectedNodeIds.has(targetId)) {
            return { isRelated: true, isAnchorRefHighlighted };
          }
        }
        const incomingIds =
          focusInputs.incomingEdgeIdsByNodeId.get(nodeId) ?? [];
        for (const edgeId of incomingIds) {
          const sourceId = focusInputs.edgeById.get(edgeId)?.source;
          if (sourceId && focusInputs.selectedNodeIds.has(sourceId)) {
            return { isRelated: true, isAnchorRefHighlighted };
          }
        }
      }

      return { isRelated: false, isAnchorRefHighlighted };
  }, [focusInputs, focusOpacity, includeAnchorReference, nodeId, selected]);
}

interface EdgeFocusOptions {
  edgeId: string;
  sourceId: string;
  targetId: string;
  selected: boolean;
  focusOpacity: number;
}

export function useEdgeFocusRelated({
  edgeId,
  sourceId,
  targetId,
  selected,
  focusOpacity,
}: EdgeFocusOptions): boolean {
  const focusInputs = useFocusInputs();

  return useMemo(() => {
    if (focusOpacity === 1) return true;
    if (focusInputs.pathMode && focusInputs.pathEdgeIds.size > 0) {
      return focusInputs.pathEdgeIds.has(edgeId);
    }
    if (
      focusInputs.selectedNodeIds.size === 0 &&
      focusInputs.selectedEdgeIds.size === 0
    ) {
      return true;
    }
    if (selected || focusInputs.hasSelectedSticker) return true;
    return (
      focusInputs.selectedNodeIds.has(sourceId) ||
      focusInputs.selectedNodeIds.has(targetId)
    );
  }, [edgeId, focusInputs, focusOpacity, selected, sourceId, targetId]);
}
