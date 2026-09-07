import { describe, expect, it } from "vitest";

import {
  applyCounterRules,
  buildEngineIndex,
  evaluateAchievement,
  evaluateAllAchievements,
  handleAchievementEvent,
} from "./engine";
import type {
  AchievementDef,
  AchievementEvent,
  CounterRule,
  EvalContext,
} from "./types";

const counterDef: AchievementDef = {
  id: "nodes_10",
  title: "t",
  description: "d",
  category: "canvas",
  trigger: { kind: "counter", counter: "node_created", target: 10 },
};

const eventDef: AchievementDef = {
  id: "first_node",
  title: "t",
  description: "d",
  category: "canvas",
  trigger: { kind: "event", on: "canvas:node:add" },
};

const conditionedEventDef: AchievementDef = {
  id: "bulk_paste",
  title: "t",
  description: "d",
  category: "canvas",
  trigger: {
    kind: "event",
    on: "canvas:graph:paste",
    condition: (event) => ((event.payload as { count?: number })?.count ?? 0) >= 5,
  },
};

const customDef: AchievementDef = {
  id: "night_owl",
  title: "t",
  description: "d",
  category: "explore",
  trigger: {
    kind: "custom",
    watch: ["canvas:node:add"],
    evaluate: (ctx: EvalContext) => {
      if (!ctx.event) return false;
      return new Date(ctx.event.at).getHours() >= 23;
    },
  },
};

const customProgressDef: AchievementDef = {
  id: "hybrid",
  title: "t",
  description: "d",
  category: "explore",
  trigger: {
    kind: "custom",
    watch: ["node_created"],
    evaluate: (ctx) => (ctx.counters.node_created ?? 0) / 4,
  },
};

const allDefs = [counterDef, eventDef, conditionedEventDef, customDef];

function makeEvent(type: string, at = Date.now()): AchievementEvent {
  return { type, at };
}

describe("buildEngineIndex", () => {
  it("registers defs by counter, event and custom watch keys", () => {
    const index = buildEngineIndex([...allDefs, customProgressDef]);

    expect(index.byCounter.get("node_created")).toEqual(
      expect.arrayContaining([counterDef, customProgressDef]),
    );
    expect(index.byEvent.get("canvas:node:add")).toEqual(
      expect.arrayContaining([eventDef, customDef]),
    );
    expect(index.byEvent.get("canvas:graph:paste")).toEqual([
      conditionedEventDef,
    ]);
  });
});

describe("evaluateAchievement", () => {
  const baseCtx: EvalContext = { counters: {}, unlocked: {}, now: 0 };

  it("computes counter progress and achievement", () => {
    expect(
      evaluateAchievement(counterDef, {
        ...baseCtx,
        counters: { node_created: 3 },
      }),
    ).toEqual({ achieved: false, progress: 0.3 });
    expect(
      evaluateAchievement(counterDef, {
        ...baseCtx,
        counters: { node_created: 10 },
      }),
    ).toEqual({ achieved: true, progress: 1 });
    expect(
      evaluateAchievement(counterDef, {
        ...baseCtx,
        counters: { node_created: 99 },
      }).progress,
    ).toBe(1);
  });

  it("evaluates event triggers only with matching event", () => {
    expect(evaluateAchievement(eventDef, baseCtx).achieved).toBe(false);
    expect(
      evaluateAchievement(eventDef, {
        ...baseCtx,
        event: makeEvent("canvas:node:add"),
      }).achieved,
    ).toBe(true);
  });

  it("applies event condition", () => {
    const event: AchievementEvent = {
      type: "canvas:graph:paste",
      payload: { count: 3 },
      at: 0,
    };
    expect(
      evaluateAchievement(conditionedEventDef, { ...baseCtx, event }).achieved,
    ).toBe(false);
    expect(
      evaluateAchievement(conditionedEventDef, {
        ...baseCtx,
        event: { ...event, payload: { count: 8 } },
      }).achieved,
    ).toBe(true);
  });

  it("supports custom evaluate returning boolean or progress number", () => {
    const nightEvent = makeEvent(
      "canvas:node:add",
      new Date("2026-01-01T23:30:00").getTime(),
    );
    expect(
      evaluateAchievement(customDef, { ...baseCtx, event: nightEvent })
        .achieved,
    ).toBe(true);
    expect(
      evaluateAchievement(customDef, {
        ...baseCtx,
        event: makeEvent(
          "canvas:node:add",
          new Date("2026-01-01T12:00:00").getTime(),
        ),
      }).achieved,
    ).toBe(false);

    expect(
      evaluateAchievement(customProgressDef, {
        ...baseCtx,
        counters: { node_created: 2 },
      }),
    ).toEqual({ achieved: false, progress: 0.5 });
  });
});

describe("applyCounterRules", () => {
  const rules: CounterRule[] = [
    { counter: "node_created", on: "canvas:node:add" },
    {
      counter: "paste_total",
      on: "canvas:graph:paste",
      delta: (event) => (event.payload as { count?: number })?.count ?? 1,
    },
  ];

  it("accumulates +1 by default and custom deltas otherwise", () => {
    expect(applyCounterRules(rules, makeEvent("canvas:node:add"))).toEqual({
      node_created: 1,
    });
    expect(
      applyCounterRules(rules, {
        type: "canvas:graph:paste",
        payload: { count: 4 },
        at: 0,
      }),
    ).toEqual({ paste_total: 4 });
    expect(applyCounterRules(rules, makeEvent("canvas:edge:add"))).toEqual({});
  });
});

describe("handleAchievementEvent", () => {
  it("applies counter delta and evaluates only related defs", () => {
    const index = buildEngineIndex(allDefs);
    const patch = handleAchievementEvent(
      index,
      [{ counter: "node_created", on: "canvas:node:add" }],
      makeEvent("canvas:node:add"),
      { node_created: 9 },
      {},
    );

    expect(patch.counterDelta).toEqual({ node_created: 1 });
    expect(patch.unlock).toEqual(
      expect.arrayContaining(["nodes_10", "first_node"]),
    );
    // 未命中的事件型成就不产生进度
    expect(patch.progress?.bulk_paste).toBeUndefined();
  });

  it("skips defs that are already unlocked", () => {
    const index = buildEngineIndex(allDefs);
    const patch = handleAchievementEvent(
      index,
      [],
      makeEvent("canvas:node:add"),
      {},
      { first_node: { at: 1 } },
    );

    expect(patch.unlock ?? []).not.toContain("first_node");
  });

  it("writes back progress for partially advanced counter defs", () => {
    const index = buildEngineIndex(allDefs);
    const patch = handleAchievementEvent(
      index,
      [{ counter: "node_created", on: "canvas:node:add" }],
      makeEvent("canvas:node:add"),
      { node_created: 4 },
      { first_node: { at: 1 }, night_owl: { at: 2 } },
    );

    expect(patch.progress?.nodes_10).toBeCloseTo(0.5);
    expect(patch.unlock ?? []).toEqual([]);
  });

  it("evaluates custom defs via event watch", () => {
    const index = buildEngineIndex(allDefs);
    const patch = handleAchievementEvent(
      index,
      [],
      makeEvent("canvas:node:add", new Date("2026-03-01T23:10:00").getTime()),
      {},
      {},
    );

    expect(patch.unlock).toEqual(
      expect.arrayContaining(["first_node", "night_owl"]),
    );
  });
});

describe("evaluateAllAchievements", () => {
  it("backfills unlocks from existing counters and reports progress", () => {
    const patch = evaluateAllAchievements(
      allDefs,
      { node_created: 25 },
      {},
    );

    expect(patch.unlock).toEqual(["nodes_10"]);
    // 事件型与依赖事件的 custom 成就无法从计数器回溯
    expect(patch.unlock).not.toContain("first_node");
    expect(patch.unlock).not.toContain("night_owl");
  });

  it("does not re-unlock already unlocked defs", () => {
    const patch = evaluateAllAchievements(
      allDefs,
      { node_created: 25 },
      { nodes_10: { at: 1 } },
    );

    expect(patch.unlock ?? []).toEqual([]);
  });
});
