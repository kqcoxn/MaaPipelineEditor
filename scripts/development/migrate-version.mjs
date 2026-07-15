#!/usr/bin/env node
/**
 * MaaPipelineEditor 版本号迁移脚本 (交互式 / 精确替换)
 *
 * 用法:
 *   yarn release:migrate                 交互模式: 提示输入目标版本
 *   yarn release:migrate 1.8.0           指定目标版本 (仍需确认)
 *   yarn release:migrate 1.8.0 --yes     指定目标版本并跳过确认
 *   node scripts/development/migrate-version.mjs     等价调用
 *
 * 设计要点:
 *   - 仅替换项目自身版本号, 绝不触碰第三方依赖版本
 *   - 每处均通过"上下文锚定"精确定位, 非全局搜索替换
 *   - package.json release/retag 行采用行锚定 + 精确串替换 (行内多处 v 前缀一并处理)
 *   - 替换前强制预览, 确认后才落盘; 检测阶段任一失败则整体中止
 */

import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");

// ───────────────────────── 常量 ─────────────────────────

// 严格语义化版本: X.Y.Z, 可选预发布标识 (如 1.7.0-beta.1)
const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[\w.]+)?$/;

// 替换目标清单: 每项精确定位一个版本号出现位置
//   re       : 上下文锚定正则 (捕获组1=前缀, 2=版本号, 3=后缀), 仅匹配首个
//   lineMode : true 时改为行锚定模式 (用于 package.json 多处 v 前缀)
//   anchor   : 行锚定模式下匹配目标行的正则
const TARGETS = [
  {
    id: "configStore.ts (version)",
    file: "src/stores/configStore.ts",
    re: /(version:\s*`)([^`]+)(`)/,
  },
  {
    id: "main.go (var version)",
    file: "Extremer/main.go",
    re: /(var version = ")([^"]+)(")/,
  },
  {
    id: "wails.json (productVersion)",
    file: "Extremer/wails.json",
    re: /("productVersion":\s*")([^"]+)(")/,
  },
  {
    id: "wails.exe.manifest (assemblyIdentity version)",
    file: "Extremer/build/windows/wails.exe.manifest",
    // 多行正则: 通过 name="MaaPipelineEditor" 上下文锚定, 只匹配该元素内的 version
    re: /(name="MaaPipelineEditor"[\s\S]*?version=")([^"]+)(")/,
  },
  {
    id: "Info.plist (CFBundleVersion)",
    file: "Extremer/build/darwin/Info.plist",
    // 上下文锚定: 只匹配 CFBundleVersion 后面的版本号
    re: /(<key>CFBundleVersion<\/key>\s*<string>)([^<]+)(<\/string>)/,
  },
  {
    id: "Info.plist (CFBundleShortVersionString)",
    file: "Extremer/build/darwin/Info.plist",
    // 上下文锚定: 只匹配 CFBundleShortVersionString 后面的版本号
    re: /(<key>CFBundleShortVersionString<\/key>\s*<string>)([^<]+)(<\/string>)/,
  },
  {
    id: "package.json (release)",
    file: "package.json",
    lineMode: true,
    anchor: /^\s*"release":\s*"/,
  },
  {
    id: "package.json (retag)",
    file: "package.json",
    lineMode: true,
    anchor: /^\s*"retag":\s*"/,
  },
];

// ───────────────────────── 工具函数 ─────────────────────────

const C = {
  reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m",
  red: "\x1b[31m", green: "\x1b[32m", yellow: "\x1b[33m",
  cyan: "\x1b[36m", gray: "\x1b[90m",
};
const log = (m = "") => process.stdout.write(m + "\n");
const ok = (m) => log(`${C.green}\u2713${C.reset} ${m}`);
const warn = (m) => log(`${C.yellow}!${C.reset} ${m}`);
const err = (m) => log(`${C.red}\u2717${C.reset} ${m}`);
const info = (m) => log(`${C.cyan}i${C.reset} ${m}`);

// 读取文件 (带缓存, 同一文件只读一次)
const fileCache = new Map();
async function readText(rel) {
  if (fileCache.has(rel)) return fileCache.get(rel);
  const buf = await readFile(path.join(ROOT, rel), "utf8");
  fileCache.set(rel, buf);
  return buf;
}

// 检测单个目标中的当前版本号 (返回不带 v 前缀的纯版本)
function detectIn(content, target) {
  if (target.lineMode) {
    for (const line of content.split(/\r?\n/)) {
      if (target.anchor.test(line)) {
        const m = line.match(/v(\d+\.\d+\.\d+(?:-[\w.]+)?)/);
        return m ? m[1] : null;
      }
    }
    return null;
  }
  const m = content.match(target.re);
  return m ? m[2] : null;
}

// 生成预览 diff (不改写文件, 仅收集变更)
function planReplace(content, target, oldVer, newVer) {
  const diffs = [];
  if (target.lineMode) {
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      if (target.anchor.test(lines[i])) {
        const before = lines[i];
        const after = before.split("v" + oldVer).join("v" + newVer);
        if (before !== after) {
          diffs.push({ line: i + 1, before: before.trim(), after: after.trim() });
        }
      }
    }
    return diffs;
  }
  // 正则锚定: 仅首个匹配 (上下文已保证唯一)
  content.replace(target.re, (full, pre, _ver, suf, offset) => {
    const lineNo = content.slice(0, offset).split(/\r?\n/).length;
    diffs.push({ line: lineNo, before: full.trim(), after: (pre + newVer + suf).trim() });
    return full; // 不在此处变更, 仅供收集 diff
  });
  return diffs;
}

// 生成新文件内容 (函数式 replacement, 规避 $n 误解析)
function buildNewContent(content, target, oldVer, newVer) {
  if (target.lineMode) {
    const eol = content.includes("\r\n") ? "\r\n" : "\n";
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      if (target.anchor.test(lines[i])) {
        lines[i] = lines[i].split("v" + oldVer).join("v" + newVer);
      }
    }
    return lines.join(eol);
  }
  return content.replace(target.re, (_m, pre, _ver, suf) => pre + newVer + suf);
}

// ───────────────────────── 主流程 ─────────────────────────

async function main() {
  const argv = process.argv.slice(2);
  const yesFlag = argv.includes("--yes") || argv.includes("-y");
  const cliVersion = argv.find((a) => !a.startsWith("-"));

  log(`${C.bold}=== MaaPipelineEditor 版本号迁移 ===${C.reset}\n`);

  // 1. 检测当前版本
  info("正在检测当前版本号...");
  const detections = [];
  try {
    for (const t of TARGETS) {
      const content = await readText(t.file);
      detections.push({ target: t, version: detectIn(content, t), content });
    }
  } catch (e) {
    err(`读取文件失败: ${e.message}`);
    process.exit(1);
  }

  const failed = detections.filter((d) => !d.version);
  if (failed.length) {
    err("以下位置未能检测到版本号, 已中止 (避免遗漏):");
    for (const f of failed) err(`  - ${f.target.id}  (${f.target.file})`);
    process.exit(1);
  }

  const versions = [...new Set(detections.map((d) => d.version))];
  let currentVersion;
  if (versions.length === 1) {
    currentVersion = versions[0];
    ok(`当前版本: ${C.bold}${currentVersion}${C.reset}`);
  } else {
    warn("各位置版本号不一致:");
    for (const d of detections) log(`    ${d.target.id.padEnd(30)} ${d.version}`);
    log("");
    const counts = {};
    for (const d of detections) counts[d.version] = (counts[d.version] || 0) + 1;
    currentVersion = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
    warn(`将以 ${currentVersion} 作为基准显示; 各位置将按自身实际版本迁移`);
  }

  // 2. 获取目标版本
  let targetVersion = cliVersion;
  if (!targetVersion) {
    const rl = createInterface({ input, output });
    try {
      targetVersion = (await rl.question(`请输入目标版本号 (当前 ${currentVersion}): `)).trim();
    } finally {
      rl.close();
    }
  }
  if (!targetVersion) {
    err("未输入目标版本号, 已中止");
    process.exit(1);
  }
  // 去除可能的 v 前缀
  targetVersion = targetVersion.replace(/^v/i, "");
  if (!SEMVER_RE.test(targetVersion)) {
    err(`目标版本号格式无效: "${targetVersion}" (应为 X.Y.Z, 如 1.8.0)`);
    process.exit(1);
  }
  if (targetVersion === currentVersion) {
    warn(`目标版本与当前版本相同 (${currentVersion}), 无需迁移`);
    process.exit(0);
  }

  // 3. 生成替换计划 (每处用自身检测到的版本作为 oldVer)
  const plan = detections.map(({ target: t, version: oldVer, content }) => ({
    target: t,
    oldVer,
    content,
    diffs: planReplace(content, t, oldVer, targetVersion),
  }));
  const totalDiffs = plan.reduce((n, p) => n + p.diffs.length, 0);
  if (totalDiffs === 0) {
    err("没有任何位置需要替换, 已中止");
    process.exit(1);
  }
  for (const p of plan) {
    if (p.diffs.length === 0) warn(`未产生变更: ${p.target.id} (请检查该处版本号格式)`);
  }

  // 4. 预览
  log("");
  log(`${C.bold}---- 版本号迁移预览 ----${C.reset}`);
  log(`  ${C.gray}${currentVersion}${C.reset}  ->  ${C.green}${C.bold}${targetVersion}${C.reset}\n`);
  let idx = 0;
  const touchedFiles = new Set();
  for (const p of plan) {
    for (const d of p.diffs) {
      idx++;
      touchedFiles.add(p.target.file);
      log(`  ${C.cyan}[${idx}]${C.reset} ${C.bold}${p.target.file}${C.reset} ${C.gray}(行 ${d.line})${C.reset}  ${C.dim}${p.target.id}${C.reset}`);
      log(`  ${C.red}-${C.reset} ${d.before}`);
      log(`  ${C.green}+${C.reset} ${d.after}`);
      log("");
    }
  }
  log(`${C.dim}共 ${totalDiffs} 处位置, 涉及 ${touchedFiles.size} 个文件${C.reset}\n`);

  // 5. 确认
  if (!yesFlag) {
    const rl = createInterface({ input, output });
    let confirmed;
    try {
      const ans = (await rl.question(`确认执行以上替换? ${C.bold}(y/N)${C.reset}: `)).trim().toLowerCase();
      confirmed = ans === "y" || ans === "yes";
    } finally {
      rl.close();
    }
    if (!confirmed) {
      warn("用户取消, 未做任何修改");
      process.exit(0);
    }
  }

  // 6. 落盘 (按文件分组, 每文件只写一次; package.json 两目标累计)
  const fileNewContent = new Map();
  for (const p of plan) {
    if (p.diffs.length === 0) continue;
    const base = fileNewContent.has(p.target.file) ? fileNewContent.get(p.target.file) : p.content;
    fileNewContent.set(p.target.file, buildNewContent(base, p.target, p.oldVer, targetVersion));
  }
  try {
    for (const [rel, newContent] of fileNewContent) {
      await writeFile(path.join(ROOT, rel), newContent, "utf8");
      ok(`已更新: ${rel}`);
    }
  } catch (e) {
    err(`写入文件失败: ${e.message}`);
    err("部分文件可能已写入, 请用 git diff 检查并手动修复");
    process.exit(1);
  }

  log("");
  ok(`${C.bold}迁移完成${C.reset}: ${currentVersion} -> ${targetVersion} (${totalDiffs} 处位置)`);
  info("建议执行 git diff 复核变更后再提交");
}

main().catch((e) => {
  err(`未捕获异常: ${e?.stack || e}`);
  process.exit(1);
});
