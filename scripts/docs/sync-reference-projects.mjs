#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync } from "node:fs";
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

function git(target, gitArgs, { allowFailure = false } = {}) {
  const result = spawnSync("git", ["-C", target, ...gitArgs], { encoding: "utf8" });
  if (result.error) throw new Error(`无法启动 git：${result.error.message}`);
  if (result.status !== 0 && !allowFailure) {
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

mkdirSync(referenceRoot, { recursive: true });
const results = [];
for (const project of manifest.projects) {
  const target = path.resolve(referenceRoot, project.directory);
  process.stdout.write(`\n[${project.name}] ${target}\n`);
  try {
    if (target !== referenceRoot && !target.startsWith(`${referenceRoot}${path.sep}`)) {
      throw new Error(`目标目录位于参考仓库根目录之外：${target}`);
    }
    if (!existsSync(target)) {
      if (whatIf) results.push(result(project.name, "Preview", `将克隆 ${project.repository}`));
      else {
        const clone = spawnSync("git", ["clone", project.repository, target], { encoding: "utf8", stdio: "inherit" });
        if (clone.status !== 0) throw new Error(`git clone 失败（退出码 ${clone.status}）`);
        results.push(result(project.name, "Cloned", project.repository));
      }
      continue;
    }
    if (!existsSync(path.join(target, ".git"))) throw new Error("目标目录存在但不是 Git 仓库。");
    const origin = git(target, ["remote", "get-url", "origin"]);
    const knownUrls = [project.repository, ...(project.repositoryAliases || [])].map(gitRemote);
    if (!knownUrls.includes(gitRemote(origin))) process.stdout.write(`警告：保留未登记的 origin：${origin}\n`);
    const dirty = git(target, ["status", "--porcelain"]);
    const branch = git(target, ["branch", "--show-current"]);
    const upstream = git(target, ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"], { allowFailure: true });
    if (dirty || !branch || !upstream) {
      const detail = dirty ? "存在本地修改，跳过合并" : !branch ? "detached HEAD，跳过合并" : "当前分支没有 upstream，跳过合并";
      if (!whatIf) git(target, ["fetch", "--prune", "origin"]);
      results.push(result(project.name, whatIf ? "Preview" : "Fetched", detail));
      continue;
    }
    if (whatIf) results.push(result(project.name, "Preview", `将快进 ${branch} <- ${upstream}`));
    else {
      git(target, ["pull", "--ff-only"]);
      results.push(result(project.name, "Updated", `${branch} <- ${upstream}`));
    }
  } catch (error) {
    results.push(result(project.name, "Failed", error instanceof Error ? error.message : String(error)));
    process.stderr.write(`警告：${results.at(-1).detail}\n`);
  }
}

process.stdout.write("\n同步结果\n");
for (const item of results) process.stdout.write(`${item.name}\t${item.status}\t${item.detail}\n`);
if (results.some((item) => item.status === "Failed")) process.exitCode = 1;
