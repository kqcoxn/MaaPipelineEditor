import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createPipelineNode } from "@/stores/flow/utils/nodeUtils";
import { SourceHandleTypeEnum, TargetHandleTypeEnum } from "@/components/flow/nodes/constants";
import type { EdgeType } from "@/stores/flow/types";
import { subscribeAchievementEvents } from "./bus";
import { createManualConnectionTracker } from "./connectionProgress";

const nodes = Array.from({ length: 30 }, (_, index) => createPipelineNode(String(index)));
const edge = (source: number, target: number, error = false): EdgeType => ({
  id: `${source}-${target}`, source: String(source), target: String(target),
  sourceHandle: error ? SourceHandleTypeEnum.Error : SourceHandleTypeEnum.Next,
  targetHandle: TargetHandleTypeEnum.Target,
  label: 1, type: "marked",
});
let tracker: ReturnType<typeof createManualConnectionTracker>;
const recordManualConnection = (graph: Parameters<typeof tracker.record>[0]) => tracker.record(graph);
let events: string[];
let dispose: () => void;
beforeEach(() => { tracker = createManualConnectionTracker(); events = []; dispose = subscribeAchievementEvents((event) => events.push(event.type)); });
afterEach(() => { dispose(); tracker.dispose(); });
function connect(beforeEdges: EdgeType[], added: EdgeType) {
  recordManualConnection({ nodes, beforeEdges, edges: [...beforeEdges, added] });
}
const awarded = (id: string) => events.includes(`achievement:connection_${id}`);

describe("手动编排结构", () => {
  it("20 个节点不解锁，21 个节点解锁，也支持从中间接通两段", () => {
    const chain = Array.from({ length: 20 }, (_, index) => edge(index, index + 1));
    connect(chain.slice(0, 18), chain[18]);
    expect(awarded("chain")).toBe(false);
    connect(chain.filter((_, index) => index !== 9), chain[9]);
    expect(awarded("chain")).toBe(true);
  });

  it("导入结构和无关连接不解锁连续路径", () => {
    const chain = Array.from({ length: 20 }, (_, index) => edge(index, index + 1));
    recordManualConnection({ nodes, beforeEdges: chain, edges: chain });
    connect(chain, edge(25, 26));
    expect(awarded("chain")).toBe(false);
  });

  it("分支宽度不能冒充连续路径，短环也不能重复凑数", () => {
    const branches = Array.from({ length: 25 }, (_, index) => edge(0, index + 1));
    connect(branches, edge(26, 0));
    expect(awarded("chain")).toBe(false);
    connect([edge(0, 1)], edge(1, 0));
    expect(awarded("chain")).toBe(false);
    expect(awarded("cycle")).toBe(true);
  });

  it("5 个 next 目标不解锁，6 个不同目标解锁；重复目标不凑数", () => {
    const branches = Array.from({ length: 5 }, (_, index) => edge(0, index + 1));
    connect(branches.slice(0, 4), branches[4]);
    expect(awarded("many_paths")).toBe(false);
    connect(branches, { ...edge(0, 1), id: "duplicate" });
    expect(awarded("many_paths")).toBe(false);
    connect(branches, edge(0, 6));
    expect(awarded("many_paths")).toBe(true);
  });

  it("汇合统计不同来源，on_error 不混入 next", () => {
    connect([edge(0, 3), edge(1, 3, true)], edge(2, 3));
    expect(awarded("merge")).toBe(false);
    connect([edge(0, 3), edge(1, 3)], edge(2, 3));
    expect(awarded("merge")).toBe(true);
  });

  it("自环不解锁又回来了，闭合多节点 next 环才解锁", () => {
    connect([], edge(0, 0));
    expect(awarded("cycle")).toBe(false);
    connect([edge(0, 1), edge(1, 2)], edge(2, 0));
    expect(awarded("cycle")).toBe(true);
  });

  it.each([true, false])("两层 on_error 无论先接哪层都解锁：%s", (reverse) => {
    const first = edge(0, 1, true);
    const second = edge(1, 2, true);
    connect([reverse ? second : first], reverse ? first : second);
    expect(awarded("error_chain")).toBe(true);
  });

  it("单个错误自环和 on_error 后接 next 不算还有后手", () => {
    connect([], edge(0, 0, true));
    connect([edge(1, 2)], edge(0, 1, true));
    expect(awarded("error_chain")).toBe(false);
  });
});
