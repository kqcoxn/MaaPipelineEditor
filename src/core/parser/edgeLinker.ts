import { createExternalNode, createAnchorNode } from "../../stores/flow";
import type {
  NodeType,
  EdgeType,
  IdLabelPairsType,
  EdgeAttributesType,
} from "./types";
import { SourceHandleTypeEnum } from "../../components/flow/nodes";

// 节点属性对象形式类型
export type NodeAttr = {
  name: string;
  jump_back?: boolean;
  anchor?: boolean;
};

// 节点引用类型
export type NodeRefType = string | NodeAttr;

// 全局ID计数器
let idCounter = 1;

/**
 * 重置ID计数器
 */
export function resetIdCounter(): void {
  idCounter = 1;
}

/**
 * 获取下一个ID
 */
export function getNextId(): number {
  return idCounter++;
}

/**
 * 解析节点引用 - 支持两种格式
 * 1. 字符串形式: "NodeName" 或 "[Anchor][JumpBack]NodeName"
 * 2. 对象形式: { name: "NodeName", jump_back: true, anchor: true }
 * @param ref 节点引用
 * @returns 解析后的节点名称和属性
 */
export function parseNodeRef(ref: NodeRefType): {
  name: string;
  attributes: EdgeAttributesType;
} {
  // 对象形式
  if (typeof ref === "object" && ref !== null) {
    const { name, jump_back, anchor } = ref;
    const attributes: EdgeAttributesType = {};
    if (jump_back) attributes.jump_back = true;
    if (anchor) attributes.anchor = true;
    return { name, attributes };
  }

  // 字符串形式
  let name = ref;
  const attributes: EdgeAttributesType = {};

  // 解析前缀
  const prefixRegex = /^(\[Anchor\]|\[JumpBack\])+/i;
  const match = name.match(prefixRegex);
  if (match) {
    const prefixes = match[0];
    name = name.substring(prefixes.length);

    // 解析各个前缀
    if (/\[Anchor\]/i.test(prefixes)) {
      attributes.anchor = true;
    }
    if (/\[JumpBack\]/i.test(prefixes)) {
      attributes.jump_back = true;
    }
  }

  return { name, attributes };
}

/**
 * 链接边 - 创建源节点到目标节点的连接
 * @param oSourceLabel 源节点标签
 * @param oTargetLabels 目标节点标签数组
 * @param type 连接类型
 * @param idOLPairs 现有的ID-Label对应关系
 * @returns [新增的边数组, 新增的节点数组, 新增的ID-Label对应关系]
 */
export function linkEdge(
  oSourceLabel: string,
  oTargetLabels: NodeRefType[],
  type: SourceHandleTypeEnum,
  idOLPairs: IdLabelPairsType
): [EdgeType[], NodeType[], IdLabelPairsType] {
  // 检索源节点ID
  const sourceId = idOLPairs.find((pair) => pair.label === oSourceLabel)
    ?.id as string;

  const edges: EdgeType[] = [];
  const nodes: NodeType[] = [];
  const newIdOLPairs: IdLabelPairsType = [];

  // 确保目标标签是数组
  if (!Array.isArray(oTargetLabels)) {
    oTargetLabels = [oTargetLabels];
  }

  oTargetLabels.forEach((targetRef, index) => {
    // 解析节点引用
    const { name: targetLabel, attributes } = parseNodeRef(targetRef);

    let targetId = idOLPairs.find((pair) => pair.label === targetLabel)?.id;

    // 如果目标节点不存在，创建外部节点或锤点节点
    const externalId = (attributes.anchor ? "a_" : "e_") + idCounter++;
    if (!targetId) {
      let node: NodeType;
      if (attributes.anchor) {
        // 创建锤点节点
        node = createAnchorNode(externalId, { label: targetLabel });
      } else {
        // 创建外部节点
        node = createExternalNode(externalId, { label: targetLabel });
      }
      targetId = node.id;
      nodes.push(node);
      newIdOLPairs.push({
        id: targetId,
        label: targetLabel,
      });
    }

    // 创建连接
    const edge: EdgeType = {
      id: `${sourceId}_${type}_${targetId ?? externalId}`,
      source: sourceId,
      sourceHandle: type,
      target: targetId ?? externalId,
      targetHandle: "target",
      label: index + 1,
      type: "marked",
    };

    // 添加属性
    if (Object.keys(attributes).length > 0) {
      edge.attributes = attributes;
    }
    edges.push(edge);
  });

  return [edges, nodes, newIdOLPairs];
}
