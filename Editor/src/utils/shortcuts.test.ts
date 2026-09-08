import { act, cleanup, renderHook } from "@testing-library/react";
import { useKeyPress } from "@xyflow/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getShortcut, matchesShortcut } from "./shortcuts";

function setPlatform(platform: string) {
  vi.spyOn(navigator, "platform", "get").mockReturnValue(platform);
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("平台快捷键", () => {
  it.each(["Win32", "Linux x86_64"])("%s 使用 Ctrl", (platform) => {
    setPlatform(platform);
    expect(getShortcut("copy")).toEqual({ binding: "Control+c", label: "Ctrl+C" });
    expect(matchesShortcut(new KeyboardEvent("keydown", { key: "c", ctrlKey: true }), "copy")).toBe(true);
    expect(matchesShortcut(new KeyboardEvent("keydown", { key: "c", metaKey: true }), "copy")).toBe(false);
    expect(getShortcut("redo").label).toBe("Ctrl+Y");
    expect(matchesShortcut(new KeyboardEvent("keydown", { key: "Z", ctrlKey: true, shiftKey: true }), "redo")).toBe(true);
  });

  it("macOS 使用 Cmd，并支持大写 Z 的重做事件", () => {
    setPlatform("MacIntel");
    expect(getShortcut("copy")).toEqual({ binding: "Meta+c", label: "Cmd+C" });
    expect(getShortcut("paste")).toEqual({ binding: "Meta+v", label: "Cmd+V" });
    expect(getShortcut("redo").label).toBe("Cmd+Shift+Z");
    expect(matchesShortcut(new KeyboardEvent("keydown", { key: "Z", metaKey: true, shiftKey: true }), "redo")).toBe(true);
    expect(matchesShortcut(new KeyboardEvent("keydown", { key: "Z", metaKey: true, shiftKey: true }), "undo")).toBe(false);
    expect(matchesShortcut(new KeyboardEvent("keydown", { key: "v", ctrlKey: true }), "paste")).toBe(false);
    expect(matchesShortcut(new KeyboardEvent("keydown", { key: "S", metaKey: true }), "save")).toBe(true);
    expect(matchesShortcut(new KeyboardEvent("keydown", { key: "s", metaKey: true, altKey: true }), "save")).toBe(false);
  });
});


describe("React Flow 复制粘贴绑定", () => {
  it.each(["MacIntel", "Win32", "Linux x86_64"])("%s 能触发并释放复制粘贴键", (platform) => {
    vi.spyOn(navigator, "platform", "get").mockReturnValue(platform);
    const isMac = platform === "MacIntel";
    const modifierKey = isMac ? "Meta" : "Control";
    const modifiers = isMac ? { metaKey: true } : { ctrlKey: true };
    for (const action of ["copy", "paste"] as const) {
      const key = action === "copy" ? "c" : "v";
      const { result, unmount } = renderHook(() => useKeyPress(getShortcut(action).binding, {
        target: document,
        actInsideInputWithModifier: false,
      }));
      act(() => {
        document.dispatchEvent(new KeyboardEvent("keydown", { key: modifierKey, ...modifiers }));
        document.dispatchEvent(new KeyboardEvent("keydown", { key, ...modifiers }));
      });
      expect(result.current).toBe(true);
      act(() => {
        document.dispatchEvent(new KeyboardEvent("keyup", { key: modifierKey }));
      });
      expect(result.current).toBe(false);
      unmount();
    }
  });
});
