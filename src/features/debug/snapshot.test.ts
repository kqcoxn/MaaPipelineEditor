import { describe, expect, it } from "vitest";
import {
  selectEffectiveResolverEdges,
  selectEffectiveResolverNodes,
} from "./snapshot";
import type { DebugNodeResolverSnapshot } from "./types";

describe("snapshot resource override resolution", () => {
  it("prefers later resource paths for duplicate runtime names", () => {
    const nodes: DebugNodeResolverSnapshot["nodes"] = [
      {
        fileId: "base-mail",
        nodeId: "base-node",
        runtimeName: "领取邮件_确认领取",
        displayName: "确认领取",
        sourcePath: "C:/resource/base/pipeline/日常任务/领取邮件.json",
      },
      {
        fileId: "en-mail",
        nodeId: "en-node",
        runtimeName: "领取邮件_确认领取",
        displayName: "Confirm claim",
        sourcePath: "C:/resource/en/pipeline/日常任务/领取邮件.json",
      },
    ];

    expect(
      selectEffectiveResolverNodes(nodes, [
        "C:/resource/base",
        "C:/resource/en",
      ]),
    ).toEqual([nodes[1]]);
  });

  it("prefers later resource paths for duplicate resolver edges", () => {
    const edges: DebugNodeResolverSnapshot["edges"] = [
      {
        edgeId: "base-edge",
        fromRuntimeName: "领取邮件_领取奖励",
        toRuntimeName: "领取邮件_确认领取",
        reason: "next",
        sourcePath: "C:/resource/base/pipeline/日常任务/领取邮件.json",
      },
      {
        edgeId: "en-edge",
        fromRuntimeName: "领取邮件_领取奖励",
        toRuntimeName: "领取邮件_确认领取",
        reason: "next",
        sourcePath: "C:/resource/en/pipeline/日常任务/领取邮件.json",
      },
    ];

    expect(
      selectEffectiveResolverEdges(edges, [
        "C:/resource/base",
        "C:/resource/en",
      ]),
    ).toEqual([edges[1]]);
  });
});
