import type { DeviceInfo, DeviceType } from "../../stores/mfwStore";

export function getControllerDisplayName(
  deviceInfo: DeviceInfo,
  controllerId: string | null,
  controllerType: DeviceType,
): string {
  if (!deviceInfo || typeof deviceInfo !== "object") {
    return controllerId ?? "未连接";
  }
  const info = deviceInfo as Record<string, unknown>;
  const keys =
    controllerType === "win32"
      ? ["window_name", "class_name", "hwnd"]
      : controllerType === "macos"
        ? ["app_name", "name", "pid"]
        : ["name", "address", "socket_path", "uuid"];
  for (const key of keys) {
    const value = info[key];
    if (typeof value === "string" && value.trim() !== "") {
      return value.trim();
    }
  }
  return controllerId ?? "未连接";
}
