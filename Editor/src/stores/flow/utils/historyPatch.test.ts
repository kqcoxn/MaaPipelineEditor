import { describe, expect, it } from "vitest";

import { createPipelineNode, type NodeType } from "..";
import {
  applyGraphHistoryPatch,
  createGraphHistoryPatch,
} from "./historyPatch";

function ids(nodes: NodeType[]): string[] {
  return nodes.map((node) => node.id);
}

describe("graph history patches", () => {
  it("does not treat indexes shifted by a deletion as entity changes", () => {
    const before = ["a", "b", "c", "d"].map((id) =>
      createPipelineNode(id),
    );
    const after = before.slice(1);

    const patch = createGraphHistoryPatch(before, [], after, []);

    expect(patch.nodes).toHaveLength(1);
    expect(patch.nodes[0]).toMatchObject({
      id: "a",
      beforeIndex: 0,
      afterIndex: -1,
      moved: false,
    });
    expect(ids(applyGraphHistoryPatch(before, [], patch, "redo").nodes)).toEqual(
      ["b", "c", "d"],
    );
    expect(
      ids(applyGraphHistoryPatch(after, [], patch, "undo").nodes),
    ).toEqual(["a", "b", "c", "d"]);
  });

  it("stores only the entity that moved relative to stable siblings", () => {
    const [a, b, group, c] = ["a", "b", "group", "c"].map((id) =>
      createPipelineNode(id),
    );
    const attachedA = {
      ...a,
      parentId: group.id,
      position: { x: 10, y: 20 },
    } as NodeType;
    const before = [a, b, group, c];
    const after = [group, attachedA, b, c];

    const patch = createGraphHistoryPatch(before, [], after, []);

    expect(patch.nodes.map((item) => item.id).sort()).toEqual(["a", "group"]);
    expect(patch.nodes.find((item) => item.id === "group")?.moved).toBe(true);
    const redone = applyGraphHistoryPatch(before, [], patch, "redo").nodes;
    expect(ids(redone)).toEqual(ids(after));
    expect((redone[1] as NodeType & { parentId?: string }).parentId).toBe(
      "group",
    );
    expect(ids(applyGraphHistoryPatch(redone, [], patch, "undo").nodes)).toEqual(
      ids(before),
    );
  });
});
