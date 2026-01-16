import { create } from "zustand";

/**
 * 设备类型
 */
export type DeviceType = "adb" | "win32" | "playcover" | "gamepad" | null;

/**
 * 连接状态
 */
export type ConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "failed";

/**
 * ADB 设备信息
 */
export interface AdbDevice {
  adb_path: string;
  address: string;
  name: string;
  screencap_methods: string[];
  input_methods: string[];
  config: string;
}

/**
 * Win32 窗口信息
 */
export interface Win32Window {
  hwnd: string;
  class_name: string;
  window_name: string;
  screencap_methods: string[];
  input_methods: string[];
}

/**
 * PlayCover 设备信息 (macOS 上运行 iOS 应用)
 */
export interface PlayCoverDevice {
  address: string;
  uuid: string;
  name: string;
}

/**
 * Gamepad 设备信息
 */
export interface GamepadDevice {
  hwnd: string; // 窗口句柄(可选,用于截图)
  gamepad_type: "Xbox360" | "DualShock4"; // 手柄类型
  screencap_methods: string[]; // Win32截图方法列表
  name: string; // 显示名称
}

/**
 * 设备信息
 */
export type DeviceInfo =
  | Partial<AdbDevice>
  | Partial<Win32Window>
  | Partial<PlayCoverDevice>
  | Partial<GamepadDevice>
  | null;

/**
 * MaaFramework 状态
 */
interface MFWState {
  // 连接状态
  connectionStatus: ConnectionStatus;
  controllerType: DeviceType;
  controllerId: string | null;
  deviceInfo: DeviceInfo;

  // 设备列表
  adbDevices: AdbDevice[];
  win32Windows: Win32Window[];

  // 错误信息
  errorMessage: string | null;

  // 操作方法
  setConnectionStatus: (status: ConnectionStatus) => void;
  setControllerInfo: (
    type: DeviceType,
    id: string | null,
    info: DeviceInfo
  ) => void;
  updateAdbDevices: (devices: AdbDevice[]) => void;
  updateWin32Windows: (windows: Win32Window[]) => void;
  setErrorMessage: (message: string | null) => void;
  clearConnection: () => void;
}

/**
 * MaaFramework Store
 */
export const useMFWStore = create<MFWState>()((set) => ({
  // 初始状态
  connectionStatus: "disconnected",
  controllerType: null,
  controllerId: null,
  deviceInfo: null,
  adbDevices: [],
  win32Windows: [],
  errorMessage: null,

  // 设置连接状态
  setConnectionStatus: (status) =>
    set({
      connectionStatus: status,
      errorMessage: status === "failed" ? null : undefined,
    }),

  // 设置控制器信息
  setControllerInfo: (type, id, info) =>
    set({
      controllerType: type,
      controllerId: id,
      deviceInfo: info,
      connectionStatus: id ? "connected" : "disconnected",
      errorMessage: null,
    }),

  // 更新 ADB 设备列表
  updateAdbDevices: (devices) =>
    set({
      adbDevices: devices,
    }),

  // 更新 Win32 窗口列表
  updateWin32Windows: (windows) =>
    set({
      win32Windows: windows,
    }),

  // 设置错误信息
  setErrorMessage: (message) =>
    set({
      errorMessage: message,
      connectionStatus: message ? "failed" : undefined,
    }),

  // 清除连接状态
  clearConnection: () =>
    set({
      connectionStatus: "disconnected",
      controllerType: null,
      controllerId: null,
      deviceInfo: null,
      errorMessage: null,
    }),
}));
