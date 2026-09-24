import { describe, expect, it } from "vitest";
import { applyCounterRules } from "./engine";
import { counterRules } from "./defs/counters";
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

  it("每次粘贴只累计一次，不按粘贴节点数量计数", () => {
    expect(applyCounterRules(counterRules, { type: "achievement:nodes_pasted", payload: { count: 99 }, at: 1 })).toEqual({ nodes_pasted: 1 });
  });
});
