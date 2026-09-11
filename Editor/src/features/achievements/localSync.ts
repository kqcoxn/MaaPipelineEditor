import type { NodeType, EdgeType } from "@/stores/flow/types";

/**比较内容，忽略重载生成的 ID、选中状态、视口与自动布局位置。 */
export function localFileContentSignature(nodes: NodeType[], edges: EdgeType[]): string {
  const labels = new Map(nodes.map((node) => [node.id, node.data.label]));
  return JSON.stringify({
    nodes: nodes.map((node) => stableJson({ type: node.type, data: node.data })).sort(),
    edges: edges.map((edge) => stableJson({
      source: labels.get(edge.source), target: labels.get(edge.target),
      sourceHandle: edge.sourceHandle, targetHandle: edge.targetHandle,
      label: edge.label, attributes: edge.attributes,
    })).sort(),
  });
}

function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, item) => {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      return Object.fromEntries(Object.keys(item).sort().map((key) => [key, item[key]]));
    }
    return item;
  });
}
