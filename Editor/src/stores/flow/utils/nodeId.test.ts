import { describe, expect, it } from "vitest";
import {
  allocateNodeId,
  createNodeIdAllocator,
  getNextNodeIdCounter,
} from "./nodeId";

describe("node id allocator", () => {
  it("allocates the first available unified node id", () => {
    const existingNodeIds = new Set(["node_1", "node_2", "paste_3"]);

    const allocation = allocateNodeId(
      (nodeId) => existingNodeIds.has(nodeId),
      1,
    );

    expect(allocation).toEqual({
      id: "node_3",
      sequence: 3,
      nextCounter: 4,
    });
  });

  it("reserves ids across a batch allocation", () => {
    const allocator = createNodeIdAllocator(["node_2", "node_4"]);

    expect(allocator.allocate().id).toBe("node_5");
    expect(allocator.allocate().id).toBe("node_6");
    expect(allocator.getNextCounter()).toBe(7);
  });

  it("restores the counter only from unified node ids", () => {
    expect(
      getNextNodeIdCounter([
        "1",
        "paste_30",
        "group_40",
        "node_7",
        "node_1e3",
        "node_08",
        "node_invalid",
      ]),
    ).toBe(8);
  });
});
