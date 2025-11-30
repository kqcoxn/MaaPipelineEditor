import { type NodeChange } from "@xyflow/react";
import Dagre from "@dagrejs/dagre";

import {
  useFlowStore,
  type EdgeType,
  type NodeType,
} from "../stores/flow";

export enum AlignmentEnum {
  Top,
  Bottom,
  Center,
}

export class LayoutHelper {
  // 自动布局
  static auto() {
    requestAnimationFrame(() => LayoutHelper.performLayout());
  }

  // 执行布局计算
  private static performLayout() {
    // 加载节点
    const flowState = useFlowStore.getState();
    const nodes = flowState.nodes as NodeType[];
    const edges = flowState.edges as EdgeType[];

    // 检查节点是否已测量
    const allMeasured = nodes.every(
      (node) => node.measured?.width && node.measured?.height
    );
    if (!allMeasured && nodes.length > 0) {
      setTimeout(() => {
        LayoutHelper.performLayout();
      }, 10);
      return;
    }

    // 初始化
    const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
    g.setGraph({
      rankdir: "LR",
      align: "UL",
      ranksep: 80,
      ranker: "network-simplex",
    });
    // 载入
    edges.forEach((edge) => g.setEdge(edge.source, edge.target));
    nodes.forEach((node) =>
      g.setNode(node.id, {
        ...node,
        width: node.measured?.width ?? 0,
        height: node.measured?.height ?? 0,
      })
    );
    // 排版
    Dagre.layout(g);
    flowState.replace(
      nodes.map((node) => {
        const position = g.node(node.id);
        const x = position.x - (node.measured?.width ?? 0) / 2;
        const y = position.y - (node.measured?.height ?? 0) / 2;
        return { ...node, position: { x, y } };
      }),
      edges
    );
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
