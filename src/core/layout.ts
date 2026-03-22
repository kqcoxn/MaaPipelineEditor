import { type NodeChange } from "@xyflow/react";
import ELK from "elkjs/lib/elk.bundled.js";

import { useFlowStore, type EdgeType, type NodeType } from "../stores/flow";

export enum AlignmentEnum {
  Left,
  Right,
  Top,
  Bottom,
  Center,
  Middle,
}

const elk = new ELK();

const elkOptions = {
  "elk.algorithm": "layered",
  "elk.direction": "RIGHT",
  "elk.layered.spacing.nodeNodeBetweenLayers": "100",
  "elk.spacing.nodeNode": "80",
  "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
  "elk.layered.crossingMinimization.semiInteractiveCrossingMinimization":
    "true",
  "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
  "elk.layered.cycleBreaking.strategy": "GREEDY",
  "elk.compaction.postCompaction.strategy": "LEFT_RIGHT_CONSTRAINT_LOCKING",
  "elk.layered.selfLoopPlacement": "NORTH",
};

export class LayoutHelper {
  static auto() {
    requestAnimationFrame(() => LayoutHelper.performLayout());
  }

  private static async performLayout() {
    const flowState = useFlowStore.getState();
    const nodes = flowState.nodes as NodeType[];
    const edges = flowState.edges as EdgeType[];

    if (nodes.length === 0) return;

    const allMeasured = nodes.every(
      (node) => node.measured?.width && node.measured?.height,
    );
    if (!allMeasured) {
      setTimeout(() => {
        LayoutHelper.performLayout();
      }, 10);
      return;
    }

    const graph = {
      id: "root",
      layoutOptions: elkOptions,
      children: nodes.map((node) => ({
        id: node.id,
        width: node.measured?.width ?? 200,
        height: node.measured?.height ?? 100,
      })),
      edges: edges.map((edge) => ({
        id: edge.id,
        sources: [edge.source],
        targets: [edge.target],
      })),
    };

    try {
      const layoutedGraph = await elk.layout(graph);

      if (!layoutedGraph?.children) return;

      const layoutedNodes = nodes.map((node) => {
        const layoutedNode = layoutedGraph.children!.find(
          (layoutNode) => layoutNode.id === node.id,
        );
        if (!layoutedNode) return node;
        return {
          ...node,
          position: {
            x: layoutedNode.x ?? 0,
            y: layoutedNode.y ?? 0,
          },
        };
      });

      flowState.replace(layoutedNodes, edges);
    } catch (error) {
      console.error("Elkjs layout error:", error);
    }
  }

  static align(direction: AlignmentEnum, nodes: NodeType[]) {
    if (nodes.length < 2) return;

    switch (direction) {
      case AlignmentEnum.Left: {
        const left = Math.min(...nodes.map((node) => node.position.x));
        nodes.forEach((node) => (node.position.x = left));
        break;
      }
      case AlignmentEnum.Right: {
        const right = Math.max(
          ...nodes.map((node) => node.position.x + (node.measured?.width ?? 0)),
        );
        nodes.forEach(
          (node) => (node.position.x = right - (node.measured?.width ?? 0)),
        );
        break;
      }
      case AlignmentEnum.Top: {
        const top = Math.min(...nodes.map((node) => node.position.y));
        nodes.forEach((node) => (node.position.y = top));
        break;
      }
      case AlignmentEnum.Bottom: {
        const bottom = Math.max(
          ...nodes.map(
            (node) => node.position.y + (node.measured?.height ?? 0),
          ),
        );
        nodes.forEach(
          (node) => (node.position.y = bottom - (node.measured?.height ?? 0)),
        );
        break;
      }
      case AlignmentEnum.Center: {
        const left = Math.min(...nodes.map((node) => node.position.x));
        const right = Math.max(
          ...nodes.map((node) => node.position.x + (node.measured?.width ?? 0)),
        );
        const center = (left + right) / 2;
        nodes.forEach(
          (node) =>
            (node.position.x = center - (node.measured?.width ?? 0) / 2),
        );
        break;
      }
      case AlignmentEnum.Middle: {
        const top = Math.min(...nodes.map((node) => node.position.y));
        const bottom = Math.max(
          ...nodes.map(
            (node) => node.position.y + (node.measured?.height ?? 0),
          ),
        );
        const middle = (top + bottom) / 2;
        nodes.forEach(
          (node) =>
            (node.position.y = middle - (node.measured?.height ?? 0) / 2),
        );
        break;
      }
    }

    const changes = nodes.map((node) => ({
      id: node.id,
      type: "position",
      position: node.position,
    })) as NodeChange[];
    useFlowStore.getState().updateNodes(changes);
  }
}
