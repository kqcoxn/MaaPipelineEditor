import { describe, expect, it } from "vitest";
import { createPipelineNode, type EdgeType } from "@/stores/flow";
import type { CanvasGraphState } from "../canvas/commandBus";
import { calculateSemanticLayout } from "./layoutEngine";
import type { SemanticLayoutIntent } from "./types";

const NODE_WIDTH = 200;
const NODE_HEIGHT = 100;

function node(id: string, x = 80, y = 120) {
  const result = createPipelineNode(id, {
    label: id,
    position: { x, y },
  });
  result.measured = { width: NODE_WIDTH, height: NODE_HEIGHT };
  return result;
}

function edge(
  id: string,
  source: string,
  target: string,
  options: {
    order?: number;
    kind?: "next" | "on_error" | "jump_back";
  } = {},
): EdgeType {
  const kind = options.kind ?? "next";
  return {
    id,
    source,
    target,
    sourceHandle: (kind === "on_error" ? "on_error" : "next") as EdgeType["sourceHandle"],
    targetHandle: (kind === "jump_back" ? "jump_back" : "target") as EdgeType["targetHandle"],
    label: options.order ?? 1,
    type: "marked",
    attributes: kind === "jump_back" ? { jump_back: true } : undefined,
  };
}

function graph(nodeIds: string[], edges: EdgeType[]): CanvasGraphState {
  return {
    nodes: nodeIds.map((id, index) => node(id, 80 + index * 10, 120)),
    edges,
    selectedNodeIds: [],
    targetNodeId: null,
    fileName: "demo.json",
    prefix: "",
  };
}

function assertNoOverlap(
  positions: Record<string, { x: number; y: number }>,
): void {
  const entries = Object.entries(positions);
  entries.forEach(([leftId, left], leftIndex) => {
    entries.slice(leftIndex + 1).forEach(([rightId, right]) => {
      const separated =
        left.x + NODE_WIDTH <= right.x ||
        right.x + NODE_WIDTH <= left.x ||
        left.y + NODE_HEIGHT <= right.y ||
        right.y + NODE_HEIGHT <= left.y;
      expect(separated, `${leftId} overlaps ${rightId}`).toBe(true);
    });
  });
}

function calculateBounds(
  positions: Record<string, { x: number; y: number }>,
): { width: number; height: number } {
  const values = Object.values(positions);
  const minX = Math.min(...values.map(({ x }) => x));
  const minY = Math.min(...values.map(({ y }) => y));
  const maxX = Math.max(...values.map(({ x }) => x + NODE_WIDTH));
  const maxY = Math.max(...values.map(({ y }) => y + NODE_HEIGHT));
  return { width: maxX - minX, height: maxY - minY };
}

function centerDistance(
  positions: Record<string, { x: number; y: number }>,
  sourceId: string,
  targetId: string,
): number {
  const source = positions[sourceId];
  const target = positions[targetId];
  return Math.abs(target.x - source.x) + Math.abs(target.y - source.y);
}

describe("calculateSemanticLayout", () => {
  it("在共享阶段列中对齐候选分支并保持泳道分离", async () => {
    const source = graph(
      ["root", "a1", "a2", "b1", "b2"],
      [
        edge("root-a", "root", "a1", { order: 1 }),
        edge("root-b", "root", "b1", { order: 2 }),
        edge("a-1", "a1", "a2"),
        edge("b-1", "b1", "b2"),
      ],
    );
    const intent: SemanticLayoutIntent = {
      direction: "RIGHT",
      lanes: [
        { id: "entry", role: "primary", nodeIds: ["root"] },
        { id: "lane-b", role: "branch", nodeIds: ["b1", "b2"] },
        { id: "lane-a", role: "branch", nodeIds: ["a1", "a2"] },
      ],
      relations: [],
    };

    const result = await calculateSemanticLayout(source, intent);

    expect(result.positions.a1.x).toBe(result.positions.b1.x);
    expect(result.positions.a2.x).toBe(result.positions.b2.x);
    expect(result.positions.a1.y).toBeLessThan(result.positions.b1.y);
    expect(result.positions.root.x).toBeLessThan(result.positions.a1.x);
    assertNoOverlap(result.positions);
  });

  it("线性展开循环主体并让闭合回边不反转阅读方向", async () => {
    const source = graph(
      ["c1", "c2", "c3"],
      [
        edge("c1-c2", "c1", "c2"),
        edge("c2-c3", "c2", "c3"),
        edge("c3-c1", "c3", "c1"),
      ],
    );
    const result = await calculateSemanticLayout(source, {
      direction: "RIGHT",
      lanes: [
        { id: "cycle", role: "primary", nodeIds: ["c1", "c2", "c3"] },
      ],
      relations: [],
    });

    expect(result.positions.c1.x).toBeLessThan(result.positions.c2.x);
    expect(result.positions.c2.x).toBeLessThan(result.positions.c3.x);
    expect(result.positions.c1.y).toBe(result.positions.c2.y);
    expect(result.positions.c2.y).toBe(result.positions.c3.y);
  });

  it("在向下阅读时转置阶段与泳道约束", async () => {
    const source = graph(
      ["root", "a", "b"],
      [
        edge("root-a", "root", "a", { order: 1 }),
        edge("root-b", "root", "b", { order: 2 }),
      ],
    );
    const result = await calculateSemanticLayout(source, {
      direction: "DOWN",
      lanes: [
        { id: "entry", role: "primary", nodeIds: ["root"] },
        { id: "lane-b", role: "branch", nodeIds: ["b"] },
        { id: "lane-a", role: "branch", nodeIds: ["a"] },
      ],
      relations: [],
    });

    expect(result.positions.a.y).toBe(result.positions.b.y);
    expect(result.positions.a.x).toBeLessThan(result.positions.b.x);
    expect(result.positions.root.y).toBeLessThan(result.positions.a.y);
    assertNoOverlap(result.positions);
  });

  it("把超长连续路径折成有界的二维阅读带", async () => {
    const nodeIds = Array.from({ length: 24 }, (_, index) => `n${index + 1}`);
    const edges = nodeIds.slice(1).map((target, index) =>
      edge(`e${index + 1}`, nodeIds[index], target),
    );
    const result = await calculateSemanticLayout(graph(nodeIds, edges), {
      direction: "RIGHT",
      lanes: [{ id: "main", role: "primary", nodeIds }],
      relations: [],
    });
    const bounds = calculateBounds(result.positions);

    expect(bounds.width).toBeLessThan(3000);
    expect(bounds.height).toBeGreaterThan(NODE_HEIGHT * 2);
    expect(bounds.width / bounds.height).toBeLessThan(4);
    assertNoOverlap(result.positions);
  });

  it("存在多条支路时仍会折叠超长主泳道", async () => {
    const primaryNodeIds = Array.from(
      { length: 18 },
      (_, index) => `main-${index + 1}`,
    );
    const branchNodeIds = Array.from(
      { length: 8 },
      (_, index) => `branch-${index + 1}`,
    );
    const edges = primaryNodeIds.slice(1).map((target, index) =>
      edge(`main-edge-${index + 1}`, primaryNodeIds[index], target),
    );
    branchNodeIds.forEach((branchNodeId, index) => {
      edges.push(
        edge(
          `branch-edge-${index + 1}`,
          primaryNodeIds[index * 2],
          branchNodeId,
        ),
      );
    });
    const result = await calculateSemanticLayout(
      graph([...primaryNodeIds, ...branchNodeIds], edges),
      {
        direction: "RIGHT",
        lanes: [
          { id: "main", role: "primary", nodeIds: primaryNodeIds },
          ...branchNodeIds.map((nodeId, index) => ({
            id: `branch-${index + 1}`,
            role: "branch" as const,
            nodeIds: [nodeId],
            anchorNodeId: primaryNodeIds[index * 2],
          })),
        ],
        relations: [],
      },
    );

    expect(new Set(primaryNodeIds.map((nodeId) => result.positions[nodeId].y)).size)
      .toBeGreaterThan(1);
    expect(
      Math.max(
        ...branchNodeIds.map((nodeId, index) =>
          centerDistance(result.positions, primaryNodeIds[index * 2], nodeId),
        ),
      ),
    ).toBeLessThan(900);
    expect(calculateBounds(result.positions).height).toBeLessThan(1800);
    assertNoOverlap(result.positions);
  });

  it("从跨泳道控制边推断普通分支的局部锚点", async () => {
    const primaryNodeIds = Array.from(
      { length: 12 },
      (_, index) => `main-${index + 1}`,
    );
    const branchLanes = Array.from({ length: 4 }, (_, index) => ({
      id: `branch-${index + 1}`,
      role: "branch" as const,
      nodeIds: [`branch-${index + 1}-a`, `branch-${index + 1}-b`],
    }));
    const branchNodeIds = branchLanes.flatMap((lane) => lane.nodeIds);
    const edges = primaryNodeIds.slice(1).map((target, index) =>
      edge(`main-edge-${index + 1}`, primaryNodeIds[index], target),
    );
    branchLanes.forEach((lane, index) => {
      edges.push(
        edge(
          `branch-entry-${index + 1}`,
          primaryNodeIds[index * 3],
          lane.nodeIds[0],
        ),
        edge(`branch-next-${index + 1}`, lane.nodeIds[0], lane.nodeIds[1]),
      );
    });

    const result = await calculateSemanticLayout(
      graph([...primaryNodeIds, ...branchNodeIds], edges),
      {
        direction: "RIGHT",
        lanes: [
          { id: "main", role: "primary", nodeIds: primaryNodeIds },
          ...branchLanes,
        ],
        relations: [],
      },
    );

    branchLanes.forEach((lane, index) => {
      expect(
        centerDistance(
          result.positions,
          primaryNodeIds[index * 3],
          lane.nodeIds[0],
        ),
      ).toBeLessThan(900);
    });
    expect(calculateBounds(result.positions).height).toBeLessThan(1500);
    assertNoOverlap(result.positions);
  });

  it("向下阅读的大图仍保持折行和锚点局部性", async () => {
    const primaryNodeIds = Array.from(
      { length: 12 },
      (_, index) => `down-main-${index + 1}`,
    );
    const branchNodeIds = ["down-branch-a", "down-branch-b"];
    const edges = primaryNodeIds.slice(1).map((target, index) =>
      edge(`down-main-edge-${index + 1}`, primaryNodeIds[index], target),
    );
    edges.push(
      edge("down-branch-entry", primaryNodeIds[5], branchNodeIds[0]),
      edge("down-branch-next", branchNodeIds[0], branchNodeIds[1]),
    );

    const result = await calculateSemanticLayout(
      graph([...primaryNodeIds, ...branchNodeIds], edges),
      {
        direction: "DOWN",
        lanes: [
          { id: "main", role: "primary", nodeIds: primaryNodeIds },
          { id: "branch", role: "branch", nodeIds: branchNodeIds },
        ],
        relations: [],
      },
    );

    expect(new Set(primaryNodeIds.map((nodeId) => result.positions[nodeId].x)).size)
      .toBeGreaterThan(1);
    expect(
      centerDistance(
        result.positions,
        primaryNodeIds[5],
        branchNodeIds[0],
      ),
    ).toBeLessThan(900);
    assertNoOverlap(result.positions);
  });

  it("把大量独立语义块装入有界二维区域", async () => {
    const nodeIds = Array.from({ length: 20 }, (_, index) => `s${index + 1}`);
    const result = await calculateSemanticLayout(graph(nodeIds, []), {
      direction: "RIGHT",
      lanes: nodeIds.map((nodeId, index) => ({
        id: `support-${index + 1}`,
        role: "support",
        nodeIds: [nodeId],
      })),
      relations: [],
    });
    const bounds = calculateBounds(result.positions);

    expect(bounds.width).toBeGreaterThan(NODE_WIDTH * 2);
    expect(bounds.height).toBeLessThan(2000);
    expect(Math.max(bounds.width / bounds.height, bounds.height / bounds.width)).toBeLessThan(4);
    assertNoOverlap(result.positions);
  });

  it("把 JumpBack 和 on_error 放在来源泳道两侧并保留画布原点", async () => {
    const source = graph(
      ["root", "next", "jump", "error"],
      [
        edge("root-next", "root", "next"),
        edge("root-jump", "root", "jump", { kind: "jump_back" }),
        edge("root-error", "root", "error", { kind: "on_error" }),
      ],
    );
    const result = await calculateSemanticLayout(source, {
      direction: "RIGHT",
      lanes: [
        { id: "main", role: "primary", nodeIds: ["root", "next"] },
        {
          id: "jump",
          role: "jump_back",
          nodeIds: ["jump"],
          anchorNodeId: "root",
        },
        {
          id: "error",
          role: "error",
          nodeIds: ["error"],
          anchorNodeId: "root",
        },
      ],
      relations: [],
    });

    expect(result.positions.jump.y).toBeLessThan(result.positions.root.y);
    expect(result.positions.error.y).toBeGreaterThan(result.positions.root.y);
    expect(result.positions.jump.x).toBe(result.positions.next.x);
    expect(result.positions.error.x).toBe(result.positions.next.x);
    expect(Math.min(...Object.values(result.positions).map(({ x }) => x))).toBe(80);
    expect(Math.min(...Object.values(result.positions).map(({ y }) => y))).toBe(120);
  });

  it("拒绝 AI 引用不存在的节点", async () => {
    await expect(
      calculateSemanticLayout(graph(["root"], []), {
        direction: "RIGHT",
        lanes: [
          { id: "main", role: "primary", nodeIds: ["missing"] },
        ],
        relations: [],
      }),
    ).rejects.toThrow("不可用节点");
  });
});
