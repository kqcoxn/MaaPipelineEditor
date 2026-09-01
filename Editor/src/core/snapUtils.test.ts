import { describe, expect, it } from "vitest";
import {
  buildSnapAlignmentIndex,
  findSnapAlignmentWithIndex,
  type SnapNodeRect,
  type SnapResult,
} from "./snapUtils";

function findSnapAlignmentLegacy(
  draggedNode: SnapNodeRect,
  otherNodes: SnapNodeRect[],
  threshold = 5,
): SnapResult {
  const getPoints = (node: SnapNodeRect) => {
    const width = node.measured?.width ?? 0;
    const height = node.measured?.height ?? 0;
    return {
      x: [
        node.position.x,
        node.position.x + width / 2,
        node.position.x + width,
      ],
      y: [
        node.position.y,
        node.position.y + height / 2,
        node.position.y + height,
      ],
    };
  };
  const draggedPoints = getPoints(draggedNode);
  let bestXDistance = threshold;
  let bestYDistance = threshold;
  let snapX: number | null = null;
  let snapY: number | null = null;
  let xLine: number | null = null;
  let yLine: number | null = null;

  for (const otherNode of otherNodes) {
    if (!otherNode.measured) continue;
    const otherPoints = getPoints(otherNode);
    for (const draggedX of draggedPoints.x) {
      for (const otherX of otherPoints.x) {
        const distance = Math.abs(draggedX - otherX);
        if (distance < bestXDistance) {
          bestXDistance = distance;
          snapX = otherX - (draggedX - draggedNode.position.x);
          xLine = otherX;
        }
      }
    }
    for (const draggedY of draggedPoints.y) {
      for (const otherY of otherPoints.y) {
        const distance = Math.abs(draggedY - otherY);
        if (distance < bestYDistance) {
          bestYDistance = distance;
          snapY = otherY - (draggedY - draggedNode.position.y);
          yLine = otherY;
        }
      }
    }
  }

  return {
    position: {
      x: snapX ?? draggedNode.position.x,
      y: snapY ?? draggedNode.position.y,
    },
    guidelines: [
      ...(xLine === null
        ? []
        : [{ type: "vertical" as const, position: xLine }]),
      ...(yLine === null
        ? []
        : [{ type: "horizontal" as const, position: yLine }]),
    ],
  };
}

function createNode(
  id: string,
  x: number,
  y: number,
  width = 100,
  height = 60,
): SnapNodeRect {
  return { id, position: { x, y }, measured: { width, height } };
}

describe("snap alignment index", () => {
  it("matches all legacy left/center/right and top/center/bottom combinations", () => {
    const candidate = createNode("candidate", 300, 200, 120, 80);
    const xCoordinates = [300, 360, 420];
    const yCoordinates = [200, 240, 280];

    for (let draggedXPoint = 0; draggedXPoint < 3; draggedXPoint += 1) {
      for (let candidateXPoint = 0; candidateXPoint < 3; candidateXPoint += 1) {
        for (let draggedYPoint = 0; draggedYPoint < 3; draggedYPoint += 1) {
          for (let candidateYPoint = 0; candidateYPoint < 3; candidateYPoint += 1) {
            const draggedNode = createNode(
              "dragged",
              xCoordinates[candidateXPoint] - [0, 50, 100][draggedXPoint] + 2,
              yCoordinates[candidateYPoint] - [0, 30, 60][draggedYPoint] - 2,
            );
            const indexed = findSnapAlignmentWithIndex(
              draggedNode,
              buildSnapAlignmentIndex([candidate]),
            );

            expect({
              position: indexed.position,
              guidelines: indexed.guidelines,
            }).toEqual(findSnapAlignmentLegacy(draggedNode, [candidate]));
          }
        }
      }
    }
  });

  it("preserves legacy tie order and strict threshold semantics", () => {
    const candidates = [
      createNode("first", 100, 100),
      createNode("second", 108, 108),
      { id: "unmeasured", position: { x: 104, y: 104 } },
    ];
    const indexed = buildSnapAlignmentIndex(candidates);

    for (const draggedNode of [
      createNode("dragged", 54, 54),
      createNode("dragged", 55, 55),
      createNode("dragged", 103, 103),
    ]) {
      const result = findSnapAlignmentWithIndex(draggedNode, indexed);
      expect({
        position: result.position,
        guidelines: result.guidelines,
      }).toEqual(findSnapAlignmentLegacy(draggedNode, candidates));
    }
  });

  it("checks a constant number of coordinates per query", () => {
    const candidates = Array.from({ length: 300 }, (_, index) =>
      createNode(`node-${index}`, index * 37, index * 23),
    );
    const result = findSnapAlignmentWithIndex(
      createNode("dragged", 5_000, 4_000),
      buildSnapAlignmentIndex(candidates),
    );

    expect(result.inspectedCoordinates).toBeLessThanOrEqual(12);
  });

  it("matches the legacy scan across deterministic varied layouts", () => {
    let seed = 0x5eed013;
    const random = () => {
      seed = (seed * 1_664_525 + 1_013_904_223) >>> 0;
      return seed / 0x1_0000_0000;
    };

    for (let layoutIndex = 0; layoutIndex < 100; layoutIndex += 1) {
      const candidates = Array.from({ length: 30 }, (_, nodeIndex) =>
        createNode(
          `node-${nodeIndex}`,
          Math.round(random() * 2_000),
          Math.round(random() * 1_500),
          40 + Math.round(random() * 160),
          30 + Math.round(random() * 100),
        ),
      );
      const draggedNode = createNode(
        "dragged",
        Math.round(random() * 2_000),
        Math.round(random() * 1_500),
        40 + Math.round(random() * 160),
        30 + Math.round(random() * 100),
      );
      const indexed = findSnapAlignmentWithIndex(
        draggedNode,
        buildSnapAlignmentIndex(candidates),
      );

      expect({
        position: indexed.position,
        guidelines: indexed.guidelines,
      }).toEqual(findSnapAlignmentLegacy(draggedNode, candidates));
    }
  });
});
