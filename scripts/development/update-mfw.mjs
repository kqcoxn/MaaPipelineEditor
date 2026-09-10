#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { createPlan } from "./mfw/plan.mjs";
import { downloadRuntime } from "./mfw/download.mjs";
import { installRuntime } from "./mfw/install.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2).filter(arg => arg !== "--"),
    options: {
      "dry-run": { type: "boolean" }, help: { type: "boolean" },
      version: { type: "string" },
      "binary-dir": { type: "string" },
    },
  });
  if (values.help) {
    console.log(`用法: yarn update:mfw [--dry-run] [--version 5.13.0]
  默认版本: Editor/src/stores/app/configStore.ts 的 mfwVersion
  --binary-dir  LocalBridge 可执行文件目录，默认 LocalBridge/build
  --dry-run     只显示版本和目标目录，不联网、不写入
更新前停止使用该运行时的 LocalBridge / Agent，更新后重新启动。`);
    return;
  }
  const plan = createPlan(root, values);
  console.log(`MaaFramework: ${plan.installedVersion} -> ${plan.version} (源码要求 ${plan.requiredVersion})
动态库: ${plan.libDir}
Agent: ${plan.agentDir}
发行包: ${plan.prefix}*.zip`);
  if (values["dry-run"]) return;
  console.log("将替换 bin、share/MaaAgentBinary 与 .version；请确保相关进程已停止。");
  await installRuntime(plan, downloadRuntime);
  console.log(`更新完成: ${plan.version}\n请重启 LocalBridge，确认初始化成功及日志中的实际库路径。`);
}

main().catch(error => {
  console.error(`更新 MaaFramework 失败: ${error.message}`);
  process.exitCode = 1;
});
