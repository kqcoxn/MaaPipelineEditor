import { describe, expect, it } from "vitest";
import { achievementDefs } from "./defs";
import { achievementConnections, buildAchievementItems } from "./presentation";
import { layoutAchievementGraph } from "./graphLayout";

describe("成就图布局", () => {
  it("分区内部向右展开，节点位于各自分区内且互不重叠", async () => {
    const nodes = buildAchievementItems(achievementDefs, {}).map((item) => ({
      id: item.key, category: item.def.category, width: 280, height: item.tiers.length > 1 ? 280 : 160,
    }));
    const { positions, regions } = await layoutAchievementGraph(nodes, achievementConnections);
    for (const [source, target] of achievementConnections) {
      if (nodes.find((node) => node.id === source)?.category !== nodes.find((node) => node.id === target)?.category) continue;
      expect(positions[target].x).toBeGreaterThan(positions[source].x + 280);
    }
    expect(regions).toHaveLength(8);
    for (const node of nodes) {
      const region = regions.find((region) => region.category === node.category)!;
      expect(positions[node.id].x).toBeGreaterThan(region.x);
      expect(positions[node.id].y).toBeGreaterThan(region.y);
      expect(positions[node.id].x + node.width).toBeLessThan(region.x + region.width);
      expect(positions[node.id].y + node.height).toBeLessThan(region.y + region.height);
    }
    regions.forEach((a, index) => regions.slice(index + 1).forEach((b) => {
      expect(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y).toBe(true);
    }));
    nodes.forEach((a, index) => nodes.slice(index + 1).forEach((b) => {
      const p = positions[a.id];
      const q = positions[b.id];
      expect(p.x + a.width <= q.x || q.x + b.width <= p.x || p.y + a.height <= q.y || q.y + b.height <= p.y).toBe(true);
    }));
  });

  it("分类过滤后忽略外部连线，并紧凑排列调试路线", async () => {
    const nodes = [{ id: "debug_first_run", category: "debug" as const, width: 280, height: 160 }, { id: "debug_run", category: "debug" as const, width: 280, height: 280 }];
    const { positions, regions } = await layoutAchievementGraph(nodes, achievementConnections);
    expect(regions).toHaveLength(1);
    expect(Object.keys(positions)).toHaveLength(2);
    expect(positions.debug_first_run.x).toBeLessThan(40);
    expect(positions.debug_run.x).toBeLessThan(400);
    expect(Math.max(...Object.values(positions).map((p) => p.y))).toBeLessThan(200);
    expect(await layoutAchievementGraph([], achievementConnections)).toEqual({ positions: {}, regions: [] });
  });
});
