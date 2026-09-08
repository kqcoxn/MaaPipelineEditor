import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFlowStore, createPipelineNode } from "@/stores/flow";
import { useAchievementStore } from "@/stores/achievement/achievementStore";
import { NodeTypeEnum, SourceHandleTypeEnum, TargetHandleTypeEnum } from "@/components/flow/nodes/constants";
import { emitAchievementEvent } from "./bus";
import { initializeAchievements } from "./listeners";
import { achievementDefs, counterRules } from "./defs";
import { recordPipelineExport } from "./exportEvents";

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
  it("连续创建逐个计数，便签和分组不计入 Pipeline 节点数，撤销重做不重复计数", () => {
    for (let i = 0; i < 10; i++) useFlowStore.getState().addNode();
    useFlowStore.getState().addNode({ type: NodeTypeEnum.Sticker });
    vi.runOnlyPendingTimers();
    expect(useAchievementStore.getState().counters.node_created).toBe(10);
    expect(unlocked("canvas_nodes_10")).toBe(true);
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
      expect(def.trigger.kind).toBe("counter");
      if (def.trigger.kind === "counter") expect(counters.has(def.trigger.counter), def.id).toBe(true);
    }
  });
});
