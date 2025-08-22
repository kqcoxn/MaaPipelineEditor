import Dagre from "@dagrejs/dagre";

import {
  useFlowStore,
  type EdgeType,
  type NodeType,
} from "../stores/flowStore";

export function autoLayout() {
  // 初始化
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "LR" });
  // 加载节点
  const flowState = useFlowStore.getState();
  const nodes = flowState.nodes as NodeType[];
  const edges = flowState.edges as EdgeType[];
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
