import { describe, expect, it } from "vitest";
import { emptyPreferences, loadProjectPreferences, reconcilePreferences, saveProjectPreferences, scopeKey, scopedValues } from "./projectPreferences";
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
  it("keeps pretask values separate, ignores unknown entries and preserves declaration order", () => {
    const project = { ...snapshot, document: { ...snapshot.document, pretask: [
      { name: "first", exec: "prepare", option: ["mode"] },
      { name: "second", exec: "prepare", option: ["mode"] },
      { name: "third", exec: "prepare" },
    ] } };
    const applied = applyTaskPreset(emptyPreferences(), project, { pretask: [
      { name: "second", option: { mode: "slow" } },
      { name: "unknown" },
      { name: "first", option: { mode: "fast" } },
    ] });
    expect(applied.pretaskEnabled).toEqual({ first: true, second: true, third: false });
    expect(scopedValues(applied, "a").pretask).toEqual({ first: { mode: "fast" }, second: { mode: "slow" } });
    expect(applyTaskPreset(applied, project, { task: [] }).pretaskEnabled).toEqual(applied.pretaskEnabled);
    expect(scopedValues(applyTaskPreset(applied, project, { task: [] }), "b").pretask).toEqual(scopedValues(applied, "a").pretask);
    expect(applyTaskPreset(applied, project, { pretask: [] }).pretaskEnabled).toEqual({ first: false, second: false, third: false });
  });
  it("rejects a preset for another controller and strips pretask passwords from presets and storage", () => {
    localStorage.clear();
    const project = { ...snapshot, document: { ...snapshot.document, pretask: { name: "login", exec: "prepare", option: ["credentials"] }, option: {
      credentials: { type: "input", inputs: [{ name: "user" }, { name: "secret", password: true }] },
    } } };
    const preferences = { ...emptyPreferences(), controllerName: "adb" };
    expect(applyTaskPreset(preferences, project, { controller: ["win32"], pretask: [] })).toBe(preferences);
    const applied = applyTaskPreset(preferences, project, { pretask: [{ name: "login", option: { credentials: { user: "test", secret: "unsafe" } } }] });
    expect(scopedValues(applied, "").pretask).toEqual({ login: { credentials: { user: "test" } } });
    const key = scopeKey("pretask", applied, "login");
    applied.values[key] = { credentials: { user: "test", secret: "private" } };
    applied.pretaskEnabled = { login: false };
    saveProjectPreferences("lb", project, applied);
    const restored = loadProjectPreferences("lb", project);
    expect(restored.pretaskEnabled).toEqual({ login: false });
    expect(scopedValues(restored, "").pretask).toEqual({ login: { credentials: { user: "test" } } });
    expect(reconcilePreferences(restored, { ...project, document: { ...project.document, pretask: [] } }).values).toEqual({});
  });
});
