import { describe, expect, it } from "vitest";
import type { EdgeType } from "@/stores/flow";
import { buildLaneAttachments } from "./laneAttachments";
import type { SemanticLayoutLane } from "./types";

function edge(
  id: string,
  source: string,
  target: string,
  kind: "next" | "on_error" | "jump_back" = "next",
): EdgeType {
  return {
    id,
    source,
    target,
    sourceHandle: (kind === "on_error" ? "on_error" : "next") as EdgeType["sourceHandle"],
    targetHandle: (kind === "jump_back" ? "jump_back" : "target") as EdgeType["targetHandle"],
    label: 1,
    type: "marked",
    attributes: kind === "jump_back" ? { jump_back: true } : undefined,
  };
}

describe("buildLaneAttachments", () => {
  it("从对应类型的跨泳道控制边推断分支、回跳和错误锚点", () => {
    const lanes: SemanticLayoutLane[] = [
      { id: "main", role: "primary", nodeIds: ["root"] },
      { id: "branch", role: "branch", nodeIds: ["branch"] },
      { id: "jump", role: "jump_back", nodeIds: ["jump"] },
      { id: "error", role: "error", nodeIds: ["error"] },
    ];

    const result = buildLaneAttachments(
      lanes,
      [
        edge("branch", "root", "branch"),
        edge("jump", "root", "jump", "jump_back"),
        edge("error", "root", "error", "on_error"),
      ],
      [],
    );

    expect(result.attachments).toEqual([
      {
        laneId: "branch",
        parentLaneId: "main",
        anchorNodeId: "root",
      },
      {
        laneId: "jump",
        parentLaneId: "main",
        anchorNodeId: "root",
        side: "above",
      },
      {
        laneId: "error",
        parentLaneId: "main",
        anchorNodeId: "root",
        side: "below",
      },
    ]);
    expect(result.roots).toEqual(["main"]);
  });

  it("优先使用显式锚点和跨轴关系", () => {
    const lanes: SemanticLayoutLane[] = [
      { id: "main", role: "primary", nodeIds: ["root", "preferred"] },
      {
        id: "branch",
        role: "branch",
        nodeIds: ["branch"],
        anchorNodeId: "preferred",
      },
    ];

    const result = buildLaneAttachments(
      lanes,
      [edge("inferred", "root", "branch")],
      [
        {
          sourceLaneId: "main",
          targetLaneId: "branch",
          placement: "above",
        },
      ],
    );

    expect(result.attachments[0]).toEqual({
      laneId: "branch",
      parentLaneId: "main",
      anchorNodeId: "preferred",
      side: "above",
    });
  });

  it("丢弃会形成泳道父子环的后续锚点", () => {
    const lanes: SemanticLayoutLane[] = [
      { id: "a", role: "branch", nodeIds: ["a"] },
      { id: "b", role: "branch", nodeIds: ["b"] },
    ];

    const result = buildLaneAttachments(
      lanes,
      [edge("a-b", "a", "b"), edge("b-a", "b", "a")],
      [],
    );

    expect(result.attachments).toHaveLength(1);
    expect(result.roots).toHaveLength(1);
  });
});
