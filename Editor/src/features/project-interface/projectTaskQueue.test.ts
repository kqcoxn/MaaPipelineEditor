import { describe, expect, it } from "vitest";
import { emptyPreferences, loadProjectPreferences, reconcilePreferences, saveProjectPreferences, scopedValues } from "./projectPreferences";
import { applyTaskPreset, moveTask } from "./projectTaskQueue";
import type { ProjectInterfaceSnapshot } from "./types";
const snapshot: ProjectInterfaceSnapshot = { projectId: "queue", revision: "r", language: "zh_cn", entryPath: "/p/interface.json", projectRoot: "/p", interfaceRoot: "/p", document: {
  task: [{ name: "a", entry: "A", default_check: true }, { name: "b", entry: "B", option: ["mode"] }],
  option: { mode: { cases: [{ name: "fast" }, { name: "slow" }] } },
} };
describe("GUI task queue preferences", () => {
  it("uses default_check only on first initialization, then restores explicit deselection and order", () => {
    localStorage.clear();
    const initial = loadProjectPreferences("lb", snapshot);
    expect(initial.checkedTaskNames).toEqual(["a"]);
    saveProjectPreferences("lb", snapshot, { ...initial, checkedTaskNames: [], taskOrder: ["b", "a"] });
    const restored = loadProjectPreferences("lb", snapshot);
    expect(restored.checkedTaskNames).toEqual([]); expect(restored.taskOrder).toEqual(["b", "a"]);
    expect(loadProjectPreferences("other", snapshot).checkedTaskNames).toEqual(["a"]);
  });
  it("reconciles deleted/added tasks and applies preset values separately from selection", () => {
    const preferences = reconcilePreferences({ ...emptyPreferences(), taskOrder: ["removed", "b"], checkedTaskNames: ["removed", "b"] }, snapshot);
    expect(preferences.taskOrder).toEqual(["b", "a"]); expect(preferences.checkedTaskNames).toEqual(["b"]);
    const applied = applyTaskPreset(preferences, snapshot, { task: [{ name: "b", option: { mode: "fast" } }, { name: "a", enabled: false }] });
    expect(applied.checkedTaskNames).toEqual(["b"]); expect(scopedValues(applied, "b").task).toEqual({ mode: "fast" });
    expect(moveTask(applied.taskOrder!, "b", 1)).toEqual(["a", "b"]);
  });
});
