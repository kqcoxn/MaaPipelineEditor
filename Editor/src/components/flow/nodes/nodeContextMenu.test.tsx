import { describe, expect, it } from "vitest";

import { NodeTypeEnum } from "./constants";
import {
  getNodeContextMenuConfig,
  type NodeContextMenuNode,
} from "./nodeContextMenu";

describe("read-only node context menu", () => {
  it("keeps copy and debug commands but removes graph mutations", () => {
    const node = {
      id: "p_start",
      type: NodeTypeEnum.Pipeline,
      position: { x: 0, y: 0 },
      data: { label: "Start" },
    } as NodeContextMenuNode;
    const keys = getNodeContextMenuConfig(node, { readOnly: true }).map(
      (item) => item.key,
    );

    expect(keys).toContain("copy-node-name");
    expect(keys).toContain("debug-run-from-node");
    expect(keys).not.toContain("edit-json");
    expect(keys).not.toContain("node-direction");
    expect(keys).not.toContain("delete-node");
    expect(keys).not.toContain("save-as-template");
  });

  it("only exposes name copying for read-only group nodes", () => {
    const group = {
      id: "group",
      type: NodeTypeEnum.Group,
      position: { x: 0, y: 0 },
      data: { label: "Group" },
    } as NodeContextMenuNode;

    expect(getNodeContextMenuConfig(group, { readOnly: true }).map((item) => item.key)).toEqual([
      "copy-node-name",
    ]);
  });
});
