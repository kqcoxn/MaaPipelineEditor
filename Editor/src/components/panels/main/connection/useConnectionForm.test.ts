import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useConnectionForm } from "./useConnectionForm";
import type { ControllerConnectionRequest } from "@/services/protocols/controllerConnection";

const applied: ControllerConnectionRequest = { type: "win32", params: { hwnd: "42", screencap_method: "FramePool", input_method: "Seize", keyboard_method: "Seize" } };
describe("connection form drafts", () => {
  beforeEach(() => localStorage.clear());
  it("gives the actual connection precedence over stored drafts", () => {
    localStorage.setItem("mpe_connection_form", JSON.stringify({ drafts: { win32: { customKeyboard: "SendMessage" } } }));
    const { result } = renderHook(() => useConnectionForm(["adb", "win32"], applied));
    expect(result.current.customKeyboard).toBe("Seize");
    expect(result.current.selectedWin32Window?.hwnd).toBe("42");
  });
  it("keeps edits while switching tabs and rerendering", () => {
    const { result, rerender } = renderHook(() => useConnectionForm(["adb", "win32"], applied));
    act(() => result.current.setCustomKeyboard("PostMessage"));
    act(() => result.current.setActiveTab("adb"));
    act(() => result.current.setCustomInput(["Maatouch"]));
    act(() => result.current.setActiveTab("win32"));
    rerender();
    expect(result.current.customKeyboard).toBe("PostMessage");
    expect(result.current.customInput).toBe("Seize");
    act(() => result.current.setActiveTab("adb"));
    expect(result.current.customInput).toEqual(["Maatouch"]);
  });
  it("persists drafts for inactive tabs when the panel is reopened", () => {
    const first = renderHook(() => useConnectionForm(["adb", "gamepad"], null));
    act(() => first.result.current.setManualAddress("127.0.0.1:5555"));
    act(() => first.result.current.setActiveTab("gamepad"));
    act(() => first.result.current.setGamepadType("DualShock4"));
    act(() => first.result.current.setActiveTab("adb"));
    first.unmount();
    const second = renderHook(() => useConnectionForm(["adb", "gamepad"], null));
    expect(second.result.current.manualAddress).toBe("127.0.0.1:5555");
    act(() => second.result.current.setActiveTab("gamepad"));
    expect(second.result.current.gamepadType).toBe("DualShock4");
  });
});
