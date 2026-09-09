export { detectPlatform } from "@/utils/platform";

// 平台对应的可用连接类型
export const PLATFORM_TABS: Record<
  "windows" | "macos" | "linux",
  Array<"adb" | "win32" | "playcover" | "gamepad" | "linux" | "macos">
> = {
  windows: ["adb", "win32", "gamepad"],
  macos: ["adb", "macos", "playcover"],
  linux: ["adb", "linux"],
};

// macOS 默认方法配置
export const MACOS_DEFAULT_METHODS = {
  screencap: ["ScreenCaptureKit"],
  input: ["GlobalEvent", "PostToPid"],
};
