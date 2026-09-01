import { describe, expect, it } from "vitest";
import {
  SourceHandleTypeEnum,
  TargetHandleTypeEnum,
} from "@/components/flow/nodes";
import {
  createExternalNode,
  createPipelineNode,
  type EdgeType,
} from "@/stores/flow";
import { rerouteEdgesToNearestReplica } from "./edgeRerouter";

describe("rerouteEdgesToNearestReplica", () => {
  it("keeps edge identity stable when changing the target replica", () => {
    const source = createPipelineNode("node_1", {
      label: "Source",
      position: { x: 900, y: 0 },
    });
    const firstReplica = createExternalNode("node_2", {
      label: "Shared",
      position: { x: 0, y: 0 },
    });
    const nearestReplica = createExternalNode("node_3", {
      label: "Shared",
      position: { x: 800, y: 0 },
    });
    const edge: EdgeType = {
      id: "edge_1",
      source: source.id,
      sourceHandle: SourceHandleTypeEnum.Next,
      target: firstReplica.id,
      targetHandle: TargetHandleTypeEnum.Target,
      label: 1,
      type: "marked",
    };

    const [rerouted] = rerouteEdgesToNearestReplica(
      [source, firstReplica, nearestReplica],
      [edge],
    );

    expect(rerouted).toMatchObject({
      id: "edge_1",
      target: "node_3",
    });
  });
});
