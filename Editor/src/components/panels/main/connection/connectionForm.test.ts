import { describe, expect, it } from "vitest";
import type { ControllerConnectionRequest } from "@/services/protocols/controllerConnection";
import { sameControllerConnection } from "@/services/protocols/controllerConnection";
import { buildConnectionRequest, defaultConnectionForm, restoreConnectionForm } from "./connectionForm";

export const connections: ControllerConnectionRequest[] = [
  { type: "adb", params: { adb_path: "adb.exe", address: "127.0.0.1:5555", config: "{}", name: "My phone", screencap_methods: ["Encode"], input_methods: ["Maatouch"] } },
  { type: "win32", params: { hwnd: "42", screencap_method: "FramePool", input_method: "SendMessageWithCursorPos", keyboard_method: "Seize" } },
  { type: "playcover", params: { address: "127.0.0.1:1717", uuid: "game.app", name: "Game" } },
  { type: "gamepad", params: { hwnd: "42", gamepad_type: "DualShock4", screencap_method: "FramePool" } },
  { type: "macos", params: { window_id: "42", screencap_method: "ScreenCaptureKit", input_method: "PostToPid" } },
  { type: "linux", params: { socket_path: "", screencap_method: "PipeWire", input_method: "UInput", pw_node_id: 123, use_win32_vk_code: true, uinput_path: "/dev/uinput", uinput_screen_width: 1920, uinput_screen_height: 1080 } },
];

describe("controller connection form", () => {
  it.each(connections)("restores all submitted $type parameters without changing them", request => {
    const restored = restoreConnectionForm(defaultConnectionForm("adb"), request);
    expect(buildConnectionRequest(restored)).toEqual(request);
    expect(sameControllerConnection(buildConnectionRequest(restored), request)).toBe(true);
  });

  it("distinguishes a pending keyboard change from the applied controller", () => {
    const applied = connections[1];
    const form = restoreConnectionForm(defaultConnectionForm("win32"), applied);
    expect(form.customKeyboard).toBe("Seize");
    const edited = buildConnectionRequest({ ...form, customKeyboard: "SendMessage" });
    expect(sameControllerConnection(edited, applied)).toBe(false);
    expect(applied.params).toHaveProperty("keyboard_method", "Seize");
  });

  it("keeps manual ADB fields editable after reconnecting", () => {
    const form = { ...defaultConnectionForm("adb"), manualAdbPath: "adb.exe", manualAddress: "127.0.0.1:5555" };
    const restored = restoreConnectionForm(form, connections[0]);
    expect(restored.manualAdbPath).toBe("adb.exe");
    expect(buildConnectionRequest({ ...restored, manualConfig: '{"touch":true}' })?.params).toHaveProperty("config", '{"touch":true}');
  });

  it("does not depend on property order or discovery metadata", () => {
    const request: ControllerConnectionRequest = { type: "win32", params: { hwnd: "42", screencap_method: "FramePool", input_method: "Seize" } };
    expect(sameControllerConnection(request, { type: "win32", deviceInfo: { window_name: "new title" }, params: { input_method: "Seize", hwnd: "42", screencap_method: "FramePool" } })).toBe(true);
  });

  it("prevents submitting incomplete method selections before disconnecting", () => {
    const adb = restoreConnectionForm(defaultConnectionForm("adb"), connections[0]);
    expect(buildConnectionRequest({ ...adb, customInput: [] })).toBeNull();
    const linux = restoreConnectionForm(defaultConnectionForm("linux"), connections[5]);
    expect(buildConnectionRequest({ ...linux, linuxOptions: { ...linux.linuxOptions, pw_node_id: undefined } })).toBeNull();
  });
});
