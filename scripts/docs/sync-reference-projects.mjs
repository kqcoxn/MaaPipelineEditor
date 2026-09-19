#!/usr/bin/env node

import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "../..");
const manifestPath = path.join(scriptDirectory, "reference-projects.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const args = process.argv.slice(2).filter((arg) => arg !== "--");
const whatIf = args.some((arg) => arg.toLowerCase() === "-whatif" || arg.toLowerCase() === "--what-if");
const referenceRootArgIndex = args.findIndex((arg) => arg.toLowerCase() === "-referenceroot" || arg.toLowerCase() === "--reference-root");
const referenceRoot = path.resolve(
  referenceRootArgIndex >= 0 ? args[referenceRootArgIndex + 1] : path.join(repositoryRoot, "..", "maa-refs"),
);

function git(target, gitArgs) {
  const result = spawnSync("git", ["-C", target, "-c", "submodule.recurse=false", ...gitArgs], { encoding: "utf8" });
  if (result.error) throw new Error(`无法启动 git：${result.error.message}`);
  if (result.status !== 0) {
    throw new Error(`git ${gitArgs.join(" ")} 失败：${(result.stderr || result.stdout || "").trim()}`);
  }
  return (result.stdout || "").trim();
}

function gitRemote(url) {
  return url.trim().replace(/\/$/, "").replace(/\.git$/, "").replace(/^git@github\.com:/, "https://github.com/").toLowerCase();
}

function result(name, status, detail) {
  return { name, status, detail };
}

if (spawnSync("git", ["--version"], { stdio: "ignore" }).status !== 0) {
  throw new Error("未找到 git，请先安装 Git 并确保它在 PATH 中。");
}

if (!whatIf) mkdirSync(referenceRoot, { recursive: true });
const results = [];
for (const project of manifest.projects) {
  const target = path.resolve(referenceRoot, project.directory);
  process.stdout.write(`\n[${project.name}] ${target}\n`);
  try {
    if (!target.startsWith(`${referenceRoot}${path.sep}`)) {
      throw new Error(`目标目录位于参考仓库根目录之外：${target}`);
    }
    if (!existsSync(target)) {
      if (whatIf) results.push(result(project.name, "Preview", `将克隆 ${project.repository}`));
      else {
        const clone = spawnSync("git", ["clone", "--no-recurse-submodules", project.repository, target], { encoding: "utf8", stdio: "inherit" });
        if (clone.status !== 0) throw new Error(`git clone 失败（退出码 ${clone.status}）`);
        results.push(result(project.name, "Cloned", project.repository));
      }
      continue;
    }
    if (!existsSync(path.join(target, ".git"))) throw new Error("目标目录存在但不是 Git 仓库。");
    if (lstatSync(target).isSymbolicLink() || !lstatSync(path.join(target, ".git")).isDirectory()
      || !realpathSync(target).startsWith(`${realpathSync(referenceRoot)}${path.sep}`)
      || realpathSync(target) === realpathSync(repositoryRoot)) {
      throw new Error("仅允许覆盖参考目录内的独立仓库，不处理符号链接、worktree 或 MPE 自身仓库。");
    }
    const origin = git(target, ["remote", "get-url", "origin"]);
    const knownUrls = [project.repository, ...(project.repositoryAliases || [])].map(gitRemote);
    if (whatIf) {
      results.push(result(project.name, "Preview", "将以登记的原仓库默认分支覆盖本地修改和提交，清理未跟踪及忽略文件，移除已检出的子模块"));
      continue;
    }
    if (!knownUrls.includes(gitRemote(origin))) {
      git(target, ["remote", "set-url", "origin", project.repository]);
    }
    const remoteHead = git(target, ["ls-remote", "--symref", "origin", "HEAD"]);
    const branch = remoteHead.match(/^ref: refs\/heads\/(.+)\tHEAD$/m)?.[1];
    if (!branch) throw new Error("无法确定原仓库的默认分支，未覆盖本地内容。");
    git(target, ["check-ref-format", `refs/heads/${branch}`]);
    git(target, ["fetch", "--prune", "--no-recurse-submodules", "origin", "+refs/heads/*:refs/remotes/origin/*"]);
    const upstream = `refs/remotes/origin/${branch}`;
    git(target, ["rev-parse", "--verify", `${upstream}^{commit}`]);
    // 先成功获取远端，再丢弃本地差异；参考源码不需要子模块内容。
    git(target, ["submodule", "deinit", "--force", "--all"]);
    git(target, ["reset", "--hard", upstream]);
    git(target, ["clean", "-ffdx"]);
    git(target, ["checkout", "--force", "-B", branch, upstream]);
    git(target, ["branch", "--set-upstream-to", `origin/${branch}`, branch]);
    git(target, ["remote", "set-head", "origin", branch]);
    results.push(result(project.name, "Updated", `${branch} <- origin/${branch}（已强制对齐并清理本地差异）`));
  } catch (error) {
    results.push(result(project.name, "Failed", error instanceof Error ? error.message : String(error)));
    process.stderr.write(`警告：${results.at(-1).detail}\n`);
  }
}

process.stdout.write("\n同步结果\n");
for (const item of results) process.stdout.write(`${item.name}\t${item.status}\t${item.detail}\n`);
if (results.some((item) => item.status === "Failed")) process.exitCode = 1;
