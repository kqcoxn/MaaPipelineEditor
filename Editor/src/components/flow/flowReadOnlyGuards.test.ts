import { describe, expect, it } from "vitest";
import type { EdgeChange, NodeChange } from "@xyflow/react";

import {
  allowedReadOnlyEdgeChanges,
  allowedReadOnlyNodeChanges,
} from "./flowReadOnlyGuards";

describe("read-only Flow change guards", () => {
  it("allows only selection and measurement changes for nodes", () => {
    const changes = [
      { type: "select", id: "n", selected: true },
      { type: "dimensions", id: "n", dimensions: { width: 10, height: 10 } },
      { type: "position", id: "n", position: { x: 10, y: 20 } },
      { type: "remove", id: "n" },
      { type: "replace", id: "n", item: {} },
    ] as NodeChange[];

    expect(allowedReadOnlyNodeChanges(changes).map((change) => change.type)).toEqual([
      "select",
      "dimensions",
    ]);
  });

  it("allows only edge selection", () => {
    const changes = [
      { type: "select", id: "e", selected: true },
      { type: "remove", id: "e" },
      { type: "replace", id: "e", item: {} },
    ] as EdgeChange[];

    expect(allowedReadOnlyEdgeChanges(changes).map((change) => change.type)).toEqual([
      "select",
    ]);
  });
});
