import * as fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

export async function extractRuntime(archive, destination) {
  await fs.mkdir(destination, { recursive: true });
  if (process.platform === "win32") {
    await exec("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command",
      "$ErrorActionPreference = 'Stop'; Expand-Archive -LiteralPath $env:MPE_MFW_ARCHIVE -DestinationPath $env:MPE_MFW_EXTRACT -Force"], {
      env: { ...process.env, MPE_MFW_ARCHIVE: archive, MPE_MFW_EXTRACT: destination },
    });
  } else {
    await exec("unzip", ["-q", archive, "-d", destination]);
  }
}

export async function findRuntime(directory, library) {
  const candidates = [];
  async function visit(current) {
    const entries = await fs.readdir(current, { withFileTypes: true });
    if (path.basename(current) === "bin" && entries.some(entry => entry.name === library && entry.isFile())) {
      candidates.push(path.dirname(current));
    }
    for (const entry of entries) if (entry.isDirectory()) await visit(path.join(current, entry.name));
  }
  await visit(directory);
  if (candidates.length !== 1) throw new Error(`发行包中未找到唯一的 ${library} 所在 bin 目录`);
  const root = candidates[0];
  const binEntries = await fs.readdir(path.join(root, "bin"));
  const agentLibrary = library.replace("MaaFramework", "MaaAgentServer");
  if (!binEntries.includes(agentLibrary)) throw new Error(`发行包缺少 ${agentLibrary}`);
  const agent = path.join(root, "share", "MaaAgentBinary");
  if (!(await fs.readdir(agent)).length) throw new Error("发行包的 MaaAgentBinary 为空");
  return root;
}

// 仅替换发行包的两个组件和版本标记；OCR、配置与其他资源保持原位。
// 注入文件操作使测试能够模拟第二个组件替换失败，验证真实回滚过程。
export async function commitRuntime(stagedRoot, targetRoot, io = fs) {
  const backup = await io.mkdtemp(path.join(targetRoot, ".mpe-mfw-rollback-"));
  const components = ["bin", path.join("share", "MaaAgentBinary"), ".version"];
  const moved = [];
  const installed = [];
  try {
    for (const component of components) {
      const target = path.join(targetRoot, component);
      const saved = path.join(backup, component);
      await io.mkdir(path.dirname(saved), { recursive: true });
      try {
        await io.rename(target, saved);
        moved.push(component);
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      await io.mkdir(path.dirname(target), { recursive: true });
      await io.rename(path.join(stagedRoot, component), target);
      installed.push(component);
    }
  } catch (error) {
    try {
      for (const component of installed.toReversed()) {
        await io.rm(path.join(targetRoot, component), { recursive: true, force: true });
      }
      for (const component of moved.toReversed()) {
        await io.rename(path.join(backup, component), path.join(targetRoot, component));
      }
    } catch (rollbackError) {
      throw new Error(`替换失败且回滚未完成；恢复文件位于 ${backup}。原错误: ${error.message}；回滚错误: ${rollbackError.message}`);
    }
    await io.rm(backup, { recursive: true, force: true });
    throw new Error(`替换失败，已恢复旧运行时: ${error.message}`);
  }
  try {
    await io.rm(backup, { recursive: true, force: true });
  } catch (error) {
    throw new Error(`运行时已更新，但临时回滚文件清理失败: ${backup}；${error.message}`);
  }
}

export async function installRuntime(plan, download) {
  await fs.mkdir(plan.root, { recursive: true });
  const lock = path.join(plan.root, ".mpe-mfw-update.lock");
  try {
    await fs.mkdir(lock);
  } catch (error) {
    if (error.code === "EEXIST") throw new Error(`更新锁已存在；确认没有更新进程后再移除: ${lock}`);
    throw error;
  }
  let temporary;
  try {
    temporary = await fs.mkdtemp(path.join(plan.root, ".mpe-mfw-stage-"));
    const archive = path.join(temporary, "runtime.zip");
    await download(plan, archive);
    const extracted = path.join(temporary, "extracted");
    await extractRuntime(archive, extracted);
    const staged = await findRuntime(extracted, plan.library);
    await fs.writeFile(path.join(staged, ".version"), `${plan.version}\n`);
    return await commitRuntime(staged, plan.root);
  } finally {
    try {
      if (temporary) await fs.rm(temporary, { recursive: true, force: true });
    } finally {
      await fs.rmdir(lock);
    }
  }
}
