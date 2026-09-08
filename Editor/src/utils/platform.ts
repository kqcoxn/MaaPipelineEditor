// 平台检测工具函数
export function detectPlatform(): "windows" | "macos" | "linux" {
  if (typeof navigator === "undefined") return "windows";
  const platform =
    navigator.platform.toLowerCase() || navigator.userAgent.toLowerCase();
  if (platform.includes("mac") || platform.includes("darwin")) return "macos";
  if (platform.includes("win")) return "windows";
  if (platform.includes("linux")) return "linux";
  return "windows"; // 默认
}

