import { readFile, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

// 下载仅写临时目录，全局替换由 prepare-local 的锁和安装事务负责。
export async function withDesktopRuntime({ root, runtime, version, explicit }, prepare, download = directory => {
  execFileSync(process.execPath, [
    path.join(root, "scripts/development/update-lb-deps.mjs"),
    "--binary-dir", directory, "--version", version,
  ], { cwd: root, stdio: "inherit" });
}) {
  let actual;
  try {
    actual = (await readFile(path.join(runtime, "maafw/.version"), "utf8")).trim().replace(/^v/, "");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  if (actual === version) return await prepare(runtime);
  if (explicit) {
    throw new Error(`指定 runtime ${runtime} 需要 MaaFramework ${version}，实际 ${actual ?? "未安装"}。请准备配套依赖或不指定目录以自动下载。`);
  }
  console.log(`全局 runtime ${actual ?? "未安装"}，正在准备 MaaFramework ${version}、MaaAgentBinary 与 OCR。`);
  const temporary = await mkdtemp(path.join(os.tmpdir(), "mpe-desktop-runtime-"));
  try {
    await download(temporary);
    return await prepare(path.join(temporary, "runtime"));
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}
