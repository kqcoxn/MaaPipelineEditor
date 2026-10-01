import { describe, expect, it } from "vitest";
import { layoutGraph, projectLayoutEdges } from "./groupLayout";
import { dimensions, fitGroup, layoutRoots, shiftLayoutNodes } from "./layoutGeometry";
import { NodeTypeEnum } from "../components/flow/nodes/constants";
import type { EdgeType, NodeType } from "../stores/flow/types";
import { getNodeAbsolutePosition } from "../stores/flow/utils/coordinateUtils";

function node(id: string, x: number, y: number, parentId?: string, group = false): NodeType {
  return {
    id, type: group ? NodeTypeEnum.Group : NodeTypeEnum.Pipeline,
    position: { x, y }, parentId,
    measured: { width: group ? 500 : 120, height: group ? 300 : 80 },
    data: { label: id },
  } as NodeType;
}
const edge = (source: string, target: string) => ({ id: `${source}-${target}`, source, target }) as EdgeType;
const find = (nodes: NodeType[], id: string) => nodes.find((node) => node.id === id)!;
function expectContained(nodes: NodeType[], childId: string, groupId: string) {
  const child = find(nodes, childId);
  const group = find(nodes, groupId);
  expect(child.position.x).toBeGreaterThanOrEqual(40);
  expect(child.position.y).toBeGreaterThanOrEqual(76);
  expect(child.position.x + dimensions(child).width + 40).toBeLessThanOrEqual(dimensions(group).width);
  expect(child.position.y + dimensions(child).height + 40).toBeLessThanOrEqual(dimensions(group).height);
}

describe("分组布局（真实 ELK）", () => {
  it("默认同时整理组内与组间，跨组连线决定组间顺序", async () => {
    const nodes = [node("g2", 0, 0, undefined, true), node("g1", 1000, 200, undefined, true), node("a", 40, 76, "g1"), node("b", 200, 100, "g2")];
    const edges = [edge("a", "b")];
    const result = await layoutGraph(nodes, edges);
    expect(find(result, "g1").position.x + dimensions(find(result, "g1")).width).toBeLessThan(find(result, "g2").position.x);
    expectContained(result, "a", "g1");
    expectContained(result, "b", "g2");
    expect(find(result, "b").position).toEqual({ x: 40, y: 76 });
    expect(edges).toEqual([edge("a", "b")]);
  });

  it("单组内部布局保持分组位置，自动扩大并避开标题", async () => {
    const nodes = [node("g", 900, -500, undefined, true), node("a", 10, 0, "g"), node("b", 0, 0, "g"), node("c", 0, 0, "g"), node("outside", 20, 30)];
    const result = await layoutGraph(nodes, [edge("a", "b"), edge("b", "c")], { ids: ["g"] });
    expect(find(result, "g").position).toEqual({ x: 900, y: -500 });
    for (const id of ["a", "b", "c"]) expectContained(result, id, "g");
    expect(dimensions(find(result, "g")).width).toBeGreaterThan(500);
    expect(find(result, "outside")).toBe(find(nodes, "outside"));
    expect(find(result, "b").position.x).toBeGreaterThan(find(result, "a").position.x);
  });

  it("组内局部排版避让未选节点且不改变其绝对位置", async () => {
    const nodes = [node("g", 800, 900, undefined, true), node("a", 40, 76, "g"), node("b", 40, 400, "g"), node("fixed", 180, 76, "g")];
    const result = await layoutGraph(nodes, [edge("a", "b")], { ids: ["a", "b"] });
    expect(getNodeAbsolutePosition(find(result, "fixed"), result)).toEqual(getNodeAbsolutePosition(find(nodes, "fixed"), nodes));
    expect(find(result, "a").position.y).toBeGreaterThanOrEqual(196);
    expectContained(result, "a", "g");
    expectContained(result, "b", "g");
  });

  it("拒绝跨层混选，父子同时选中只保留父节点", async () => {
    const nodes = [node("g", 0, 0, undefined, true), node("a", 5, 10, "g"), node("outside", 800, 0)];
    await expect(layoutGraph(nodes, [], { ids: ["a", "outside"] })).rejects.toThrow("同一分组");
    expect(layoutRoots(nodes, ["g", "a", "outside"]).map((n) => n.id)).toEqual(["g", "outside"]);
    const result = await layoutGraph(nodes, [], { ids: ["g", "a", "outside"] });
    expectContained(result, "a", "g");
    expect(find(result, "a").position).toEqual({ x: 40, y: 76 });
    const parentAndChild = await layoutGraph(nodes, [], { ids: ["g", "a"] });
    const parentOnly = await layoutGraph(nodes, [], { ids: ["g"] });
    expect(parentAndChild).toEqual(parentOnly);
  });

  it("递归重排先计算内层尺寸，再排列外层；重复运行位置稳定", async () => {
    const nodes = [node("outer", 700, 200, undefined, true), node("inner", 30, 20, "outer", true), node("a", 5, 2, "inner"), node("b", 1, 1, "inner"), node("c", 0, 0, "inner"), node("peer", 0, 0, "outer"), node("outside", 0, 0)];
    const edges = [edge("a", "b"), edge("b", "c"), edge("c", "peer"), edge("peer", "outside")];
    const result = await layoutGraph(nodes, edges);
    for (const id of ["a", "b", "c"]) expectContained(result, id, "inner");
    expectContained(result, "inner", "outer");
    expectContained(result, "peer", "outer");
    expect(find(result, "outside").position.x).toBeGreaterThan(find(result, "outer").position.x + dimensions(find(result, "outer")).width);
    const again = await layoutGraph(result, edges);
    expect(again.map((n) => n.position)).toEqual(result.map((n) => n.position));
  });

  it("分组适应内容保持子节点绝对坐标；空分组使用最小尺寸", () => {
    const nodes = [node("g", -600, 700, undefined, true), node("a", -50, 20, "g")];
    const result = fitGroup(nodes, "g", true);
    expect(getNodeAbsolutePosition(find(result, "a"), result)).toEqual(getNodeAbsolutePosition(find(nodes, "a"), nodes));
    expectContained(result, "a", "g");
    expect(dimensions(find(result, "g")).width).toBe(200);
    const empty = fitGroup([nodes[0]], "g", true);
    expect(dimensions(empty[0])).toMatchObject({ width: 200, height: 150 });
  });

  it("连线投影去掉组内自环、悬空边及重复组间边", () => {
    const nodes = [node("g", 0, 0, undefined, true), node("a", 0, 0, "g"), node("b", 0, 0, "g"), node("c", 0, 0)];
    expect(projectLayoutEdges(nodes, [edge("a", "b"), edge("a", "c"), edge("b", "c"), edge("missing", "c")], layoutRoots(nodes))).toEqual([{ id: "a-c", sources: ["g"], targets: ["c"] }]);
  });

  it("间距调整仅移动整体，父子不会重复移动；拒绝跨组子节点", () => {
    const nodes = [node("g", 400, 100, undefined, true), node("a", 40, 76, "g"), node("outside", 0, 0)];
    const result = shiftLayoutNodes(nodes, "horizontal", 5, ["g", "a", "outside"]);
    expect(find(result, "g").position.x).toBe(420);
    expect(find(result, "a").position).toEqual({ x: 40, y: 76 });
    expect(getNodeAbsolutePosition(find(result, "a"), result).x).toBe(460);
    expect(() => shiftLayoutNodes(nodes, "horizontal", 5, ["a", "outside"])).toThrow("同一分组");
  });
});
