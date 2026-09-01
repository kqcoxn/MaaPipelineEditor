import { useCallback, useRef, useState } from "react";
import type { NodeChange } from "@xyflow/react";
import { useFlowStore, type NodeType } from "../../stores/flow";
import {
  createNodeSnapSession,
  queryNodeSnapSession,
  type NodeSnapSession,
} from "../../core/nodeSnapSession";
import type { SnapGuideline } from "../../core/snapUtils";

type ActiveNodeSnapSession = {
  session: NodeSnapSession;
  draggedNodeKey: string;
  viewportKey: string;
};

type UseNodeSnapOptions = {
  enabled: boolean;
  onlyInViewport: boolean;
  updateNodes: (changes: NodeChange[]) => void;
};

function getDraggedNodeKey(draggedNodes: NodeType[]): string {
  return draggedNodes.map((node) => node.id).join("\u0000");
}

function getTopLevelDraggedNodes(
  draggedNodes: NodeType[],
  nodeById: ReadonlyMap<string, NodeType>,
): NodeType[] {
  const draggedNodeIds = new Set(draggedNodes.map((node) => node.id));
  const draggedNodeById = new Map(
    draggedNodes.map((node) => [node.id, node]),
  );

  return draggedNodes.filter((node) => {
    const visited = new Set<string>();
    let parentId = (node as NodeType & { parentId?: string }).parentId;
    while (parentId && !visited.has(parentId)) {
      if (draggedNodeIds.has(parentId)) return false;
      visited.add(parentId);
      const parent = draggedNodeById.get(parentId) ?? nodeById.get(parentId);
      parentId = (parent as (NodeType & { parentId?: string }) | undefined)
        ?.parentId;
    }
    return true;
  });
}

export function useNodeSnap({
  enabled,
  onlyInViewport,
  updateNodes,
}: UseNodeSnapOptions) {
  const [guidelines, setGuidelines] = useState<SnapGuideline[]>([]);
  const activeSessionRef = useRef<ActiveNodeSnapSession | null>(null);

  const getViewportKey = useCallback(() => {
    if (!onlyInViewport) return "all";
    const { viewport, size } = useFlowStore.getState();
    return `${viewport.x}:${viewport.y}:${viewport.zoom}:${size.width}:${size.height}`;
  }, [onlyInViewport]);

  const buildSession = useCallback(
    (draggedNodes: NodeType[]) => {
      const state = useFlowStore.getState();
      const activeSession = {
        session: createNodeSnapSession({
          nodes: state.nodes,
          nodeById: state.nodeById,
          draggedNodes,
          viewport: onlyInViewport
            ? { ...state.viewport, ...state.size }
            : undefined,
        }),
        draggedNodeKey: getDraggedNodeKey(draggedNodes),
        viewportKey: getViewportKey(),
      };
      activeSessionRef.current = activeSession;
      return activeSession.session;
    },
    [getViewportKey, onlyInViewport],
  );

  const getSession = useCallback(
    (draggedNodes: NodeType[]) => {
      const state = useFlowStore.getState();
      const activeSession = activeSessionRef.current;
      if (
        !activeSession ||
        activeSession.session.nodeById !== state.nodeById ||
        activeSession.draggedNodeKey !== getDraggedNodeKey(draggedNodes) ||
        activeSession.viewportKey !== getViewportKey()
      ) {
        return buildSession(draggedNodes);
      }
      return activeSession.session;
    },
    [buildSession, getViewportKey],
  );

  const applySnap = useCallback(
    (draggedNode: NodeType, eventDraggedNodes: NodeType[], dragging: boolean) => {
      const draggedNodes =
        eventDraggedNodes.length > 0 ? eventDraggedNodes : [draggedNode];
      const session = getSession(draggedNodes);
      if (session.index.candidateCount === 0) {
        setGuidelines([]);
        return;
      }

      const result = queryNodeSnapSession(
        session,
        draggedNode,
        draggedNodes,
      );
      setGuidelines(result.guidelines);
      if (result.delta.x === 0 && result.delta.y === 0) return;

      updateNodes(
        getTopLevelDraggedNodes(draggedNodes, session.nodeById).map((node) => ({
          type: "position" as const,
          id: node.id,
          position: {
            x: node.position.x + result.delta.x,
            y: node.position.y + result.delta.y,
          },
          dragging,
        })),
      );
    },
    [getSession, updateNodes],
  );

  const start = useCallback(
    (draggedNode: NodeType, eventDraggedNodes: NodeType[]) => {
      if (!enabled) {
        activeSessionRef.current = null;
        return;
      }
      buildSession(
        eventDraggedNodes.length > 0 ? eventDraggedNodes : [draggedNode],
      );
    },
    [buildSession, enabled],
  );

  const update = useCallback(
    (draggedNode: NodeType, eventDraggedNodes: NodeType[]) => {
      if (enabled) applySnap(draggedNode, eventDraggedNodes, true);
    },
    [applySnap, enabled],
  );

  const stop = useCallback(
    (draggedNode: NodeType, eventDraggedNodes: NodeType[]) => {
      if (enabled) applySnap(draggedNode, eventDraggedNodes, false);
      activeSessionRef.current = null;
      setGuidelines([]);
    },
    [applySnap, enabled],
  );

  return { guidelines, start, update, stop };
}
