import { readFile, writeFile } from "node:fs/promises";

export const desktopConfigPath = new URL(
  "../../Desktop/desktop-release.json",
  import.meta.url,
);

export function validateDesktopConfig(config) {
  for (const key of ["desktopRevision", "minimumDesktopRevision"]) {
    if (
      !Number.isSafeInteger(config[key]) ||
      config[key] < 1 ||
      config[key] > 0xffffffff
    )
      throw new Error(`${key} 必须是 1..4294967295 的整数`);
  }
  if (config.minimumDesktopRevision > config.desktopRevision)
    throw new Error("最低桌面修订号不能超过当前桌面修订号");
  return config;
}

export async function readDesktopConfig(file = desktopConfigPath) {
  return validateDesktopConfig(JSON.parse(await readFile(file, "utf8")));
}

export async function bumpDesktopRevision(file = desktopConfigPath) {
  const config = await readDesktopConfig(file);
  config.desktopRevision++;
  validateDesktopConfig(config);
  await writeFile(file, JSON.stringify(config, null, 2) + "\n");
  return config;
}
