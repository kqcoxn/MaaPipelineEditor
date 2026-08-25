import { describe, expect, it } from "vitest";
import {
  compatibleResources,
  effectiveConfigurationSource,
  formatHotkey,
  reconcileNamedSelection,
  toggleStringSelection,
} from "./projectInterfaceState";

describe("Project Interface debug state", () => {
  const resources = [
    { name: "shared" },
    { name: "android", controller: ["Adb"] },
    { name: "desktop", controller: ["Win32"] },
  ];

  it("filters resources and falls back to the first compatible item", () => {
    const compatible = compatibleResources(resources, "Win32");
    expect(compatible.map((item) => item.name)).toEqual(["shared", "desktop"]);
    expect(reconcileNamedSelection(compatible, "android")).toBe("shared");
    expect(reconcileNamedSelection(compatible, "desktop")).toBe("desktop");
  });

  it("toggles checkbox selections without mutating the current value", () => {
    const current = ["a"];
    expect(toggleStringSelection(current, "b", true)).toEqual(["a", "b"]);
    expect(toggleStringSelection(current, "a", false)).toEqual([]);
    expect(current).toEqual(["a"]);
  });

  it("falls back to loose manual mode while PI is unavailable", () => {
    expect(effectiveConfigurationSource("project_interface", "not_found")).toBe("manual");
    expect(effectiveConfigurationSource("project_interface", "multiple")).toBe("manual");
    expect(effectiveConfigurationSource("project_interface", "ready")).toBe("project_interface");
    expect(effectiveConfigurationSource("manual", "ready")).toBe("manual");
  });

  it("serializes captured hotkeys as human-readable strings", () => {
    expect(formatHotkey({ key: "a", ctrlKey: true, shiftKey: true, altKey: false, metaKey: false })).toBe("Ctrl+Shift+A");
    expect(formatHotkey({ key: "ArrowUp", ctrlKey: false, shiftKey: false, altKey: false, metaKey: false })).toBe("Up");
    expect(formatHotkey({ key: "Control", ctrlKey: true, shiftKey: false, altKey: false, metaKey: false })).toBeUndefined();
  });
});
