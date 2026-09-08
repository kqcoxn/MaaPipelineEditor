import { describe, expect, it } from "vitest";
import { achievementDefs } from "./defs";
import { achievementConnections, buildAchievementItems, getAchievementProgress } from "./presentation";

describe("成就展示模型", () => {
  it("保留最高已解锁档，同时暴露下一档及真实累计进度", () => {
    const items = buildAchievementItems(achievementDefs, { canvas_nodes_10: { at: 1 } });
    const series = items.find((item) => item.key === "node_created")!;
    expect(series.def.id).toBe("canvas_nodes_10");
    expect(series.next?.id).toBe("canvas_nodes_50");
    expect(series.complete).toBe(false);
    expect(getAchievementProgress(series.next!, { node_created: 27 }, {}, false)).toEqual({ percent: 54, label: "27 / 50" });
  });

  it("全档解锁后保留最高档，且不再显示下一目标", () => {
    const series = buildAchievementItems(achievementDefs, {
      canvas_nodes_10: { at: 1 }, canvas_nodes_50: { at: 2 }, canvas_nodes_200: { at: 3 },
    }).find((item) => item.key === "node_created")!;
    expect(series.def.id).toBe("canvas_nodes_200");
    expect(series.complete).toBe(true);
    expect(series.next).toBeUndefined();
  });

  it("非连续解锁记录仍能找到未完成的低档目标", () => {
    const series = buildAchievementItems(achievementDefs, { canvas_nodes_50: { at: 1 } }).find((item) => item.key === "node_created")!;
    expect(series.def.id).toBe("canvas_nodes_50");
    expect(series.next?.id).toBe("canvas_nodes_10");
    expect(series.unlockedCount).toBe(1);
  });

  it("每项定义只归入一个展示项，路线端点有效", () => {
    const items = buildAchievementItems(achievementDefs, {});
    expect(items.flatMap((item) => item.tiers)).toHaveLength(achievementDefs.length);
    const keys = new Set(items.map((item) => item.key));
    for (const [source, target] of achievementConnections) {
      expect(keys.has(source)).toBe(true);
      expect(keys.has(target)).toBe(true);
    }

  });
});
