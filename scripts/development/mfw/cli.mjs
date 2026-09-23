import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { createPlan } from "./plan.mjs";
import { downloadRuntime } from "./download.mjs";
import { installRuntime } from "./install.mjs";
import { downloadOCR, OCR_COMPONENT, OCR_URL } from "./ocr.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

async function main(ocr, signal) {
  const { values } = parseArgs({
    args: process.argv.slice(2).filter(arg => arg !== "--"),
    options: {
      "dry-run": { type: "boolean" }, help: { type: "boolean" },
      version: { type: "string" },
      "binary-dir": { type: "string" },
    },
  });
  if (values.help) {
    console.log(`用法: yarn ${ocr ? "lb:deps" : "update:mfw"} [--dry-run] [--version 5.13.0]
  安装内容: MaaFramework、MaaAgentBinary${ocr ? "、OCR (ppocr_v6-small)" : ""}
  默认版本: Editor/src/stores/app/configStore.ts 的 mfwVersion
  --binary-dir  LocalBridge 可执行文件目录，默认 LocalBridge/build
  --dry-run     只显示版本和目标目录，不联网、不写入
更新前停止使用该运行时的 LocalBridge / Agent，更新后重新启动。`);
    return;
  }
  const plan = createPlan(root, values);
  // 普通状态使用 ASCII，规避部分 Windows 终端的中文宽字符显示/复制重字。
  console.log(`MaaFramework ${plan.version} + Agent${ocr ? " + OCR (ppocr_v6-small)" : ""}`);
  console.log(`Target: ${path.join(plan.binaryDir, "runtime")}`);
  if (values["dry-run"]) {
    console.log(`Installed: ${plan.installedVersion}; required: ${plan.requiredVersion}\nLibrary: ${plan.libDir}\nAgent: ${plan.agentDir}\nArchive: ${plan.prefix}*.zip`);
    if (ocr) console.log(`OCR: ${path.join(plan.binaryDir, "runtime", OCR_COMPONENT)}\nModel URL: ${OCR_URL}`);
    return;
  }
  console.log("Stop LocalBridge / Agent before updating. Ctrl+C cancels the download.");
  await installRuntime(plan, (p, dest) => downloadRuntime(p, dest, { signal }), {
    signal, ...(ocr ? { downloadOCR: dest => downloadOCR(dest, { signal }) } : {}),
  });
  console.log("Done. Restart LocalBridge to load the installed dependencies.");
}

export async function runCLI({ ocr = false } = {}) {
  const controller = new AbortController();
  const cancel = () => controller.abort(new DOMException("Cancelled", "AbortError"));
  process.on("SIGINT", cancel);
  process.on("SIGTERM", cancel);
  try {
    await main(ocr, controller.signal);
  } catch (error) {
    if (error.name === "AbortError") {
      console.error("Cancelled. Temporary files and update lock released.");
      process.exitCode = 130;
    } else {
      console.error(`Update failed: ${error.message}`);
      process.exitCode = 1;
    }
  } finally {
    process.off("SIGINT", cancel);
    process.off("SIGTERM", cancel);
  }
}
