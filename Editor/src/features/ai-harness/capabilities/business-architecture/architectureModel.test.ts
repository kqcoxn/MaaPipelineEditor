import { describe, expect, it } from "vitest";
import { createPipelineNode, type EdgeType } from "@/stores/flow";
import type { CanvasGraphState } from "../canvas/commandBus";
import {
  buildBusinessArchitectureContext,
  buildBusinessArchitectureDocument,
} from "./architectureModel";

function edge(
  id: string,
  source: string,
  target: string,
  label: number,
  options: Partial<EdgeType> = {},
): EdgeType {
  return {
    id,
    source,
    target,
    sourceHandle: "next" as EdgeType["sourceHandle"],
    targetHandle: "target" as EdgeType["targetHandle"],
    label,
    type: "marked",
    ...options,
  };
}

function createGraph(): CanvasGraphState {
  const start = createPipelineNode("start", { label: "启动任务" });
  const work = createPipelineNode("work", { label: "执行作业" });
  const popup = createPipelineNode("popup", { label: "关闭弹窗" });
  const recovery = createPipelineNode("recovery", { label: "返回主页" });
  start.data.recognition.type = "OCR";
  start.data.recognition.param.expected = ["开始", "继续"];
  work.data.action.type = "Click";
  return {
    nodes: [start, work, popup, recovery],
    edges: [
      edge("start-work", "start", "work", 1),
      edge("work-popup", "work", "popup", 2, {
        targetHandle: "jump_back" as EdgeType["targetHandle"],
        attributes: { jump_back: true },
      }),
      edge("work-error", "work", "recovery", 1, {
        sourceHandle: "on_error" as EdgeType["sourceHandle"],
      }),
    ],
    selectedNodeIds: [],
    targetNodeId: null,
    fileName: "daily.json",
    prefix: "",
  };
}

describe("business architecture model", () => {
  it("提供紧凑业务线索但不暴露坐标配置", () => {
    const context = buildBusinessArchitectureContext(createGraph(), 3);

    expect(context.nodes[0]).toMatchObject({
      id: "start",
      recognitionSummary: expect.stringContaining("expected"),
    });
    expect(context.nodes[0]).not.toHaveProperty("position");
    expect(context.candidateSets[0].candidates).toEqual([
      { nodeId: "work", order: 1, jumpBack: false },
    ]);
  });

  it("自动收拢遗漏节点，并且只从真实控制边派生阶段关系", () => {
    const document = buildBusinessArchitectureDocument(
      createGraph(),
      3,
      {
        title: "日常作业",
        summary: "启动后执行作业，异常时返回主页。",
        stages: [
          {
            id: "start-stage",
            title: "准备任务",
            description: "识别入口并准备开始。",
            kind: "main",
            nodeIds: ["start"],
          },
          {
            id: "work-stage",
            title: "执行作业",
            description: "完成核心任务步骤。",
            kind: "loop",
            nodeIds: ["work", "popup"],
          },
        ],
      },
      "run-1",
    );

    expect(document.coverage.autoAssignedNodeIds).toEqual(["recovery"]);
    expect(document.stages.at(-1)).toMatchObject({
      title: "待梳理",
      kind: "support",
      nodeIds: ["recovery"],
    });
    expect(document.transitions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceStageId: "start-stage",
          targetStageId: "work-stage",
          kind: "next",
        }),
        expect.objectContaining({
          sourceStageId: "work-stage",
          kind: "on_error",
        }),
      ]),
    );
    expect(document.transitions).toHaveLength(2);
  });

  it("拒绝节点重复归属", () => {
    expect(() =>
      buildBusinessArchitectureDocument(
        createGraph(),
        3,
        {
          title: "重复",
          summary: "重复分组。",
          stages: [
            {
              id: "a",
              title: "阶段 A",
              description: "阶段 A。",
              kind: "main",
              nodeIds: ["start"],
            },
            {
              id: "b",
              title: "阶段 B",
              description: "阶段 B。",
              kind: "branch",
              nodeIds: ["start"],
            },
          ],
        },
        "run-2",
      ),
    ).toThrow("多个业务阶段");
  });
});
