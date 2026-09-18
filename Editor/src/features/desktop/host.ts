export interface DesktopContext {
  address: string;
  root: string;
  version: string;
  projectKey: string;
}
declare global {
  interface Window {
    __MPE_DESKTOP__?: DesktopContext;
    __TAURI__?: {
      core: {
        invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>;
      };
      event: {
        listen(name: string, callback: () => void): Promise<() => void>;
      };
    };
  }
}
export const desktopContext =
  typeof window !== "undefined" ? window.__MPE_DESKTOP__ : undefined;
export function desktopInvoke<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  if (!desktopContext || !window.__TAURI__)
    return Promise.reject(new Error("桌面宿主不可用"));
  return window.__TAURI__.core.invoke<T>(command, args);
}
