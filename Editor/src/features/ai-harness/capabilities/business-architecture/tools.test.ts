import { describe, expect, it } from "vitest";
import { createPipelineNode, type EdgeType, type NodeType } from "@/stores/flow";
import {
  CanvasCommandBus,
  type CanvasGraphState,
} from "../canvas/commandBus";
import type { BusinessArchitectureDocument } from "./types";
import {
  PRESENT_BUSINESS_ARCHITECTURE_TOOL_NAME,
  READ_BUSINESS_ARCHITECTURE_CONTEXT_TOOL_NAME,
  createBusinessArchitectureToolHandlers,
} from "./tools";

describe("business architecture Harness tools", () => {
  it("生成只读文档且不提交画布变更", async () => {
    const start = createPipelineNode("start", { label: "开始" });
    const end = createPipelineNode("end", { label: "结束" });
    let commitCount = 0;
    const graph: CanvasGraphState = {
      nodes: [start, end],
      edges: [
        {
          id: "next",
          source: "start",
          target: "end",
          sourceHandle: "next" as EdgeType["sourceHandle"],
          targetHandle: "target" as EdgeType["targetHandle"],
          label: 1,
          type: "marked",
        },
      ],
      selectedNodeIds: [],
      targetNodeId: null,
      fileName: "demo.json",
      prefix: "",
    };
    const bus = new CanvasCommandBus({
      read: () => graph,
      commit: (_nodes: NodeType[], _edges: EdgeType[]) => {
        commitCount += 1;
      },
    });
    let document: BusinessArchitectureDocument | undefined;
    const handlers = createBusinessArchitectureToolHandlers(bus, {
      setDocument: (nextDocument) => {
        document = nextDocument;
      },
    });
    const context = {
      runId: "run-architecture",
      sessionId: "session-architecture",
      fileName: "demo.json",
      expectedStateVersion: 1,
      signal: new AbortController().signal,
    };

    const readResult = await handlers[
      READ_BUSINESS_ARCHITECTURE_CONTEXT_TOOL_NAME
    ]({}, context);
    const presentResult = await handlers[
      PRESENT_BUSINESS_ARCHITECTURE_TOOL_NAME
    ](
      {
        expectedStateVersion: 1,
        title: "示例流程",
        summary: "从开始进入结束。",
        stages: [
          {
            id: "main",
            title: "完成流程",
            description: "完成示例流程。",
            kind: "main",
            nodeIds: ["start", "end"],
          },
        ],
      },
      context,
    );

    expect(readResult).toMatchObject({ ok: true, stateVersion: 1 });
    expect(presentResult).toMatchObject({
      ok: true,
      stateVersion: 1,
      undoable: false,
      data: { stageCount: 1, coveredNodeCount: 2 },
    });
    expect(document?.fileName).toBe("demo.json");
    expect(commitCount).toBe(0);
  });

  it("拒绝使用旧画布版本提交架构", async () => {
    const node = createPipelineNode("start", { label: "开始" });
    const graph: CanvasGraphState = {
      nodes: [node],
      edges: [],
      selectedNodeIds: [],
      targetNodeId: null,
      fileName: "demo.json",
      prefix: "",
    };
    const handlers = createBusinessArchitectureToolHandlers(
      new CanvasCommandBus({ read: () => graph, commit: () => undefined }),
      { setDocument: () => undefined },
    );
    const result = await handlers[PRESENT_BUSINESS_ARCHITECTURE_TOOL_NAME](
      {
        expectedStateVersion: 999,
        title: "过期",
        summary: "过期结果。",
        stages: [
          {
            id: "main",
            title: "开始",
            description: "开始。",
            kind: "main",
            nodeIds: ["start"],
          },
        ],
      },
      {
        runId: "run-stale",
        sessionId: "session-stale",
        fileName: "demo.json",
        expectedStateVersion: 1,
        signal: new AbortController().signal,
      },
    );

    expect(result).toMatchObject({
      ok: false,
      error: { code: "state_conflict", retryable: true },
    });
  });
});
