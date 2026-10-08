import { describe, expect, it } from "vitest";
import { getSelfLoopPath } from "./selfLoopPath";

const bounds = { minX: 100, minY: 200, maxX: 420, maxY: 380 };
const directions = [
  { sourcePosition: "right", source: { x: 420, y: 260 }, target: { x: 100, y: 260 } },
  { sourcePosition: "left", source: { x: 100, y: 260 }, target: { x: 420, y: 260 } },
  { sourcePosition: "bottom", source: { x: 200, y: 380 }, target: { x: 200, y: 200 } },
  { sourcePosition: "top", source: { x: 200, y: 200 }, target: { x: 200, y: 380 } },
];

describe("self-loop routing", () => {
  it.each(directions)("keeps $sourcePosition loops and labels outside the node", (direction) => {
    for (const error of [false, true]) {
      for (const radius of [0, 16]) {
        const result = getSelfLoopPath({ ...direction, bounds, error, radius });
        expect(result.points[0]).toEqual(direction.source);
        expect(result.points.at(-1)).toEqual(direction.target);
        // 每段必须在卡片边界之外，不能仅检查折点而漏掉穿过节点的线段。
        for (let i = 1; i < result.points.length; i++) {
          const a = result.points[i - 1];
          const b = result.points[i];
          expect(
            Math.max(a.x, b.x) <= bounds.minX ||
            Math.min(a.x, b.x) >= bounds.maxX ||
            Math.max(a.y, b.y) <= bounds.minY ||
            Math.min(a.y, b.y) >= bounds.maxY,
          ).toBe(true);
        }
        expect(result.labelX < bounds.minX || result.labelX > bounds.maxX ||
          result.labelY < bounds.minY || result.labelY > bounds.maxY).toBe(true);
        expect(result.path).not.toMatch(/NaN|Infinity/);
      }
    }
  });

  it("separates next, error and jump-back lanes", () => {
    const input = { ...directions[0], bounds };
    const next = getSelfLoopPath(input);
    const error = getSelfLoopPath({ ...input, error: true });
    const jump = getSelfLoopPath({ ...input, jumpBack: true });
    expect(next.labelY).toBeLessThan(bounds.minY);
    expect(error.labelY).toBeGreaterThan(bounds.maxY);
    expect(jump.labelY).toBeLessThan(next.labelY);
  });

  it("clamps dragging toward the card and follows resized absolute bounds", () => {
    const input = { ...directions[0], bounds };
    const dragged = getSelfLoopPath({ ...input, offset: { x: 0, y: 1000 } });
    expect(dragged.labelY).toBeLessThan(bounds.minY - 16);
    const resized = getSelfLoopPath({ ...input, bounds: { ...bounds, minY: -100 } });
    expect(resized.labelY).toBeLessThan(-100);
    expect(getSelfLoopPath({ ...input, offset: { x: 0, y: -80 } }).labelY)
      .toBeLessThan(getSelfLoopPath(input).labelY);
  });
});
