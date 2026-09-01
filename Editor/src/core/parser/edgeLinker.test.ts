import { describe, expect, it } from "vitest";
import { SourceHandleTypeEnum } from "@/components/flow/nodes";
import { createNodeIdAllocator } from "@/stores/flow";
import { linkEdge } from "./edgeLinker";

describe("linkEdge", () => {
  it("uses the shared allocator for an unresolved target", () => {
    const allocator = createNodeIdAllocator(["node_1"]);

    const [edges, nodes, idLabelPairs] = linkEdge(
      "Source",
      ["Missing"],
      SourceHandleTypeEnum.Next,
      [{ id: "node_1", label: "Source" }],
      () => allocator.allocate().id,
    );

    expect(nodes[0]).toMatchObject({
      id: "node_2",
      data: { label: "Missing" },
    });
    expect(idLabelPairs).toEqual([{ id: "node_2", label: "Missing" }]);
    expect(edges[0]).toMatchObject({
      source: "node_1",
      target: "node_2",
    });
  });
});
