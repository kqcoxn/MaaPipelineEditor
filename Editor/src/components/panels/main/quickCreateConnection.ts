import type { Connection } from "@xyflow/react";
import type { NodeType } from "../../../stores/flow";
import { NodeTypeEnum } from "../../flow/nodes";

export interface QuickCreateConnection {
  source: Connection["source"];
  sourceHandle: NonNullable<Connection["sourceHandle"]>;
}

export function findQuickCreateTarget(nodes: NodeType[]): NodeType | undefined {
  if (nodes.length !== 1) return undefined;

  const [node] = nodes;
  return node.type !== NodeTypeEnum.Sticker && node.type !== NodeTypeEnum.Group
    ? node
    : undefined;
}
