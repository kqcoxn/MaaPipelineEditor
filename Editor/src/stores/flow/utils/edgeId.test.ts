import { describe, expect, it } from "vitest";
import {
  allocateEdgeId,
  createEdgeIdAllocator,
  getNextEdgeIdCounter,
} from "./edgeId";

describe("edge id allocator", () => {
  it("allocates the first available unified edge id", () => {
    const existingEdgeIds = new Set(["edge_1", "edge_2", "source_target"]);

    expect(
      allocateEdgeId((edgeId) => existingEdgeIds.has(edgeId), 1),
    ).toEqual({
      id: "edge_3",
      sequence: 3,
      nextCounter: 4,
    });
  });

  it("reserves ids across a batch allocation", () => {
    const allocator = createEdgeIdAllocator(["edge_2", "edge_4"]);

    expect(allocator.allocate().id).toBe("edge_5");
    expect(allocator.allocate().id).toBe("edge_6");
    expect(allocator.getNextCounter()).toBe(7);
  });

  it("restores the counter only from canonical edge ids", () => {
    expect(
      getNextEdgeIdCounter([
        "source_next_target",
        "ai_edge_20",
        "edge_7",
        "edge_1e3",
        "edge_08",
      ]),
    ).toBe(8);
  });
});
