import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  initializeAchievementPersistence,
  useAchievementStore,
} from "./achievementStore";

describe("achievementStore", () => {
  beforeEach(() => {
    localStorage.clear();
    useAchievementStore.setState({
      counters: {},
      unlocked: {},
      progress: {},
      wallOpen: false,
      toasts: [],
    });
  });

  describe("applyEnginePatch", () => {
    it("无效增量、相同进度和重复解锁不触发订阅更新", () => {
      useAchievementStore.getState().applyEnginePatch({ unlock: ["a"], progress: { b: 0.5 } });
      const listener = vi.fn();
      const dispose = useAchievementStore.subscribe(listener);
      useAchievementStore.getState().applyEnginePatch({ counterDelta: { x: 0, y: NaN }, progress: { b: 0.5 }, unlock: ["a"] });
      dispose();
      expect(listener).not.toHaveBeenCalled();
    });
    it("accumulates counter deltas", () => {
      useAchievementStore
        .getState()
        .applyEnginePatch({ counterDelta: { node_created: 3 } });
      useAchievementStore
        .getState()
        .applyEnginePatch({ counterDelta: { node_created: 2 } });

      expect(useAchievementStore.getState().counters.node_created).toBe(5);
    });

    it("ignores zero and non-finite deltas", () => {
      useAchievementStore.getState().applyEnginePatch({
        counterDelta: { a: 0, b: Number.NaN, c: 1 },
      });

      const { counters } = useAchievementStore.getState();
      expect(counters.a).toBeUndefined();
      expect(counters.b).toBeUndefined();
      expect(counters.c).toBe(1);
    });

    it("records unlock time and clears its progress", () => {
      useAchievementStore.getState().applyEnginePatch({
        progress: { first_node: 0.5 },
      });
      useAchievementStore.getState().applyEnginePatch({
        unlock: ["first_node"],
        progress: { first_node: 1 },
      });

      const state = useAchievementStore.getState();
      expect(typeof state.unlocked.first_node.at).toBe("number");
      expect(state.progress.first_node).toBeUndefined();
    });

    it("ignores re-unlocking an already unlocked achievement", () => {
      useAchievementStore.getState().applyEnginePatch({ unlock: ["a"] });
      const firstAt = useAchievementStore.getState().unlocked.a.at;

      useAchievementStore.getState().applyEnginePatch({ unlock: ["a"] });

      expect(useAchievementStore.getState().unlocked.a.at).toBe(firstAt);
    });
  });

  describe("exportData / importData", () => {
    it("round-trips persisted data", () => {
      useAchievementStore.setState({
        counters: { node_created: 12 },
        unlocked: { first_node: { at: 1000 } },
      });

      const exported = useAchievementStore.getState().exportData();
      useAchievementStore.setState({ counters: {}, unlocked: {} });

      expect(useAchievementStore.getState().importData(exported)).toBe(true);
      expect(useAchievementStore.getState().counters.node_created).toBe(12);
      expect(useAchievementStore.getState().unlocked.first_node.at).toBe(1000);
    });

    it("merges counters by max value and unlocked by earliest time", () => {
      useAchievementStore.setState({
        counters: { node_created: 50, edge_created: 10 },
        unlocked: { a: { at: 2000 } },
      });

      const changed = useAchievementStore.getState().importData({
        schemaVersion: 1,
        counters: { node_created: 30, edge_created: 99 },
        unlocked: { a: { at: 5000 }, b: { at: 800 } },
      });

      expect(changed).toBe(true);
      const state = useAchievementStore.getState();
      expect(state.counters.node_created).toBe(50);
      expect(state.counters.edge_created).toBe(99);
      expect(state.unlocked.a.at).toBe(2000);
      expect(state.unlocked.b.at).toBe(800);
    });

    it("rejects invalid payloads", () => {
      expect(useAchievementStore.getState().importData(null)).toBe(false);
      expect(useAchievementStore.getState().importData("x")).toBe(false);
      expect(
        useAchievementStore.getState().importData({ counters: "bad" }),
      ).toBe(false);
    });
  });

  describe("resetAll", () => {
    it("clears counters, unlocked, progress and toast", () => {
      useAchievementStore.setState({
        counters: { a: 1 },
        unlocked: { b: { at: 1 } },
        progress: { c: 0.5 },
        toasts: [{ kind: "unlock", id: "b", key: 0 }],
      });

      useAchievementStore.getState().resetAll();

      const state = useAchievementStore.getState();
      expect(state.counters).toEqual({});
      expect(state.unlocked).toEqual({});
      expect(state.progress).toEqual({});
      expect(state.toasts).toEqual([]);
    });
  });

  describe("initializeAchievementPersistence", () => {
    it("高频计数合并写入，持续操作不延后保存，离开与卸载补写", () => {
      vi.useFakeTimers();
      const spy = vi.spyOn(Storage.prototype, "setItem");
      const dispose = initializeAchievementPersistence();
      try {
        for (let i = 0; i < 1000; i++) useAchievementStore.getState().applyEnginePatch({ counterDelta: { node_created: 1 } });
        expect(spy).not.toHaveBeenCalled();
        vi.advanceTimersByTime(499);
        useAchievementStore.getState().applyEnginePatch({ counterDelta: { node_created: 1 } });
        vi.advanceTimersByTime(1);
        expect(spy).toHaveBeenCalledTimes(1);
        expect(JSON.parse(localStorage.getItem("mpe_achievements")!).counters.node_created).toBe(1001);
        useAchievementStore.getState().applyEnginePatch({ counterDelta: { node_created: 1 } });
        window.dispatchEvent(new Event("pagehide"));
        expect(spy).toHaveBeenCalledTimes(2);
        useAchievementStore.getState().applyEnginePatch({ counterDelta: { node_created: 1 } });
        dispose();
        expect(spy).toHaveBeenCalledTimes(3);
        expect(vi.getTimerCount()).toBe(0);
      } finally { dispose(); spy.mockRestore(); vi.useRealTimers(); }
    });
    it("persists counters and unlocked changes to localStorage", () => {
      const dispose = initializeAchievementPersistence();

      useAchievementStore.getState().applyEnginePatch({
        counterDelta: { node_created: 7 },
        unlock: ["first_node"],
      });
      dispose();

      const raw = localStorage.getItem("mpe_achievements");
      expect(raw).toBeTruthy();
      const parsed = JSON.parse(raw!);
      expect(parsed.counters.node_created).toBe(7);
      expect(parsed.unlocked.first_node.at).toBeTypeOf("number");
    });

    it("does not persist progress-only changes", () => {
      const dispose = initializeAchievementPersistence();

      useAchievementStore.getState().applyEnginePatch({
        progress: { a: 0.5 },
      });
      dispose();

      expect(localStorage.getItem("mpe_achievements")).toBeNull();
    });
  });
});
