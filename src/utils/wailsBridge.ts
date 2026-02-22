/**
 * Wails 运行时桥接模块
 * 用于检测 Wails 环境并提供事件监听等功能
 */

// Wails 运行时类型声明
interface WailsRuntime {
  EventsOn: (
    eventName: string,
    callback: (...data: unknown[]) => void
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
    };
  };
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
  callback: (data: T) => void
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
  level: "info" | "error" = "info"
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
