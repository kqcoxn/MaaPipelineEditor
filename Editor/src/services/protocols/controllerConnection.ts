import type { MFWProtocol } from "./MFWProtocol";
import type { DeviceInfo } from "@/stores/connection/mfwStore";
import isEqual from "lodash/isEqual";

type PersistedControllerConnection<T> = {
  params: T;
  deviceInfo?: Exclude<DeviceInfo, null>;
};

export type ControllerConnectionRequest =
  | { type: "adb" } & PersistedControllerConnection<Parameters<MFWProtocol["createAdbController"]>[0]>
  | { type: "win32" } & PersistedControllerConnection<Parameters<MFWProtocol["createWin32Controller"]>[0]>
  | { type: "playcover" } & PersistedControllerConnection<Parameters<MFWProtocol["createPlayCoverController"]>[0]>
  | { type: "gamepad" } & PersistedControllerConnection<Parameters<MFWProtocol["createGamepadController"]>[0]>
  | { type: "linux" } & PersistedControllerConnection<Parameters<MFWProtocol["createLinuxController"]>[0]>
  | { type: "macos" } & PersistedControllerConnection<Parameters<MFWProtocol["createMacosController"]>[0]>;

/** 比较提交参数，不把设备列表元数据或对象属性顺序当作配置变更。 */
export function sameControllerConnection(a: ControllerConnectionRequest | null, b: ControllerConnectionRequest | null): boolean {
  return !!a && !!b && a.type === b.type && isEqual(a.params, b.params);
}
