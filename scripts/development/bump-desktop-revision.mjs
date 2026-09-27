import { createInterface } from "node:readline/promises";
import { readFile } from "node:fs/promises";
import { readDesktopConfig, setDesktopRevision, planDesktopRevision } from "../lib/desktop-release.mjs";

const args = process.argv.slice(2);
if (args.some(a => a.startsWith("-") && !["--yes", "-y", "--minimum", "--dry-run"].includes(a)) || args.filter(a => !a.startsWith("-")).length > 1)
  throw new Error("用法：yarn desktop:revision [X.Y.Z] [--minimum] [--yes] [--dry-run]");
const current = await readDesktopConfig();
const product = JSON.parse(await readFile(new URL("../../Desktop/package.json", import.meta.url), "utf8")).version;
const minimum = args.includes("--minimum");
const key = minimum ? "minimumDesktopIdentifier" : "desktopIdentifier";
const ask = async question => {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try { return (await rl.question(question)).trim(); } finally { rl.close(); }
};
let version = args.find(a => !a.startsWith("-"));
if (!version) version = args.includes("--yes") || args.includes("-y") || args.includes("--dry-run")
  ? product : (await ask(`目标桌面标识版号（回车使用产品版本 ${product}）：`)) || product;
version = version.replace(/^v/i, "");
const next = planDesktopRevision(current, version, minimum);
const legacyKey = minimum ? "minimumDesktopRevision" : "desktopRevision";
console.log(`Desktop/desktop-release.json: ${key}: ${current[key]} → ${version}`);
console.log(`过渡字段 ${legacyKey}: ${current[legacyKey]} → ${next[legacyKey]}`);
if (version === current[key]) console.log("版号相同，无需修改。");
else if (!args.includes("--dry-run") && (args.includes("--yes") || args.includes("-y") || /^(y|yes)$/i.test(await ask("确认替换？(y/N)：")))) {
  await setDesktopRevision(version, undefined, minimum);
  console.log("已更新，请使用 git diff 复核。");
}
