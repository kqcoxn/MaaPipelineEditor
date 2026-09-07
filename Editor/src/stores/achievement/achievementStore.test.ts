import { beforeEach, describe, expect, it } from "vitest";

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
      toast: null,
    });
  });

  describe("applyEnginePatch", () => {
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
        toast: { kind: "unlock", id: "b" },
      });

      useAchievementStore.getState().resetAll();

      const state = useAchievementStore.getState();
      expect(state.counters).toEqual({});
      expect(state.unlocked).toEqual({});
      expect(state.progress).toEqual({});
      expect(state.toast).toBeNull();
    });
  });

  describe("initializeAchievementPersistence", () => {
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
