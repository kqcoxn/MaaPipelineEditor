import type { AdbDevice, Win32Window, LinuxCompositor } from "@/stores/connection/mfwStore";
import type { ControllerConnectionRequest } from "@/services/protocols/controllerConnection";
import { defaultLinuxOptions, type LinuxControllerOptions } from "@/services/protocols/linuxController";
import { MACOS_DEFAULT_METHODS } from "./utils";

export type ControllerTab = ControllerConnectionRequest["type"];
export const ADB_DEFAULT_SCREENCAP_METHODS = ["EncodeToFileAndPull", "Encode", "RawWithGzip", "MinicapDirect", "MinicapStream", "EmulatorExtras"];
export const ADB_DEFAULT_INPUT_METHODS = ["AdbShell", "MinitouchAndAdbKey", "Maatouch", "EmulatorExtras"];

export interface ConnectionForm {
  activeTab: ControllerTab;
  selectedAdbDevice: AdbDevice | null;
  selectedWin32Window: Win32Window | null;
  selectedLinuxSocket: LinuxCompositor | null;
  linuxSocketPath: string;
  manualAdbPath: string;
  manualAddress: string;
  manualConfig: string;
  manualName: string;
  playCoverAddress: string;
  playCoverUUID: string;
  playCoverName: string;
  gamepadType: "Xbox360" | "DualShock4";
  gamepadHwnd: string;
  gamepadScreencap: string;
  macosScreencap: string;
  macosInput: string;
  linuxOptions: LinuxControllerOptions;
  linuxUseWin32VkCode: boolean;
  customScreencap: string | string[] | undefined;
  customInput: string | string[] | undefined;
  customKeyboard: string;
}

export function defaultConnectionForm(activeTab: ControllerTab): ConnectionForm {
  return {
    activeTab, selectedAdbDevice: null, selectedWin32Window: null, selectedLinuxSocket: null,
    linuxSocketPath: "", manualAdbPath: "", manualAddress: "", manualConfig: "{}", manualName: "",
    playCoverAddress: "", playCoverUUID: "", playCoverName: "", gamepadType: "Xbox360",
    gamepadHwnd: "", gamepadScreencap: "", macosScreencap: MACOS_DEFAULT_METHODS.screencap[0],
    macosInput: MACOS_DEFAULT_METHODS.input[0], linuxOptions: defaultLinuxOptions,
    linuxUseWin32VkCode: true, customScreencap: undefined, customInput: undefined, customKeyboard: "SendMessage",
  };
}

/** 以真正成功连接的参数回填，设备扫描结果只提供名称和可选方法。 */
export function restoreConnectionForm(form: ConnectionForm, request: ControllerConnectionRequest): ConnectionForm {
  const next = { ...form, activeTab: request.type };
  switch (request.type) {
    case "adb": {
      const p = request.params;
      const info = request.deviceInfo as Partial<AdbDevice> | undefined;
      const manual = form.manualAddress.trim() === p.address && form.manualAdbPath.trim() === p.adb_path;
      return { ...next, manualAdbPath: manual ? p.adb_path : "", manualAddress: manual ? p.address : "", manualConfig: p.config || "", manualName: p.name || "",
        selectedAdbDevice: { ...p, name: info?.name || p.name || p.address, config: p.config || "",
          available_screencap_methods: info?.available_screencap_methods || info?.screencap_methods || p.screencap_methods,
          available_input_methods: info?.available_input_methods || info?.input_methods || p.input_methods },
        customScreencap: p.screencap_methods, customInput: p.input_methods };
    }
    case "win32": {
      const p = request.params;
      const info = request.deviceInfo as Partial<Win32Window> | undefined;
      return { ...next, selectedWin32Window: { hwnd: p.hwnd, class_name: info?.class_name || "",
        window_name: info?.window_name || p.hwnd, screencap_methods: info?.screencap_methods || [p.screencap_method],
        input_methods: Array.from(new Set([...(info?.input_methods || []), p.input_method, p.keyboard_method || "SendMessage"])) },
        customScreencap: p.screencap_method, customInput: p.input_method, customKeyboard: p.keyboard_method || "SendMessage" };
    }
    case "macos": {
      const p = request.params;
      const info = request.deviceInfo as Partial<Win32Window> | undefined;
      return { ...next, selectedWin32Window: { hwnd: p.window_id, class_name: info?.class_name || "",
        window_name: info?.window_name || p.window_id, screencap_methods: [p.screencap_method], input_methods: [p.input_method] },
        macosScreencap: p.screencap_method, macosInput: p.input_method };
    }
    case "playcover": return { ...next, playCoverAddress: request.params.address, playCoverUUID: request.params.uuid, playCoverName: request.params.name || "PlayCover Device" };
    case "gamepad": return { ...next, gamepadType: request.params.gamepad_type, gamepadHwnd: request.params.hwnd || "", gamepadScreencap: request.params.screencap_method || "" };
    case "linux": return { ...next, linuxOptions: request.params, linuxSocketPath: request.params.socket_path, selectedLinuxSocket: null, linuxUseWin32VkCode: request.params.use_win32_vk_code };
  }
}

const methods = (value: string | string[] | undefined, fallback: string[]) => value === undefined ? fallback : Array.isArray(value) ? value : [value];

/** 与提交共用构造逻辑，避免“是否修改”和实际发送的参数不一致。 */
export function buildConnectionRequest(f: ConnectionForm): ControllerConnectionRequest | null {
  switch (f.activeTab) {
    case "adb": {
      const manual = !!(f.manualAdbPath.trim() || f.manualAddress.trim());
      const device = f.selectedAdbDevice;
      if (manual ? !f.manualAdbPath.trim() || !f.manualAddress.trim() : !device) return null;
      const screencap_methods = methods(f.customScreencap, manual ? ADB_DEFAULT_SCREENCAP_METHODS : device!.screencap_methods);
      const input_methods = methods(f.customInput, manual ? ADB_DEFAULT_INPUT_METHODS : device!.input_methods);
      if (!screencap_methods.length || !input_methods.length) return null;
      return { type: "adb", params: {
        adb_path: manual ? f.manualAdbPath.trim() : device!.adb_path,
        address: manual ? f.manualAddress.trim() : device!.address,
        screencap_methods, input_methods,
        config: (manual ? f.manualConfig.trim() : device!.config) || undefined,
        ...(f.manualName.trim() ? { name: f.manualName.trim() } : {}),
      } };
    }
    case "win32": {
      if (!f.selectedWin32Window) return null;
      const screencap_method = methods(f.customScreencap, f.selectedWin32Window.screencap_methods)[0];
      const input_method = methods(f.customInput, f.selectedWin32Window.input_methods)[0];
      if (!screencap_method || !input_method) return null;
      return { type: "win32", params: { hwnd: f.selectedWin32Window.hwnd, screencap_method, input_method, keyboard_method: f.customKeyboard } };
    }
    case "playcover": return f.playCoverAddress.trim() && f.playCoverUUID.trim() ? { type: "playcover", params: { address: f.playCoverAddress.trim(), uuid: f.playCoverUUID.trim(), name: f.playCoverName.trim() || "PlayCover Device" } } : null;
    case "gamepad": return { type: "gamepad", params: { hwnd: f.gamepadHwnd.trim() || undefined, gamepad_type: f.gamepadType, screencap_method: f.gamepadScreencap || undefined } };
    case "macos": return f.selectedWin32Window && f.macosScreencap && f.macosInput ? { type: "macos", params: { window_id: f.selectedWin32Window.hwnd, screencap_method: f.macosScreencap, input_method: f.macosInput } } : null;
    case "linux": {
      const p = { ...f.linuxOptions, socket_path: f.linuxSocketPath.trim() || f.selectedLinuxSocket?.socket_path || "", use_win32_vk_code: f.linuxUseWin32VkCode };
      if ((p.screencap_method === "Wlr" || p.input_method === "Wlr") && !p.socket_path) return null;
      if (p.screencap_method === "PipeWire" && !p.pw_node_id) return null;
      if (p.input_method === "Libei" && !p.eis_socket_path?.trim()) return null;
      return { type: "linux", params: p };
    }
  }
}
