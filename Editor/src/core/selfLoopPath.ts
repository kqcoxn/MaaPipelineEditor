import { buildPathString, type Point } from "./avoidanceUtils";

type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

/** 自环沿节点外侧绕行，标签固定在外侧横/竖段，避免被节点遮挡。 */
export function getSelfLoopPath({
  source, target, sourcePosition, bounds, error = false, jumpBack = false,
  radius = 8, offset = { x: 0, y: 0 },
}: {
  source: Point;
  target: Point;
  sourcePosition: string;
  bounds: Bounds;
  error?: boolean;
  jumpBack?: boolean;
  radius?: number;
  offset?: Point;
}) {
  const horizontal = sourcePosition === "left" || sourcePosition === "right";
  // next 与 on_error 分居两侧，JumpBack 再向外错开一条轨道。
  const margin = 20 + (jumpBack ? 20 : 0);
  const side = error ? 1 : -1;
  const displacement = horizontal ? offset.y : offset.x;
  const clearance = Math.max(18, margin + side * displacement);
  let points: Point[];
  let labelX: number;
  let labelY: number;

  if (horizontal) {
    const left = Math.min(bounds.minX, source.x, target.x) - margin;
    const right = Math.max(bounds.maxX, source.x, target.x) + margin;
    const sourceOuter = sourcePosition === "right" ? right : left;
    const targetOuter = sourcePosition === "right" ? left : right;
    labelY = error ? bounds.maxY + clearance : bounds.minY - clearance;
    labelX = Math.max(left + 16, Math.min(right - 16,
      (bounds.minX + bounds.maxX) / 2 + offset.x));
    points = [source, { x: sourceOuter, y: source.y },
      { x: sourceOuter, y: labelY }, { x: targetOuter, y: labelY },
      { x: targetOuter, y: target.y }, target];
  } else {
    const top = Math.min(bounds.minY, source.y, target.y) - margin;
    const bottom = Math.max(bounds.maxY, source.y, target.y) + margin;
    const sourceOuter = sourcePosition === "bottom" ? bottom : top;
    const targetOuter = sourcePosition === "bottom" ? top : bottom;
    labelX = error ? bounds.maxX + clearance : bounds.minX - clearance;
    labelY = Math.max(top + 16, Math.min(bottom - 16,
      (bounds.minY + bounds.maxY) / 2 + offset.y));
    points = [source, { x: source.x, y: sourceOuter },
      { x: labelX, y: sourceOuter }, { x: labelX, y: targetOuter },
      { x: target.x, y: targetOuter }, target];
  }

  return { path: buildPathString(points, radius), labelX, labelY, points };
}
