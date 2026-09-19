import { beforeEach, describe, expect, it } from "vitest";
import { emptyPreferences, loadProjectPreferences, saveProjectPreferences, scopeKey, scopedValues } from "./projectPreferences";
import type { ProjectInterfaceSnapshot } from "./types";

const snapshot: ProjectInterfaceSnapshot = {
  projectId: "p", revision: "r", language: "zh_cn", entryPath: "/pi/interface.json", projectRoot: "/pi", interfaceRoot: "/pi",
  document: { global_option: ["choice"], controller: [{ name: "c" }], resource: [{ name: "r" }], task: [{ name: "a", entry: "A", option: ["choice", "login"] }, { name: "b", entry: "B", option: ["choice"] }], option: {
    choice: { cases: [{ name: "yes" }, { name: "no" }] },
    login: { type: "input", inputs: [{ name: "user" }, { name: "password", password: true }] },
  } },
};

describe("PI browser preferences", () => {
  beforeEach(() => localStorage.clear());
  it("isolates values by task, scope, project and LB endpoint", () => {
    const preferences = { ...emptyPreferences(), controllerName: "c", resourceName: "r", taskName: "a" };
    preferences.values[scopeKey("task", preferences, "a")] = { choice: "yes" };
    preferences.values[scopeKey("task", preferences, "b")] = { choice: "no" };
    preferences.values[scopeKey("global", preferences, "")] = { choice: "no" };
    saveProjectPreferences("ws://one", snapshot, preferences);
    const restored = loadProjectPreferences("ws://one", snapshot);
    expect(scopedValues(restored, "a").task.choice).toBe("yes");
    expect(scopedValues(restored, "b").task.choice).toBe("no");
    expect(scopedValues(restored, "a").global.choice).toBe("no");
    expect(loadProjectPreferences("ws://two", snapshot).values).toEqual({});
    expect(loadProjectPreferences("ws://one", { ...snapshot, projectId: "other" }).values).toEqual({});
  });
  it("never persists passwords and removes deleted references on reload", () => {
    const preferences = { ...emptyPreferences(), taskName: "a" };
    const key = scopeKey("task", preferences, "a");
    preferences.values[key] = { login: { user: "normal", password: "secret-token" }, choice: "yes", removed: "value" };
    saveProjectPreferences("ws://one", snapshot, preferences);
    expect(JSON.stringify(localStorage)).not.toContain("secret-token");
    expect(preferences.values[key]).toHaveProperty("login.password", "secret-token");
    expect(loadProjectPreferences("ws://one", snapshot).values[key]).toEqual({ login: { user: "normal" }, choice: "yes" });
    expect(loadProjectPreferences("ws://one", { ...snapshot, document: { ...snapshot.document, task: [] } }).values).toEqual({});
    expect(loadProjectPreferences("ws://one", { ...snapshot, document: { ...snapshot.document, task: [{ name: "a", entry: "A", option: ["choice"] }] } }).values[key]).toEqual({ choice: "yes" });
  });
});
