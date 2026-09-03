import { describe, expect, it, vi } from "vitest";
import { createPipelineNode, type EdgeType, type NodeType } from "@/stores/flow";
import {
  CanvasCommandBus,
  type CanvasCommandBusAdapter,
  type CanvasGraphState,
} from "./commandBus";

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
      { type: "create_node", nodeRef: "batch-end", name: "结束" },
      {
        type: "create_connection",
        edgeRef: "batch-connection",
        sourceId: "1",
        targetId: "batch-end",
        sourceHandle: "next" as never,
      },
      {
        type: "update_connection",
        connectionId: "batch-connection",
        attributes: { anchor: true },
      },
    ]);

    expect(result).toMatchObject({ ok: true, undoable: true });
    expect(commit).toHaveBeenCalledOnce();
    expect(getGraph().nodes).toHaveLength(2);
    expect(getGraph().edges).toHaveLength(1);
    expect(getGraph().nodes[1].id).toBe("node_1");
    expect(getGraph().edges[0].id).toBe("edge_1");
    expect(getGraph().edges[0].target).toBe("node_1");
    expect(getGraph().edges[0].attributes).toEqual({ anchor: true });
    expect(result.data).toMatchObject({
      createdNodes: [{ nodeRef: "batch-end", nodeId: "node_1" }],
      createdConnections: [
        { edgeRef: "batch-connection", connectionId: "edge_1" },
      ],
    });
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
    expect(getGraph().nodes[1].id).toBe("node_1");
  });

  it("拒绝临时引用占用正式节点 ID 命名空间", () => {
    const { bus, commit } = createHarness();

    const result = bus.apply(context(), [
      { type: "create_node", nodeRef: "node_10", name: "结束" },
    ]);

    expect(result).toMatchObject({
      ok: false,
      error: { message: "节点临时引用不可用: node_10" },
    });
    expect(commit).not.toHaveBeenCalled();
  });

  it("拒绝临时引用占用正式连接 ID 命名空间", () => {
    const { bus, commit } = createHarness();

    const result = bus.apply(context(), [
      {
        type: "create_connection",
        edgeRef: "edge_10",
        sourceId: "1",
        targetId: "1",
        sourceHandle: "next" as never,
      },
    ]);

    expect(result).toMatchObject({
      ok: false,
      error: { message: "连接临时引用不可用: edge_10" },
    });
    expect(commit).not.toHaveBeenCalled();
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

  it("拒绝非法 Pipeline 变更且不提交画布", () => {
    const { bus, commit, getGraph } = createHarness();
    const result = bus.apply(context(), [
      {
        type: "create_node",
        name: "非法节点",
        pipeline: {
          recognition: "TemplateMatch",
          template: 123,
        },
      },
    ]);

    expect(result.ok).toBe(false);
    expect(result.validationErrors).toEqual(
      expect.arrayContaining([
        expect.stringContaining("template 类型不符合 Pipeline 协议"),
      ]),
    );
    expect(commit).not.toHaveBeenCalled();
    expect(getGraph().nodes).toHaveLength(1);
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

  it("只读操作同样拒绝跨文件访问", () => {
    const { bus } = createHarness();
    expect(bus.readSummary({ ...context(), fileName: "other.json" }).error?.code).toBe(
      "permission_denied",
    );
    expect(
      bus.readNode("1", { ...context(), fileName: "other.json" }).error?.code,
    ).toBe("permission_denied");
  });

  it("一次读取多个节点并报告不存在的节点", () => {
    const { bus } = createHarness();

    const result = bus.readNodes(["1", "missing"], context());

    expect(result).toMatchObject({ ok: true, stateVersion: 1 });
    expect(result.data).toMatchObject({
      nodes: [
        expect.objectContaining({ id: "1", name: "开始", pipeline: expect.anything() }),
      ],
      missingNodeIds: ["missing"],
    });
  });

  it("受控位置提交只修改指定节点并保留撤销能力", () => {
    const { bus, commit, getGraph } = createHarness();

    const result = bus.applyNodePositions(context(), {
      "1": { x: 240, y: 160 },
    });

    expect(result).toMatchObject({ ok: true, stateVersion: 2, undoable: true });
    expect(commit).toHaveBeenCalledOnce();
    expect(getGraph().nodes[0].position).toEqual({ x: 240, y: 160 });
  });
});
