/**
 * Wails 运行时桥接模块
 * 用于检测 Wails 环境并提供事件监听等功能
 */

// Wails 运行时类型声明
interface WailsRuntime {
  EventsOn: (
    eventName: string,
    callback: (...data: unknown[]) => void,
  ) => () => void;
  EventsOff: (eventName: string) => void;
  LogInfo: (message: string) => void;
  LogError: (message: string) => void;
}

// Wails Go bindings 类型
interface WailsGoBindings {
  main?: {
    App?: {
      GetPort: () => Promise<number>;
      IsBridgeRunning: () => Promise<boolean>;
      GetWorkDir: () => Promise<string>;
      SetRootDir: (rootDir: string) => Promise<void>;
      RestartBridge: () => Promise<void>;
      GetVersion: () => Promise<string>;
      CheckUpdate: () => Promise<UpdateInfo>;
      GetUpdateDownloadURL: () => Promise<string>;
    };
  };
}

// 更新信息类型
export interface UpdateInfo {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseNotes: string;
  downloadURL: string;
  publishedAt: string;
}

// 扩展 Window 类型
declare global {
  interface Window {
    runtime?: WailsRuntime;
    go?: WailsGoBindings;
  }
}

/**
 * 检测是否在 Wails 环境中运行
 */
export function isWailsEnvironment(): boolean {
  return typeof window !== "undefined" && !!window.runtime;
}

/**
 * 监听 Wails 事件
 * @param eventName 事件名称
 * @param callback 回调函数
 * @returns 取消监听的函数，如果不在 Wails 环境则返回空函数
 */
export function onWailsEvent<T = unknown>(
  eventName: string,
  callback: (data: T) => void,
): () => void {
  if (!isWailsEnvironment()) {
    return () => {};
  }

  return window.runtime!.EventsOn(eventName, (...args: unknown[]) => {
    // Wails EventsOn 会将数据作为第一个参数传递
    callback(args[0] as T);
  });
}

/**
 * 取消监听 Wails 事件
 * @param eventName 事件名称
 */
export function offWailsEvent(eventName: string): void {
  if (isWailsEnvironment()) {
    window.runtime!.EventsOff(eventName);
  }
}

/**
 * 调用 Wails 后端的 GetPort 方法
 * @returns 端口号，如果不在 Wails 环境或调用失败则返回 null
 */
export async function getWailsPort(): Promise<number | null> {
  if (!isWailsEnvironment()) {
    return null;
  }

  try {
    if (window.go?.main?.App?.GetPort) {
      return await window.go.main.App.GetPort();
    }
  } catch (error) {
    console.error("[WailsBridge] Failed to get port:", error);
  }

  return null;
}

/**
 * 检查 LocalBridge 是否正在运行
 * @returns 是否运行中，如果不在 Wails 环境则返回 null
 */
export async function isBridgeRunning(): Promise<boolean | null> {
  if (!isWailsEnvironment()) {
    return null;
  }

  try {
    if (window.go?.main?.App?.IsBridgeRunning) {
      return await window.go.main.App.IsBridgeRunning();
    }
  } catch (error) {
    console.error("[WailsBridge] Failed to check bridge status:", error);
  }

  return null;
}

/**
 * Wails 日志输出
 */
export function wailsLog(
  message: string,
  level: "info" | "error" = "info",
): void {
  if (!isWailsEnvironment()) {
    return;
  }

  if (level === "error") {
    window.runtime!.LogError(message);
  } else {
    window.runtime!.LogInfo(message);
  }
}

/**
 * 获取当前工作目录
 * @returns 工作目录路径，如果不在 Wails 环境或调用失败则返回 null
 */
export async function getWorkDir(): Promise<string | null> {
  if (!isWailsEnvironment()) {
    return null;
  }

  try {
    if (window.go?.main?.App?.GetWorkDir) {
      return await window.go.main.App.GetWorkDir();
    }
  } catch (error) {
    console.error("[WailsBridge] Failed to get work dir:", error);
  }

  return null;
}

/**
 * 设置根目录并持久化保存
 * @param rootDir 根目录路径
 * @returns 是否成功，如果不在 Wails 环境则返回 null
 */
export async function setRootDir(rootDir: string): Promise<boolean | null> {
  if (!isWailsEnvironment()) {
    return null;
  }

  try {
    if (window.go?.main?.App?.SetRootDir) {
      await window.go.main.App.SetRootDir(rootDir);
      return true;
    }
  } catch (error) {
    console.error("[WailsBridge] Failed to set root dir:", error);
    return false;
  }

  return null;
}

/**
 * 重启 LocalBridge
 * @returns 是否成功，如果不在 Wails 环境则返回 null
 */
export async function restartBridge(): Promise<boolean | null> {
  if (!isWailsEnvironment()) {
    return null;
  }

  try {
    if (window.go?.main?.App?.RestartBridge) {
      await window.go.main.App.RestartBridge();
      return true;
    }
  } catch (error) {
    console.error("[WailsBridge] Failed to restart bridge:", error);
    return false;
  }

  return null;
}

/**
 * 获取当前应用版本
 * @returns 版本号字符串，如果不在 Wails 环境或调用失败则返回 null
 */
export async function getVersion(): Promise<string | null> {
  if (!isWailsEnvironment()) {
    return null;
  }

  try {
    if (window.go?.main?.App?.GetVersion) {
      return await window.go.main.App.GetVersion();
    }
  } catch (error) {
    console.error("[WailsBridge] Failed to get version:", error);
  }

  return null;
}

/**
 * 检查更新
 * @returns 更新信息，如果不在 Wails 环境或调用失败则返回 null
 */
export async function checkUpdate(): Promise<UpdateInfo | null> {
  if (!isWailsEnvironment()) {
    return null;
  }

  try {
    if (window.go?.main?.App?.CheckUpdate) {
      return await window.go.main.App.CheckUpdate();
    }
  } catch (error) {
    console.error("[WailsBridge] Failed to check update:", error);
  }

  return null;
}

/**
 * 获取更新下载链接
 * @returns 下载链接，如果不在 Wails 环境或调用失败则返回 null
 */
export async function getUpdateDownloadURL(): Promise<string | null> {
  if (!isWailsEnvironment()) {
    return null;
  }

  try {
    if (window.go?.main?.App?.GetUpdateDownloadURL) {
      return await window.go.main.App.GetUpdateDownloadURL();
    }
  } catch (error) {
    console.error("[WailsBridge] Failed to get update download URL:", error);
  }

  return null;
}

// GitHub Release API 常量
const GITHUB_API_URL =
  "https://api.github.com/repos/kqcoxn/MaaPipelineEditor/releases/latest";

// GitHub Release 响应结构
interface GitHubRelease {
  tag_name: string;
  name: string;
  body: string;
  published_at: string;
  assets: Array<{
    name: string;
    browser_download_url: string;
  }>;
}

/**
 * 从前端直接检查 GitHub Release 更新
 * @param currentVersion 当前版本号
 * @returns 更新信息，请求失败返回 null
 */
export async function checkUpdateFromFrontend(
  currentVersion: string,
): Promise<UpdateInfo | null> {
  try {
    const response = await fetch(GITHUB_API_URL, {
      headers: {
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!response.ok) {
      console.error("[UpdateCheck] GitHub API error:", response.status);
      return null;
    }

    const release: GitHubRelease = await response.json();

    // 解析版本号
    const latestVersionStr = release.tag_name.replace(/^v/, "");
    const currentVersionStr = currentVersion.replace(/^v/, "");

    // 简单版本比较
    const hasUpdate = compareVersions(latestVersionStr, currentVersionStr) > 0;

    // 查找下载链接
    const downloadURL = findDownloadURL(release.assets);

    return {
      hasUpdate,
      currentVersion,
      latestVersion: release.tag_name,
      releaseNotes: release.body,
      downloadURL,
      publishedAt: release.published_at,
    };
  } catch (error) {
    console.error("[UpdateCheck] Failed to check update:", error);
    return null;
  }
}

/**
 * 比较版本号
 * @returns 1: a > b, -1: a < b, 0: a == b
 */
function compareVersions(a: string, b: string): number {
  const partsA = a.split(".").map(Number);
  const partsB = b.split(".").map(Number);
  const maxLen = Math.max(partsA.length, partsB.length);

  for (let i = 0; i < maxLen; i++) {
    const numA = partsA[i] || 0;
    const numB = partsB[i] || 0;
    if (numA > numB) return 1;
    if (numA < numB) return -1;
  }
  return 0;
}

/**
 * 根据当前平台查找下载链接
 */
function findDownloadURL(
  assets: Array<{ name: string; browser_download_url: string }>,
): string {
  // 检测当前平台
  const platform =
    navigator.platform.toLowerCase() || navigator.userAgent.toLowerCase();
  let platformPattern: string;

  if (platform.includes("win")) {
    platformPattern = "windows-amd64";
  } else if (platform.includes("mac") || platform.includes("darwin")) {
    // 检测是否为 Apple Silicon
    if (navigator.userAgent.includes("Arm")) {
      platformPattern = "darwin-arm64";
    } else {
      platformPattern = "darwin-amd64";
    }
  } else if (platform.includes("linux")) {
    platformPattern = "linux-amd64";
  } else {
    return "https://github.com/kqcoxn/MaaPipelineEditor/releases/latest";
  }

  // 查找 Extremer 包
  for (const asset of assets) {
    const name = asset.name.toLowerCase();
    if (name.includes("extremer") && name.includes(platformPattern)) {
      return asset.browser_download_url;
    }
  }

  return "https://github.com/kqcoxn/MaaPipelineEditor/releases/latest";
}
