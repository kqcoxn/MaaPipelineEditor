import {
  NodeTypeEnum,
  SourceHandleTypeEnum,
  TargetHandleTypeEnum,
} from "@/components/flow/nodes/constants";
import type { EdgeType, NodeType, PipelineNodeType } from "@/stores/flow/types";
import { createNodeIdAllocator } from "@/stores/flow/utils/nodeId";
import { createEdgeIdAllocator } from "@/stores/flow/utils/edgeId";
import { getNodeAbsoluteRect } from "@/stores/flow/utils/coordinateUtils";
import { validateConfig, type RecorderStep } from "./types";

export function buildRecorderGraph(
  steps: RecorderStep[],
  paths: Record<string, string>,
  existingNodes: NodeType[],
  existingEdges: EdgeType[],
) {
  const allocateNode = createNodeIdAllocator(existingNodes.map((n) => n.id));
  const allocateEdge = createEdgeIdAllocator(existingEdges.map((e) => e.id));
  const names = new Set(existingNodes.map((n) => n.data.label));
  const nodeById = new Map(existingNodes.map((n) => [n.id, n]));
  const left = existingNodes.reduce((right, node) => {
    const r = getNodeAbsoluteRect(node, nodeById);
    return Math.max(right, r.x + r.width + 100);
  }, 0);
  const nodes: PipelineNodeType[] = steps.map((step, index) => {
    const c = step.config;
    const error = validateConfig(c);
    if (error) throw new Error(error);
    const base = c.name.trim() || `录制步骤_${index + 1}`;
    let name = base;
    let suffix = 2;
    while (names.has(name)) name = `${base}_${suffix++}`;
    names.add(name);
    const param: PipelineNodeType["data"]["recognition"]["param"] = {};
    if (c.recognition !== "DirectHit") {
      param.roi = [...c.roi];
      param.threshold = c.recognition === "OCR" ? c.threshold : [c.threshold];
    }
    if (c.recognition === "OCR") param.expected = [c.expected];
    if (c.recognition === "TemplateMatch") {
      if (!paths[step.id]) throw new Error(`步骤「${name}」的模板尚未保存`);
      param.template = [paths[step.id]];
    }
    return {
      id: allocateNode.allocate().id,
      type: NodeTypeEnum.Pipeline,
      position: { x: left, y: index * 240 },
      selected: true,
      data: {
        label: name,
        recognition: { type: c.recognition, param },
        action: {
          type: c.action,
          param:
            c.action === "Click"
              ? {
                  ...(c.targetMode === "fixed"
                    ? { target: [...c.target!] }
                    : {}),
                  ...(c.offset.some((v) => v !== 0)
                    ? { target_offset: [...c.offset] }
                    : {}),
                }
              : {},
        },
        others: {},
      },
    };
  });
  const edges: EdgeType[] = nodes.slice(1).map((node, i) => ({
    id: allocateEdge.allocate().id,
    source: nodes[i].id,
    target: node.id,
    sourceHandle: SourceHandleTypeEnum.Next,
    targetHandle: TargetHandleTypeEnum.Target,
    type: "marked",
    label: 1,
    selected: true,
  }));
  return { nodes, edges };
}
