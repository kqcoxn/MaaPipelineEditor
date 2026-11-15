import { parseTree } from "jsonc-parser";

export interface IOSControllerOptions {
  udid: string;
  connection: "Auto" | "USB" | "WiFi";
  screencap_methods: string[];
  config: string;
}

/** Validate before disconnecting the applied device; send the original JSON unchanged. */
export function iosConfigError(raw: string): string | undefined {
  raw = raw.trim() || "{}";
  let config: Record<string, unknown>;
  try {
    config = JSON.parse(raw || "{}");
    if (!config || typeof config !== "object" || Array.isArray(config)) return "请填写 JSON 对象";
  } catch { return "JSON 格式无效"; }
  const fields: Record<string, (value: unknown) => boolean> = {
    server_port: value => integerIn(value, 0, 65535),
    wifi_port: value => integerIn(value, 1, 65535),
    wifi_address: value => typeof value === "string" && !value.includes("\0"),
    shared_control: value => typeof value === "boolean",
    max_bitrate: value => typeof value === "number" && Number.isInteger(value) && value >= 0,
    max_fps: value => integerIn(value, 0, 240),
    hardware_decode: value => typeof value === "boolean",
  };
  for (const [key, value] of Object.entries(config)) {
    if (!Object.hasOwn(fields, key)) return `不支持的配置字段：${key}`;
    if (!fields[key](value)) return `配置字段 ${key} 的值无效`;
  }
  // JSON.parse rounds uint64 values. Check the original integer tokens so the
  // largest valid bitrate survives unchanged and overflow is caught before reconnect.
  const numericLimits: Record<string, bigint> = { server_port: 65535n, wifi_port: 65535n, max_fps: 240n, max_bitrate: (1n << 64n) - 1n };
  const keys = new Set<string>();
  for (const property of parseTree(raw.trim() || "{}")?.children ?? []) {
    const [keyNode, valueNode] = property.children!;
    const key = String(keyNode.value);
    if (keys.has(key)) return `配置字段 ${key} 重复`;
    keys.add(key);
    if (!Object.hasOwn(numericLimits, key)) continue;
    const token = raw.slice(valueNode.offset, valueNode.offset + valueNode.length);
    if (!/^(0|[1-9]\d*)$/.test(token) || BigInt(token) > numericLimits[key]) return `配置字段 ${key} 的值无效`;
  }
}

function integerIn(value: unknown, min: number, max: number): boolean {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}
