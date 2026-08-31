import { describe, expect, it } from "vitest";

import {
  NodeTypeEnum,
  SourceHandleTypeEnum,
  TargetHandleTypeEnum,
} from "@/components/flow/nodes";
import {
  buildAvoidanceNodeBounds,
  buildNodeBoundsList,
  buildParallelEdgeInfo,
  calculateAvoidancePath,
  DEFAULT_AVOIDANCE_CONFIG,
} from "@/core/avoidanceUtils";
import type { EdgeType, NodeType } from "@/stores/flow/types";

function pipeline(
  id: string,
  position: { x: number; y: number },
  parentId?: string,
  measured: { width: number; height: number } | null = {
    width: 120,
    height: 60,
  },
): NodeType {
  return {
    id,
    type: NodeTypeEnum.Pipeline,
    data: {
      label: id,
      recognition: { type: "", param: {} },
      action: { type: "", param: {} },
      others: {},
    },
    position,
    ...(measured ? { measured } : {}),
    ...(parentId ? { parentId } : {}),
  } as NodeType;
}

function group(
  id: string,
  position: { x: number; y: number },
): NodeType {
  return {
    id,
    type: NodeTypeEnum.Group,
    data: { label: id, color: "blue" },
    position,
    measured: { width: 500, height: 300 },
  } as NodeType;
}

function edge(id: string, source: string, target: string): EdgeType {
  return {
    id,
    source,
    sourceHandle: SourceHandleTypeEnum.Next,
    target,
    targetHandle: TargetHandleTypeEnum.Target,
    label: 1,
    type: "marked",
  };
}

describe("避让走线公共输入", () => {
  it("只保留非 Group 节点，并按父链计算绝对边界", () => {
    const nodes = [
      group("group", { x: 100, y: 200 }),
      pipeline("child", { x: 30, y: 40 }, "group"),
      pipeline("root", { x: 10, y: 20 }),
    ];

    expect(buildAvoidanceNodeBounds(nodes)).toEqual([
      {
        id: "child",
        minX: 130,
        minY: 240,
        maxX: 250,
        maxY: 300,
      },
      {
        id: "root",
        minX: 10,
        minY: 20,
        maxX: 130,
        maxY: 80,
      },
    ]);
  });

  it("按边数组顺序生成平行边索引，非平行边保持独立", () => {
    const info = buildParallelEdgeInfo([
      edge("a", "source", "target"),
      edge("b", "source", "target"),
      edge("c", "target", "source"),
      edge("d", "source", "target"),
    ]);

    expect(info.get("a")).toEqual({ edgeIndex: 0, totalParallelEdges: 3 });
    expect(info.get("b")).toEqual({ edgeIndex: 1, totalParallelEdges: 3 });
    expect(info.get("d")).toEqual({ edgeIndex: 2, totalParallelEdges: 3 });
    expect(info.get("c")).toEqual({ edgeIndex: 0, totalParallelEdges: 1 });
  });

  it("共享边界输入与原有边界构建产生相同路径", () => {
    const nodes = [
      group("group", { x: 100, y: 200 }),
      pipeline("source", { x: 0, y: 0 }),
      pipeline("obstacle", { x: 200, y: -20 }),
      pipeline("target", { x: 400, y: 0 }),
    ];
    const excludeIds = new Set(["source", "target"]);
    const legacyBounds = buildNodeBoundsList(nodes).filter(
      (bounds) => nodes.find((node) => node.id === bounds.id)?.type !== "group",
    );
    const sharedBounds = buildAvoidanceNodeBounds(nodes);

    const legacyPath = calculateAvoidancePath(
      { x: 200, y: 30 },
      { x: 400, y: 30 },
      "right",
      "left",
      legacyBounds,
      excludeIds,
      DEFAULT_AVOIDANCE_CONFIG,
    );
    const sharedPath = calculateAvoidancePath(
      { x: 200, y: 30 },
      { x: 400, y: 30 },
      "right",
      "left",
      sharedBounds,
      excludeIds,
      DEFAULT_AVOIDANCE_CONFIG,
    );

    expect(sharedPath).toEqual(legacyPath);
  });

  it("未测量节点使用稳定的默认尺寸", () => {
    const bounds = buildAvoidanceNodeBounds([
      pipeline("unmeasured", { x: 20, y: 30 }, undefined, null),
    ]);

    expect(bounds).toEqual([
      {
        id: "unmeasured",
        minX: 20,
        minY: 30,
        maxX: 220,
        maxY: 130,
      },
    ]);
  });

  it("自循环使用节点边界绕行，并记录所属节点依赖", () => {
    const node = pipeline("loop", { x: 100, y: 100 });
    const bounds = buildAvoidanceNodeBounds([node]);
    const result = calculateAvoidancePath(
      { x: 220, y: 130 },
      { x: 100, y: 130 },
      "right",
      "left",
      bounds,
      new Set([node.id]),
      DEFAULT_AVOIDANCE_CONFIG,
    );

    expect(result.points.length).toBeGreaterThan(2);
    expect(result.blockingNodeIds).toEqual([node.id]);
    expect(result.path).toContain("Q");
  });

  it("平行边索引保持不同的路径偏移", () => {
    const nodes = [
      pipeline("source", { x: 0, y: 0 }),
      pipeline("target", { x: 400, y: 0 }),
    ];
    const bounds = buildAvoidanceNodeBounds(nodes);
    const first = calculateAvoidancePath(
      { x: 120, y: 30 },
      { x: 400, y: 30 },
      "right",
      "left",
      bounds,
      new Set(["source", "target"]),
      DEFAULT_AVOIDANCE_CONFIG,
      0,
      2,
    );
    const second = calculateAvoidancePath(
      { x: 120, y: 30 },
      { x: 400, y: 30 },
      "right",
      "left",
      bounds,
      new Set(["source", "target"]),
      DEFAULT_AVOIDANCE_CONFIG,
      1,
      2,
    );

    expect(second.path).not.toBe(first.path);
    expect(second.points).not.toEqual(first.points);
  });
});
