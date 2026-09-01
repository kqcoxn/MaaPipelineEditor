import type { FitViewOptions } from "@xyflow/react";
import { NodeTypeEnum } from "@/components/flow/nodes/constants";
import {
  getNodeTypeLabelKey,
  getRuntimeNodeAbsoluteRect,
  useFlowStore,
  type NodeType,
} from "@/stores/flow";

interface CenterNodeOptions {
  duration?: number;
  select?: boolean;
  zoom?: number;
}

interface FitNodeIdsOptions
  extends Pick<
    FitViewOptions,
    "duration" | "interpolate" | "maxZoom" | "minZoom" | "padding"
  > {
  delay?: number;
  select?: boolean;
}

const NODE_TYPES = Object.values(NodeTypeEnum);

export function findNodeIdByLabel(
  label: string,
  nodeType?: NodeTypeEnum,
): string | undefined {
  const { nodeIdsByTypeAndLabel } = useFlowStore.getState();
  const types = nodeType ? [nodeType] : NODE_TYPES;

  for (const type of types) {
    const ids = nodeIdsByTypeAndLabel.get(getNodeTypeLabelKey(type, label));
    const id = ids?.values().next().value;
    if (id) return id;
  }

  return undefined;
}

export function selectAndCenterNode(
  nodeId: string,
  options: CenterNodeOptions = {},
): boolean {
  const state = useFlowStore.getState();
  const targetNode = state.nodeById.get(nodeId);
  if (!targetNode) return false;

  if (options.select !== false) {
    state.selectNodeIds([nodeId]);
  }

  const rect = getRuntimeNodeAbsoluteRect(
    state.instance,
    nodeId,
    targetNode,
    state.nodeById,
  );
  if (state.instance && rect) {
    void state.instance.setCenter(
      rect.x + rect.width / 2,
      rect.y + rect.height / 2,
      {
        duration: options.duration ?? 500,
        zoom: options.zoom ?? 1.5,
      },
    );
  }

  return true;
}

export function selectAndFitNodeIds(
  nodeIds: readonly string[],
  options: FitNodeIdsOptions = {},
): NodeType[] {
  const state = useFlowStore.getState();
  const uniqueNodeIds = new Set(nodeIds);
  const targetNodes = [...uniqueNodeIds]
    .map((id) => state.nodeById.get(id))
    .filter((node): node is NodeType => node !== undefined);
  if (targetNodes.length === 0) return [];

  if (options.select !== false) {
    state.selectNodeIds(targetNodes.map((node) => node.id));
  }

  const fitView = () => {
    void useFlowStore.getState().instance?.fitView({
      nodes: targetNodes,
      duration: options.duration,
      interpolate: options.interpolate,
      maxZoom: options.maxZoom,
      minZoom: options.minZoom,
      padding: options.padding,
    });
  };

  if ((options.delay ?? 0) > 0) {
    window.setTimeout(fitView, options.delay);
  } else {
    fitView();
  }

  return targetNodes;
}
