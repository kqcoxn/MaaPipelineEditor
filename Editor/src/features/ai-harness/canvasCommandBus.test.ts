import { describe, expect, it, vi } from "vitest";
import { createPipelineNode, type EdgeType, type NodeType } from "@/stores/flow";
import {
  CanvasCommandBus,
  type CanvasCommandBusAdapter,
  type CanvasGraphState,
} from "./canvasCommandBus";

function createHarness() {
  let graph: CanvasGraphState = {
    nodes: [createPipelineNode("1", { label: "开始" })],
    edges: [],
    selectedNodeIds: [],
    targetNodeId: null,
    fileName: "demo.json",
    prefix: "",
  };
  const commit = vi.fn((nodes: NodeType[], edges: EdgeType[]) => {
    graph = { ...graph, nodes, edges };
  });
  const adapter: CanvasCommandBusAdapter = { read: () => graph, commit };
  return { bus: new CanvasCommandBus(adapter), commit, getGraph: () => graph };
}

function context(expectedStateVersion = 1) {
  return {
    runId: "run-1",
    sessionId: "session-1",
    fileName: "demo.json",
    expectedStateVersion,
    signal: new AbortController().signal,
  };
}

describe("CanvasCommandBus", () => {
  it("原子提交批量变更并返回版本、diff 和撤销信息", () => {
    const { bus, commit, getGraph } = createHarness();
    const result = bus.apply(context(), [
      { type: "create_node", nodeId: "batch-end", name: "结束" },
      {
        type: "create_connection",
        sourceId: "1",
        targetId: "batch-end",
        sourceHandle: "next" as never,
      },
    ]);

    expect(result).toMatchObject({ ok: true, undoable: true });
    expect(commit).toHaveBeenCalledOnce();
    expect(getGraph().nodes).toHaveLength(2);
    expect(getGraph().edges).toHaveLength(1);
  });

  it("成功写入后同步增加状态版本", () => {
    const { bus, commit, getGraph } = createHarness();
    const result = bus.apply(context(), [
      {
        type: "create_node",
        name: "结束",
        pipeline: { action: "StopTask" },
      },
    ]);

    expect(result).toMatchObject({ ok: true, stateVersion: 2, undoable: true });
    expect(result.changes?.[0]).toContain("创建节点 结束");
    expect(commit).toHaveBeenCalledOnce();
    expect(getGraph().nodes).toHaveLength(2);
  });

  it("拒绝重复节点名且不提交部分结果", () => {
    const { bus, commit } = createHarness();
    const result = bus.apply(context(), [
      { type: "create_node", name: "重复" },
      { type: "create_node", name: "重复" },
    ]);

    expect(result.ok).toBe(false);
    expect(result.validationErrors).toContain("节点名称重复: 重复");
    expect(commit).not.toHaveBeenCalled();
  });

  it("拒绝状态版本冲突和跨文件操作", () => {
    const { bus } = createHarness();
    expect(
      bus.apply(context(9), [{ type: "delete_node", nodeId: "1" }]).error
        ?.code,
    ).toBe("state_conflict");
    expect(
      bus.apply(
        { ...context(), fileName: "other.json" },
        [{ type: "delete_node", nodeId: "1" }],
      ).error?.code,
    ).toBe("permission_denied");
  });
});
