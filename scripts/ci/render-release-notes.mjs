import { readFileSync, writeFileSync } from "node:fs";
import vm from "node:vm";

// Release workflow entry point. Keep file paths configurable for CI artifacts.

const repoUrl = "https://github.com/kqcoxn/MaaPipelineEditor";
const categoryLabels = [
  ["features", "新功能"],
  ["perfs", "体验优化"],
  ["fixes", "问题修复"],
];
const typeLabels = {
  major: "重大更新",
  feature: "新功能",
  fix: "问题修复",
  perf: "体验优化",
};

function readArg(name, fallback = "") {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] || fallback : fallback;
}

function findArrayLiteral(source, exportName) {
  const marker = `export const ${exportName}`;
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) {
    throw new Error(`Cannot find export ${exportName}`);
  }

  const assignmentIndex = source.indexOf("=", markerIndex);
  if (assignmentIndex < 0) {
    throw new Error(`Cannot find assignment for ${exportName}`);
  }

  const start = source.indexOf("[", assignmentIndex);
  if (start < 0) {
    throw new Error(`Cannot find array literal for ${exportName}`);
  }

  let depth = 0;
  let inString = false;
  let quote = "";
  let escaped = false;

  for (let index = start; index < source.length; index += 1) {
    const char = source[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        inString = false;
      }
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      inString = true;
      quote = char;
      continue;
    }

    if (char === "[") {
      depth += 1;
    } else if (char === "]") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, index + 1);
      }
    }
  }

  throw new Error(`Cannot parse array literal for ${exportName}`);
}

function loadUpdateLogs(path) {
  const source = readFileSync(path, "utf8");
  const arrayLiteral = findArrayLiteral(source, "updateLogs");
  return vm.runInNewContext(`(${arrayLiteral})`, Object.create(null), {
    timeout: 1000,
  });
}

function normalizeVersion(version) {
  return version.trim().replace(/^v/i, "");
}

function renderReleaseNotes({ currentTag, previousTag, log }) {
  const fullChangelogUrl = previousTag
    ? `${repoUrl}/compare/${previousTag}...${currentTag}`
    : `${repoUrl}/commits/${currentTag}`;

  const lines = [
    `**Full Changelog**: ${fullChangelogUrl}`,
    "",
    "## 📝 更新内容",
    "",
    `### v${log.version} · ${log.date} · ${typeLabels[log.type] ?? log.type}`,
    "",
  ];

  let hasContent = false;
  for (const [key, label] of categoryLabels) {
    const items = log.updates?.[key];
    if (!items || items.length === 0) {
      continue;
    }

    hasContent = true;
    lines.push(`#### ${label}`, "");
    lines.push(...items.map((item) => `- ${item}`), "");
  }

  if (!hasContent) {
    throw new Error(`Version ${log.version} does not contain release notes`);
  }

  lines.push(
    "## 📦 发布说明",
    "",
    "- **Docs**（`MaaPipelineEditor-*-docs.zip`）：文档站静态资源包",
    "- **Landing**（`MaaPipelineEditor-*-landing.zip`）：展示页（主页）静态资源包",
    "- **Stable**（`MaaPipelineEditor-*-stable.zip`）：前端静态资源包，用于自部署在线编辑器",
    "- **Desktop**：Windows x64 使用 NSIS，macOS Apple Silicon 使用 DMG，Linux x64 使用 AppImage",
    "- **LocalBridge**：从 PyPI 安装 `MaaPipelineEditor-LocalBridge`，命令名为 `mpelb`",
    "- **Source code**：版本源代码",
    "",
    "支持平台：macOS Apple Silicon (darwin-arm64) · Linux x64 (linux-amd64) · Windows x64 (windows-amd64)",
    "",
    "> 💡 推荐优先使用 [在线方案](https://github.com/kqcoxn/MaaPipelineEditor?tab=readme-ov-file#%E5%BC%80%E7%AE%B1%E5%8D%B3%E7%94%A8)，无需下载即可体验，按需使用本地服务启用完整功能。Release 包适用于自部署或离线使用场景。",
    "",
  );

  return lines.join("\n");
}

const currentTag = readArg("tag", process.env.GITHUB_REF_NAME);
const previousTag = readArg("previous-tag");
const updateLogsPath = readArg("update-logs", "Editor/src/data/updateLogs.ts");
const outputPath = readArg("output", "CHANGELOG.md");

if (!currentTag) {
  throw new Error("Missing release tag");
}

const updateLogs = loadUpdateLogs(updateLogsPath);
const targetVersion = normalizeVersion(currentTag);
const log = updateLogs.find(
  (item) => normalizeVersion(item.version) === targetVersion,
);

if (!log) {
  throw new Error(
    `No hand-written update log found for ${currentTag} in ${updateLogsPath}`,
  );
}

writeFileSync(
  outputPath,
  renderReleaseNotes({ currentTag, previousTag, log }),
  "utf8",
);
