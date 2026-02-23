import { type NodeChange } from "@xyflow/react";
import ELK from "elkjs/lib/elk.bundled.js";

import { useFlowStore, type EdgeType, type NodeType } from "../stores/flow";

export enum AlignmentEnum {
  Top,
  Bottom,
  Center,
}

// Elkjs 实例
const elk = new ELK();

// Elkjs 布局配置
const elkOptions = {
  "elk.algorithm": "layered",
  "elk.direction": "RIGHT", // 从左到右布局
  // 层级间距
  "elk.layered.spacing.nodeNodeBetweenLayers": "100",
  // 同层节点间距
  "elk.spacing.nodeNode": "80",
  // 交叉最小化策略
  "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
  "elk.layered.crossingMinimization.semiInteractiveCrossingMinimization":
    "true",
  // 节点放置策略
  "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
  // 分层策略
  "elk.layered.cycleBreaking.strategy": "GREEDY",
  // 边路由
  "elk.edgeRouting": "ORTHOGONAL",
  // 紧凑模式
  "elk.compaction.postCompaction.strategy": "LEFT_RIGHT_CONSTRAINT_LOCKING",
  // 自环处理
  "elk.layered.selfLoopPlacement": "NORTH",
};

export class LayoutHelper {
  // 自动布局
  static auto() {
    requestAnimationFrame(() => LayoutHelper.performLayout());
  }

  // 执行布局计算
  private static async performLayout() {
    // 加载节点
    const flowState = useFlowStore.getState();
    const nodes = flowState.nodes as NodeType[];
    const edges = flowState.edges as EdgeType[];

    // 空图直接返回
    if (nodes.length === 0) return;

    // 检查节点是否已测量
    const allMeasured = nodes.every(
      (node) => node.measured?.width && node.measured?.height
    );
    if (!allMeasured) {
      setTimeout(() => {
        LayoutHelper.performLayout();
      }, 10);
      return;
    }

    // 构建 Elkjs 图结构
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
      // 执行布局
      const layoutedGraph = await elk.layout(graph);

      if (!layoutedGraph?.children) return;

      // 更新节点位置
      const layoutedNodes = nodes.map((node) => {
        const layoutedNode = layoutedGraph.children!.find(
          (n) => n.id === node.id
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

  // 对齐
  static align(direction: AlignmentEnum, nodes: NodeType[]) {
    if (nodes.length < 2) return;

    // 计算合适位置
    switch (direction) {
      case AlignmentEnum.Center:
        const left = Math.min(...nodes.map((node) => node.position.x));
        nodes.forEach((node) => (node.position.x = left));
        break;
      case AlignmentEnum.Top:
        const top = Math.min(...nodes.map((node) => node.position.y));
        nodes.forEach((node) => (node.position.y = top));
        break;
      case AlignmentEnum.Bottom:
        const bottom = Math.max(
          ...nodes.map((node) => node.position.y + (node.measured?.height ?? 0))
        );
        nodes.forEach(
          (node) => (node.position.y = bottom - (node.measured?.height ?? 0))
        );
        break;
    }

    // 生成change
    const changes = nodes.map((node) => ({
      id: node.id,
      type: "position",
      position: node.position,
    })) as NodeChange[];
    useFlowStore.getState().updateNodes(changes);
  }
}
