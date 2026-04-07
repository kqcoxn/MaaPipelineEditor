// 平台检测工具函数
export function detectPlatform(): "windows" | "macos" | "linux" {
  const platform =
    navigator.platform.toLowerCase() || navigator.userAgent.toLowerCase();
  if (platform.includes("win")) return "windows";
  if (platform.includes("mac") || platform.includes("darwin")) return "macos";
  if (platform.includes("linux")) return "linux";
  return "windows"; // 默认
}

// 平台对应的可用连接类型
export const PLATFORM_TABS: Record<
  "windows" | "macos" | "linux",
  Array<"adb" | "win32" | "playcover" | "gamepad" | "wlroots" | "macos">
> = {
  windows: ["adb", "win32", "gamepad"],
  macos: ["adb", "macos", "playcover"],
  linux: ["adb", "wlroots"],
};

// macOS 默认方法配置
export const MACOS_DEFAULT_METHODS = {
  screencap: ["ScreenCaptureKit"],
  input: ["GlobalEvent", "PostToPid"],
};
