import { readFile, writeFile } from "node:fs/promises";

export const desktopConfigPath = new URL("../../Desktop/desktop-release.json", import.meta.url);
export const isDesktopRevision = value => typeof value === "string" && /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value) && value.split(".").every(n => BigInt(n) <= 18446744073709551615n);
export function compareDesktopRevisions(a, b) {
  if (!isDesktopRevision(a) || !isDesktopRevision(b)) throw new Error("桌面标识版号必须为 X.Y.Z");
  const right = b.split(".").map(BigInt);
  for (const [i, left] of a.split(".").map(BigInt).entries()) {
    if (left !== right[i]) return left > right[i] ? 1 : -1;
  }
  return 0;
}
export const isLegacyRevision = value => Number.isInteger(value) && value > 0 && value <= 0xffffffff;
export function validateDesktopConfig(config) {
  if (!isLegacyRevision(config.desktopRevision) || !isLegacyRevision(config.minimumDesktopRevision) || config.minimumDesktopRevision > config.desktopRevision)
    throw new Error("过渡修订号必须满足 1 <= minimumDesktopRevision <= desktopRevision <= 4294967295");
  if (compareDesktopRevisions(config.minimumDesktopIdentifier, config.desktopIdentifier) > 0)
    throw new Error("最低桌面标识版号不能超过当前标识版号");
  return config;
}
export async function readDesktopConfig(file = desktopConfigPath) {
  return validateDesktopConfig(JSON.parse(await readFile(file, "utf8")));
}
export function planDesktopRevision(current, version, minimum = false) {
  const config = { ...validateDesktopConfig(current) };
  const key = minimum ? "minimumDesktopIdentifier" : "desktopIdentifier";
  if (compareDesktopRevisions(version, config[key]) < 0) throw new Error("不能降低桌面标识版号");
  if (version === config[key]) return config;
  const legacyKey = minimum ? "minimumDesktopRevision" : "desktopRevision";
  if (minimum && version !== config.desktopIdentifier)
    throw new Error("过渡期最低版号只能同步到当前桌面标识版号，以保证整数修订号准确对应");
  config[legacyKey] = minimum ? config.desktopRevision : config.desktopRevision + 1;
  config[key] = version;
  validateDesktopConfig(config);
  return config;
}
export async function setDesktopRevision(version, file = desktopConfigPath, minimum = false) {
  const source = await readFile(file, "utf8");
  const config = planDesktopRevision(JSON.parse(source), version, minimum);
  const key = minimum ? "minimumDesktopIdentifier" : "desktopIdentifier";
  const legacyKey = minimum ? "minimumDesktopRevision" : "desktopRevision";
  let updated = source;
  for (const field of [key, legacyKey]) {
    const pattern = new RegExp(`("${field}"\\s*:\\s*)("[^"]*"|[0-9]+)`, "g");
    if ([...updated.matchAll(pattern)].length !== 1) throw new Error(`无法唯一定位 ${field}`);
    updated = updated.replace(pattern, (_, prefix) => prefix + JSON.stringify(config[field]));
  }
  await writeFile(file, updated);
  return config;
}
