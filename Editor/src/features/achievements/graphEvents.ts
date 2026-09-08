import type { NodeType, PipelineNodeDataType, EdgeType } from "@/stores/flow/types";
import { NodeTypeEnum, SourceHandleTypeEnum } from "@/components/flow/nodes/constants";
import { actionFields, recoFields, otherFieldParams } from "@/core/fields";
import { emitAchievementEvent } from "./bus";

function parentId(node: NodeType | undefined): string | undefined {
  return node && "parentId" in node && typeof node.parentId === "string" ? node.parentId : undefined;
}

function hasValue(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.some(hasValue);
  if (typeof value === "object") return Object.values(value).some(hasValue);
  return true;
}

/**仅由实际字段编辑调用；导入、撤销、文件切换不会计为字段编辑。 */
export function recordNodeEdit(before: NodeType | undefined, after: NodeType | undefined) {
  if (!before || !after) return;
  if (before.type === NodeTypeEnum.Sticker && after.type === NodeTypeEnum.Sticker &&
    "content" in before.data && "content" in after.data &&
    before.data.content !== after.data.content && after.data.content.trim()) {
    emitAchievementEvent("achievement:node_note");
  }
  if (before.type !== NodeTypeEnum.Pipeline || after.type !== NodeTypeEnum.Pipeline) return;
  if (JSON.stringify(before.data) === JSON.stringify(after.data)) return;
  emitAchievementEvent("graph:node:edited", { nodeId: after.id });
  const previous = before.data as PipelineNodeDataType;
  const next = after.data as PipelineNodeDataType;
  if (previous.label !== next.label && next.label.trim()) emitAchievementEvent("achievement:node_renamed");
  const sections = [
    { before: previous.recognition.param, after: next.recognition.param, fields: recoFields[next.recognition.type]?.params, same: previous.recognition.type === next.recognition.type },
    { before: previous.action.param, after: next.action.param, fields: actionFields[next.action.type]?.params, same: previous.action.type === next.action.type },
    { before: previous.others, after: next.others, fields: otherFieldParams, same: true },
  ];
  for (const section of sections) {
    if (!section.same) continue;
    for (const field of section.fields ?? []) {
      if (!field.required && !Object.hasOwn(section.before, field.key) && Object.hasOwn(section.after, field.key)) {
        emitAchievementEvent("achievement:field_added");
      }
    }
  }
  for (const kind of ["recognition", "action"] as const) {
    const current = next[kind];
    const fields = (kind === "recognition" ? recoFields : actionFields)[current.type];
    const excluded = kind === "recognition" ? "DirectHit" : "DoNothing";
    if (current.type === excluded || !fields || JSON.stringify(previous[kind]) === JSON.stringify(current)) continue;
    if (!fields.params.filter((field) => field.required).every((field) => hasValue(current.param[field.key]))) continue;
    emitAchievementEvent(`achievement:${kind}_configured`, { type: current.type });
  }
}

export interface CommittedGraph {
  beforeNodes: NodeType[];
  nodes: NodeType[];
  beforeEdges: EdgeType[];
  edges: EdgeType[];
}

/**基于已提交的图差异评估结构；不会因打开含这些结构的文件解锁。 */
export function recordGraphStructure({ beforeNodes, nodes, beforeEdges, edges }: CommittedGraph) {
  const previousEdges = new Map(beforeEdges.map((edge) => [edge.id, edge]));
  const addedEdges = edges.filter((edge) => !previousEdges.has(edge.id));
  if (addedEdges.length) emitAchievementEvent("achievement:edge_created");
  const changedEdges = edges.filter((edge) => {
    const previous = previousEdges.get(edge.id);
    return !previous || previous.source !== edge.source || previous.target !== edge.target || previous.sourceHandle !== edge.sourceHandle;
  });
  if (changedEdges.some((edge) => edge.sourceHandle === SourceHandleTypeEnum.Error)) emitAchievementEvent("achievement:error_edge_created");
  const nextTargets = new Map<string, Set<string>>();
  for (const edge of edges) {
    if (edge.sourceHandle !== SourceHandleTypeEnum.Next) continue;
    const targets = nextTargets.get(edge.source) ?? new Set<string>();
    targets.add(edge.target);
    nextTargets.set(edge.source, targets);
  }
  if (changedEdges.some((edge) => edge.sourceHandle === SourceHandleTypeEnum.Next &&
    (nextTargets.get(edge.source)?.size ?? 0) >= 2,
  )) emitAchievementEvent("achievement:branch_created");
  const previousNodes = new Map(beforeNodes.map((node) => [node.id, node]));
  const groups = new Set(nodes.filter((node) => parentId(node) && parentId(previousNodes.get(node.id)) !== parentId(node)).map(parentId));
  const memberCounts = new Map<string, number>();
  for (const node of nodes) {
    const group = parentId(node);
    if (group) memberCounts.set(group, (memberCounts.get(group) ?? 0) + 1);
  }
  if (nodes.some((node) => node.type === NodeTypeEnum.Group && groups.has(node.id) && (memberCounts.get(node.id) ?? 0) >= 2)) {
    emitAchievementEvent("achievement:group_organized");
  }
}
