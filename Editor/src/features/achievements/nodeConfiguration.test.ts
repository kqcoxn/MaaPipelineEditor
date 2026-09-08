import { describe, expect, it } from "vitest";
import { applyCounterRules, evaluateAchievement } from "./engine";
import { counterRules } from "./defs/counters";
import { canvasAchievements } from "./defs/canvas";
import { configurationVariety } from "./nodeConfiguration";

describe("节点成就计数", () => {
  it("识别与动作分别去重，重复配置及默认类型不能凑数", () => {
    const counters: Record<string, number> = {};
    const configure = (kind: string, type: string) => {
      const delta = applyCounterRules(counterRules, { type: `achievement:${kind}_configured`, payload: { type }, at: 1 });
      for (const [key, value] of Object.entries(delta)) counters[key] = (counters[key] ?? 0) + value;
    };
    for (const type of ["DirectHit", "OCR", "OCR", "TemplateMatch", "ColorMatch"]) configure("recognition", type);
    for (const type of ["DoNothing", "Click", "Swipe"]) configure("action", type);
    const ctx = { counters, unlocked: {}, now: 1 };
    expect(configurationVariety(ctx)).toBe(0.6);
    for (const type of ["Custom", "FeatureMatch"]) configure("recognition", type);
    expect(configurationVariety(ctx)).toBe(1);
  });

  it("五种动作可独立达成", () => {
    const counters = Object.fromEntries(["Click", "Swipe", "Key", "InputText", "StartApp"].map((type) => [`action_configured:${type}`, 1]));
    expect(configurationVariety({ counters, unlocked: {}, now: 1 })).toBe(1);
  });

  it("每次粘贴只累计一次，各系列按累计阈值解锁", () => {
    expect(applyCounterRules(counterRules, { type: "achievement:nodes_pasted", payload: { count: 99 }, at: 1 })).toEqual({ nodes_pasted: 1 });
    for (const [counter, targets] of Object.entries({
      nodes_pasted: [1, 50, 200, 1000],
      field_added: [1, 50, 500, 2000, 10000, 50000],
      node_created: [10, 50, 200, 1000, 5000, 20000],
      node_deleted: [1, 50, 200, 1000, 5000, 20000],
    })) {
      const defs = canvasAchievements.filter((def) => def.series === counter);
      expect(defs).toHaveLength(targets.length);
      defs.forEach((def, index) => {
        const target = targets[index];
        expect(evaluateAchievement(def, { counters: { [counter]: target - 1 }, unlocked: {}, now: 1 }).achieved).toBe(false);
        expect(evaluateAchievement(def, { counters: { [counter]: target }, unlocked: {}, now: 1 }).achieved).toBe(true);
      });
    }
  });
});
