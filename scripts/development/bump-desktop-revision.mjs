import { bumpDesktopRevision } from "../lib/desktop-release.mjs";

if (process.argv.length > 2)
  throw new Error("用法：yarn desktop:revision（当前修订号加一）");
const config = await bumpDesktopRevision();
console.log(
  `MPE Desktop 修订号：${config.desktopRevision - 1} → ${config.desktopRevision}`,
);
console.log(
  `最低兼容修订号保持 ${config.minimumDesktopRevision}，产品版本号不变。`,
);
