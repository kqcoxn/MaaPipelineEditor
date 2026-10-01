import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGroupNode, createPipelineNode, useFlowStore } from "../stores/flow";
import { AlignmentEnum, LayoutHelper } from "./layout";

vi.mock("../stores/ui/processStore", async (importOriginal) => ({
  ...await importOriginal<typeof import("../stores/ui/processStore")>(),
  runWithProcess: async (_label: string, task: (update: () => void) => Promise<void>) => task(() => {}),
}));

function fixture() {
  return [
    { ...createGroupNode("g", { position: { x: 800, y: 900 } }), measured: { width: 200, height: 150 }, style: { width: 200, height: 150 } },
    { ...createPipelineNode("a", { position: { x: 40, y: 76 } }), parentId: "g", measured: { width: 200, height: 100 } },
    { ...createPipelineNode("b", { position: { x: 40, y: 76 } }), parentId: "g", measured: { width: 200, height: 100 } },
  ];
}
const geometry = () => useFlowStore.getState().nodes.map((node) => ({
  id: node.id, position: node.position, measured: node.measured,
  style: "style" in node ? node.style : undefined,
}));

describe("布局提交与撤销", () => {
  beforeEach(() => {
    const state = useFlowStore.getState();
    state.replace(fixture(), [], { isFitView: false, skipHistory: true });
    state.initHistory([], []);
  });

  it("组内布局的位置和尺寸作为一次历史操作撤销、重做，并保留选择", async () => {
    useFlowStore.getState().selectNodeIds(["g"]);
    const before = geometry();
    await LayoutHelper.autoPartial(useFlowStore.getState().selectedNodes);
    await vi.waitFor(() => expect(useFlowStore.getState().historyIndex).toBe(1));
    const after = geometry();
    expect(after).not.toEqual(before);
    expect(useFlowStore.getState().selectedNodes.map((node) => node.id)).toEqual(["g"]);
    expect(useFlowStore.getState().selectedNodes[0]).toBe(useFlowStore.getState().nodeById.get("g"));
    expect(useFlowStore.getState().undo()).toBe(true);
    expect(geometry()).toEqual(before);
    expect(useFlowStore.getState().redo()).toBe(true);
    expect(geometry()).toEqual(after);
  });

  it("父子混选对齐只移动父节点，随后调整间距仍能使用当前选择", () => {
    const state = useFlowStore.getState();
    state.replace([...fixture(), { ...createPipelineNode("outside", { position: { x: 0, y: 0 } }), measured: { width: 100, height: 100 } }], [], { isFitView: false });
    state.selectNodeIds(["g", "a", "outside"]);
    LayoutHelper.align(AlignmentEnum.Top, useFlowStore.getState().selectedNodes);
    expect(useFlowStore.getState().nodeById.get("g")?.position.y).toBe(0);
    expect(useFlowStore.getState().nodeById.get("a")?.position).toEqual({ x: 40, y: 76 });
    expect(useFlowStore.getState().selectedNodes).toHaveLength(3);
    state.shiftNodes("horizontal", 5, useFlowStore.getState().selectedNodes.map((node) => node.id));
    expect(useFlowStore.getState().nodeById.get("g")?.position.x).toBe(840);
    expect(useFlowStore.getState().nodeById.get("a")?.position.x).toBe(40);
  });
});
