import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useGlobalShortcuts } from "./useGlobalShortcuts";

const actions = vi.hoisted(() => ({ undo: vi.fn(() => true), redo: vi.fn(() => true) }));
vi.mock("../stores/flow", () => ({ useFlowStore: { getState: () => actions } }));
vi.mock("@/utils/ui/antdAppApi", () => ({ message: { success: vi.fn(), warning: vi.fn() } }));

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("全局撤销和重做", () => {
  it.each(["MacIntel", "Win32"])("%s 使用系统组合键并保留输入框行为", (platform) => {
    vi.spyOn(navigator, "platform", "get").mockReturnValue(platform);
    const modifier = platform === "MacIntel" ? { metaKey: true } : { ctrlKey: true };
    const { unmount } = renderHook(() => useGlobalShortcuts());
    const press = (target: HTMLElement, shiftKey = false) => act(() => {
      target.dispatchEvent(new KeyboardEvent("keydown", { key: shiftKey ? "Z" : "z", ...modifier, shiftKey, bubbles: true }));
    });
    press(document.body);
    press(document.body, true);
    expect(actions.undo).toHaveBeenCalledTimes(1);
    expect(actions.redo).toHaveBeenCalledTimes(1);
    const input = document.createElement("input");
    document.body.append(input);
    press(input);
    press(input, true);
    expect(actions.undo).toHaveBeenCalledTimes(1);
    expect(actions.redo).toHaveBeenCalledTimes(1);
    unmount();
    press(document.body);
    expect(actions.undo).toHaveBeenCalledTimes(1);
  });
});
