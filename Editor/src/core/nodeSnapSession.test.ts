import { describe, expect, it } from "vitest";
import { NodeTypeEnum } from "../components/flow/nodes/constants";
import type { NodeType } from "../stores/flow/types";
import { createNodeSnapSession, queryNodeSnapSession } from "./nodeSnapSession";

function createNode(
  id: string,
  x: number,
  y: number,
  options: {
    type?: NodeTypeEnum;
    parentId?: string;
    selected?: boolean;
    width?: number;
    height?: number;
  } = {},
): NodeType {
  return {
    id,
    type: options.type ?? NodeTypeEnum.Pipeline,
    data: { label: id },
    position: { x, y },
    measured: {
      width: options.width ?? 100,
      height: options.height ?? 60,
    },
    selected: options.selected,
    ...(options.parentId ? { parentId: options.parentId } : {}),
  } as NodeType;
}

describe("node snap session", () => {
  it("excludes every selected drag node and descendants of dragged groups", () => {
    const group = createNode("group", 100, 100, {
      type: NodeTypeEnum.Group,
      selected: true,
    });
    const child = createNode("child", 20, 20, { parentId: group.id });
    const selectedPeer = createNode("selected-peer", 400, 100, {
      selected: true,
    });
    const candidate = createNode("candidate", 800, 100);
    const nodes = [group, child, selectedPeer, candidate];
    const session = createNodeSnapSession({
      nodes,
      nodeById: new Map(nodes.map((node) => [node.id, node])),
      draggedNodes: [group, selectedPeer],
    });

    expect([...session.excludedNodeIds].sort()).toEqual([
      "child",
      "group",
      "selected-peer",
    ]);
    expect(session.index.candidateCount).toBe(1);
  });

  it("uses absolute coordinates for grouped nodes while returning relative delta", () => {
    const group = createNode("group", 500, 300, {
      type: NodeTypeEnum.Group,
    });
    const dragged = createNode("dragged", 98, 50, { parentId: group.id });
    const candidate = createNode("candidate", 600, 350);
    const nodes = [group, dragged, candidate];
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const session = createNodeSnapSession({
      nodes,
      nodeById,
      draggedNodes: [dragged],
    });
    const result = queryNodeSnapSession(session, dragged, [dragged]);

    expect(result.delta).toEqual({ x: 2, y: 0 });
    expect(result.guidelines).toEqual([
      { type: "vertical", position: 600 },
      { type: "horizontal", position: 350 },
    ]);
  });

  it("filters candidates by the viewport snapshot", () => {
    const dragged = createNode("dragged", 0, 0);
    const visible = createNode("visible", 100, 100);
    const offscreen = createNode("offscreen", 1_000, 1_000);
    const nodes = [dragged, visible, offscreen];
    const session = createNodeSnapSession({
      nodes,
      nodeById: new Map(nodes.map((node) => [node.id, node])),
      draggedNodes: [dragged],
      viewport: { x: 0, y: 0, zoom: 1, width: 300, height: 200 },
    });

    expect(session.index.candidateCount).toBe(1);
  });
});
