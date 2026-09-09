import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFlowStore, createPipelineNode } from "@/stores/flow";
import { useAchievementStore } from "@/stores/achievement/achievementStore";
import { NodeTypeEnum, SourceHandleTypeEnum, TargetHandleTypeEnum } from "@/components/flow/nodes/constants";
import { emitAchievementEvent } from "./bus";
import { initializeAchievements } from "./listeners";
import { achievementDefs, counterRules } from "./defs";
import { recordPipelineExport } from "./exportEvents";
import { LayoutHelper, AlignmentEnum } from "@/core/layout";
import { createGroupNode } from "@/stores/flow/utils/nodeUtils";

const context = vi.hoisted(() => ({ embedded: false }));
vi.mock("@/utils/embedBridge", async (original) => ({ ...await original<object>(), isEmbedEnvironment: () => context.embedded }));
vi.mock("./notify", () => ({ startUnlockNotifier: () => () => undefined, notifyRetroactiveUnlocks: vi.fn() }));
vi.mock("@/services/crossFileService", () => ({ crossFileService: { getAllNodes: () => [{ isCurrentFile: false, nodeType: "pipeline", fullName: "Remote" }] } }));

let dispose: () => void;
beforeEach(() => {
  vi.useFakeTimers(); localStorage.clear(); context.embedded = false;
  useFlowStore.getState().replace([], [], { skipHistory: true, isFitView: false });
  useFlowStore.getState().initHistory([], []);
  useAchievementStore.getState().resetAll();
  dispose = initializeAchievements();
});
afterEach(() => { dispose(); useFlowStore.getState().clearHistory(); vi.useRealTimers(); });
const unlocked = (id: string) => !!useAchievementStore.getState().unlocked[id];

describe("正式成就接线", () => {
  it("保存模板按四档累计，使用模板只解锁老方新用", () => {
    emitAchievementEvent("achievement:template_used");
    expect(unlocked("organize_reuse")).toBe(true);
    expect(unlocked("organize_template")).toBe(false);
    for (let count = 1; count <= 100; count++) {
      emitAchievementEvent("achievement:template_saved");
      for (const target of [1, 5, 20, 100]) {
        expect(unlocked(target === 1 ? "organize_template" : `organize_template_${target}`)).toBe(count >= target);
      }
    }
    expect(achievementDefs.filter((def) => def.trigger.kind === "counter" && def.trigger.counter === "template_used")).toHaveLength(1);
  });

  it("对齐至少三个节点且位置改变才解锁，撤销重做不重复计数", () => {
    const nodes = [0, 1, 2].map((index) => createPipelineNode(`align-${index}`, { position: { x: index * 100, y: 0 } }));
    const flow = useFlowStore.getState();
    flow.replace(nodes, [], { skipHistory: true, isFitView: false });
    flow.initHistory(nodes, []);
    LayoutHelper.align(AlignmentEnum.Top, useFlowStore.getState().nodes);
    expect(unlocked("organize_align")).toBe(false);
    LayoutHelper.align(AlignmentEnum.Left, useFlowStore.getState().nodes.slice(0, 2));
    expect(unlocked("organize_align")).toBe(false);
    LayoutHelper.align(AlignmentEnum.Left, useFlowStore.getState().nodes);
    expect(unlocked("organize_align")).toBe(true);
    LayoutHelper.align(AlignmentEnum.Left, useFlowStore.getState().nodes);
    vi.runOnlyPendingTimers();
    flow.undo(); flow.redo();
    expect(useAchievementStore.getState().counters.nodes_aligned).toBe(1);
  });

  it("分组颜色实际编辑才解锁隐藏成就，导入和同色不计数", () => {
    const flow = useFlowStore.getState();
    const group = createGroupNode("group", { datas: { color: "green" } });
    flow.replace([group], [], { skipHistory: true, isFitView: false });
    flow.initHistory([group], []);
    flow.setNodeData(group.id, "direct", "color", "green");
    expect(unlocked("organize_group_color")).toBe(false);
    flow.setNodeData(group.id, "direct", "color", "purple");
    expect(unlocked("organize_group_color")).toBe(true);
    flow.saveHistory(0);
    flow.undo(); flow.redo();
    expect(useAchievementStore.getState().counters.group_color_changed).toBe(1);
    expect(achievementDefs.find((def) => def.id === "organize_group_color")?.hidden).toBe(true);
  });

  it("删除边按实际条数去重累计，自动编号、撤销重做和替换图不误计", () => {
    const flow = useFlowStore.getState();
    const source = flow.addNode();
    for (let index = 0; index < 21; index++) {
      flow.addEdge({ source, target: flow.addNode(), sourceHandle: SourceHandleTypeEnum.Next,
        targetHandle: TargetHandleTypeEnum.Target });
    }
    vi.runOnlyPendingTimers();
    const ids = useFlowStore.getState().edges.slice(0, 20).map((edge) => edge.id);
    flow.updateEdges([...ids, ids[0], "missing"].map((id) => ({ type: "remove" as const, id })));
    vi.runOnlyPendingTimers();
    expect(useAchievementStore.getState().counters.edge_deleted).toBe(20);
    expect(unlocked("connection_edges_deleted")).toBe(true);
    expect(unlocked("connection_edges_deleted_20")).toBe(true);
    expect(unlocked("connection_edges_deleted_100")).toBe(false);
    expect(unlocked("connection_reorder")).toBe(false);
    flow.updateEdges([{ type: "remove", id: ids[0] }]);
    flow.undo(); flow.redo();
    flow.replace([], [], { skipHistory: true, isFitView: false });
    expect(useAchievementStore.getState().counters.edge_deleted).toBe(20);
    expect(unlocked("connection_reorder")).toBe(false);
  });

  it.each(["label", "drag"])("%s 排序仅在实际变化时解锁，空操作和撤销重做不计数", (mode) => {
    const flow = useFlowStore.getState();
    const source = flow.addNode();
    for (let index = 0; index < 2; index++) {
      flow.addEdge({ source, target: flow.addNode(), sourceHandle: SourceHandleTypeEnum.Next,
        targetHandle: TargetHandleTypeEnum.Target });
    }
    vi.runOnlyPendingTimers();
    const ids = useFlowStore.getState().edges.map((edge) => edge.id);
    flow.setEdgeLabel("missing", 1);
    flow.setEdgeLabel(ids[0], 1);
    flow.reorderEdges(source, SourceHandleTypeEnum.Next, ids);
    flow.reorderEdges("missing", SourceHandleTypeEnum.Next, [...ids].reverse());
    expect(unlocked("connection_reorder")).toBe(false);
    if (mode === "label") flow.setEdgeLabel(ids[0], 2);
    else flow.reorderEdges(source, SourceHandleTypeEnum.Next, [...ids].reverse());
    expect(unlocked("connection_reorder")).toBe(true);
    vi.runOnlyPendingTimers();
    flow.undo(); flow.redo();
    expect(useAchievementStore.getState().counters.edge_reordered).toBe(1);
  });

  it("新编排成就仅手动成功连线触发，导入、重复连接及撤销重做不触发", () => {
    const flow = useFlowStore.getState();
    const nodes = Array.from({ length: 7 }, (_, index) => createPipelineNode(`manual-${index}`));
    flow.replace(nodes, [], { skipHistory: true, isFitView: false });
    flow.initHistory(nodes, []);
    const connection = (index: number) => ({ source: nodes[0].id, target: nodes[index].id,
      sourceHandle: SourceHandleTypeEnum.Next, targetHandle: TargetHandleTypeEnum.Target });
    for (let index = 1; index <= 6; index++) {
      flow.addEdge(connection(index));
      vi.runOnlyPendingTimers();
    }
    expect(unlocked("connection_many_paths")).toBe(false);
    flow.addEdge(connection(6), { userInitiated: true });
    expect(unlocked("connection_many_paths")).toBe(false);
    expect(flow.undo()).toBe(true);
    expect(flow.redo()).toBe(true);
    expect(unlocked("connection_many_paths")).toBe(false);
    expect(flow.undo()).toBe(true);
    expect(useFlowStore.getState().edges).toHaveLength(5);
    flow.addEdge(connection(6), { userInitiated: true });
    expect(unlocked("connection_many_paths")).toBe(true);
  });

  it("批量新增连接按条数累计，达到千丝万缕门槛", () => {
    const flow = useFlowStore.getState();
    const nodes = Array.from({ length: 11 }, (_, index) => createPipelineNode(`batch-${index}`));
    flow.replace(nodes, [], { skipHistory: true, isFitView: false });
    flow.initHistory(nodes, []);
    for (let index = 1; index <= 10; index++) {
      flow.addEdge({ source: nodes[0].id, target: nodes[index].id,
        sourceHandle: SourceHandleTypeEnum.Next, targetHandle: TargetHandleTypeEnum.Target });
    }
    vi.runOnlyPendingTimers();
    expect(useAchievementStore.getState().counters.edge_created).toBe(10);
    expect(unlocked("connection_edges")).toBe(true);
    flow.undo(); flow.redo();
    expect(useAchievementStore.getState().counters.edge_created).toBe(10);
  });

  it("批量删除按实际 Pipeline 数量累计，重复请求、便签、撤销重做和替换图不计数", () => {
    const flow = useFlowStore.getState();
    const first = flow.addNode();
    const second = flow.addNode();
    const sticker = flow.addNode({ type: NodeTypeEnum.Sticker });
    vi.runOnlyPendingTimers();
    flow.updateNodes([first, second, first, sticker, "missing"].map((id) => ({ type: "remove" as const, id })));
    vi.runOnlyPendingTimers();
    expect(useAchievementStore.getState().counters.node_deleted).toBe(2);
    expect(unlocked("canvas_nodes_deleted")).toBe(true);
    flow.updateNodes([{ type: "remove", id: first }]);
    flow.undo(); flow.redo();
    flow.replace([], [], { skipHistory: true, isFitView: false });
    expect(useAchievementStore.getState().counters.node_deleted).toBe(2);
  });

  it("便签内容与完整识别配置从真实编辑入口解锁，重启保留类型去重记录", () => {
    const flow = useFlowStore.getState();
    const sticker = flow.addNode({ type: NodeTypeEnum.Sticker });
    flow.setNodeData(sticker, "sticker", "content", "   ");
    expect(unlocked("canvas_note")).toBe(false);
    flow.setNodeData(sticker, "sticker", "content", "留给明天的说明");
    expect(unlocked("canvas_note")).toBe(true);
    const node = flow.addNode();
    flow.setNodeData(node, "type", "recognition", "OCR");
    expect(unlocked("canvas_recognition")).toBe(false);
    flow.setNodeData(node, "recognition", "expected", ["测试"]);
    expect(unlocked("canvas_recognition")).toBe(true);
    dispose();
    dispose = initializeAchievements();
    expect(useAchievementStore.getState().counters["recognition_configured:OCR"]).toBe(1);
    expect(useAchievementStore.getState().progress.canvas_variety).toBe(0.2);
  });
  it("连续创建逐个计数，便签和分组不计入 Pipeline 节点数，撤销重做不重复计数", () => {
    for (let i = 0; i < 10; i++) useFlowStore.getState().addNode();
    useFlowStore.getState().addNode({ type: NodeTypeEnum.Sticker });
    vi.runOnlyPendingTimers();
    expect(useAchievementStore.getState().counters.node_created).toBe(10);
    expect(unlocked("canvas_nodes")).toBe(true);
    useFlowStore.getState().undo(); useFlowStore.getState().redo();
    expect(useAchievementStore.getState().counters.node_created).toBe(10);
    expect(unlocked("explore_redo")).toBe(true);
  });

  it("导入图不算手动创建或编辑；真实改名和可选字段填写可解锁", () => {
    const nodes = [createPipelineNode("imported")];
    useFlowStore.getState().importHistory(nodes, []);
    useFlowStore.getState().replace(nodes, [], { skipHistory: true, isFitView: false });
    vi.runOnlyPendingTimers();
    expect(unlocked("canvas_first_node")).toBe(false);
    const flow = useFlowStore.getState();
    flow.setNodeData("imported", "data", "label", "Renamed");
    flow.setNodeData("imported", "others", "timeout", 0);
    expect(unlocked("canvas_rename")).toBe(true);
    expect(unlocked("canvas_field")).toBe(true);
  });

  it("结构成就识别 next 分支、on_error、跨文件目标和分组成员", () => {
    const flow = useFlowStore.getState();
    const source = flow.addNode(); const first = flow.addNode(); const second = flow.addNode();
    const remote = flow.addNode({ type: NodeTypeEnum.External, data: { label: "Remote" } });
    flow.setNodeData(remote, "data", "label", "Remote");
    const connect = (target: string, sourceHandle = SourceHandleTypeEnum.Next) => flow.addEdge({ source, target, sourceHandle, targetHandle: TargetHandleTypeEnum.Target });
    connect(first); connect(second); connect(remote, SourceHandleTypeEnum.Error);
    vi.runOnlyPendingTimers();
    for (const id of ["canvas_first_edge", "connection_branch", "connection_error", "connection_external"]) expect(unlocked(id), id).toBe(true);
    const group = flow.addNode({ type: NodeTypeEnum.Group });
    flow.attachNodeToGroup(first, group); flow.attachNodeToGroup(second, group);
    vi.runOnlyPendingTimers();
    expect(unlocked("explore_group_master")).toBe(true);
  });

  it("空 Pipeline 和仅配置导出不解锁，实际非空内容可解锁", () => {
    recordPipelineExport({}); recordPipelineExport({ $__mpe_config_file: {} }); recordPipelineExport("bad json");
    expect(unlocked("project_save")).toBe(false);
    recordPipelineExport({ Node: {} }); expect(unlocked("project_save")).toBe(true);
  });

  it("preparing 到终态早于 run_started 的快速流程仍准确计数", () => {
    emitAchievementEvent("debug:live-event", { sessionId: "s", runId: "r", kind: "session", phase: "starting", status: "preparing", data: { mode: "run-from-node", entry: "Entry" } });
    emitAchievementEvent("debug:live-event", { sessionId: "s", runId: "r", kind: "session", phase: "completed", status: "completed" });
    expect(unlocked("debug_first_run")).toBe(true);
  });

  it("已累计的行为可回溯，卸载或嵌入模式不会继续收集", () => {
    emitAchievementEvent("achievement:template_used");
    dispose(); useAchievementStore.setState({ unlocked: {} });
    dispose = initializeAchievements();
    expect(unlocked("organize_reuse")).toBe(true);
    dispose(); context.embedded = true; dispose = initializeAchievements();
    useFlowStore.getState().addNode();
    expect(unlocked("canvas_first_node")).toBe(false);
  });

  it("全部定义有唯一 ID 和真实统计规则", () => {
    expect(new Set(achievementDefs.map((def) => def.id)).size).toBe(achievementDefs.length);
    const counters = new Set(counterRules.map((rule) => rule.counter));
    for (const def of achievementDefs) {
      if (def.trigger.kind === "counter") expect(counters.has(def.trigger.counter), def.id).toBe(true);
      if (def.trigger.kind === "custom") {
        for (const watched of def.trigger.watch) {
          expect(counterRules.some((rule) => rule.on === watched || rule.counter === watched), def.id).toBe(true);
        }
      }
    }
  });
});
