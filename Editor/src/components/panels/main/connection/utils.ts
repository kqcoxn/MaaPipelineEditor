export { detectPlatform } from "@/utils/platform";

// 平台对应的可用连接类型
export const PLATFORM_TABS: Record<
  "windows" | "macos" | "linux",
  Array<"ios" | "adb" | "win32" | "playcover" | "gamepad" | "linux" | "macos">
> = {
  windows: ["adb", "ios", "win32", "gamepad"],
  macos: ["adb", "ios", "macos", "playcover"],
  linux: ["adb", "ios", "linux"],
};

// macOS 默认方法配置
export const MACOS_DEFAULT_METHODS = {
  screencap: ["ScreenCaptureKit"],
  input: ["GlobalEvent", "PostToPid"],
};
