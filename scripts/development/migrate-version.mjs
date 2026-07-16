#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

const targets = [
  textTarget(
    "Editor version",
    "Editor/src/stores/configStore.ts",
    /(version:\s*`)([^`]+)(`)/,
  ),
  textTarget(
    "Python project version",
    "LocalBridge/pyproject.toml",
    /(\[project\][\s\S]*?^version\s*=\s*")([^"]+)(")/m,
  ),
  textTarget(
    "Python package constant",
    "LocalBridge/src/mpe_localbridge/constants.py",
    /(PACKAGE_VERSION\s*=\s*")([^"]+)(")/,
  ),
  jsonTarget("Desktop package version", "Desktop/package.json", ["version"]),
  textTarget(
    "Desktop Cargo package version",
    "Desktop/src-tauri/Cargo.toml",
    /(\[package\][\s\S]*?^version\s*=\s*")([^"]+)(")/m,
  ),
  textTarget(
    "Desktop Cargo lock version",
    "Desktop/src-tauri/Cargo.lock",
    /(\[\[package\]\]\s*\r?\nname = "maa-pipeline-editor-desktop"\s*\r?\nversion = ")([^"]+)(")/,
  ),
  jsonTarget("Tauri bundle version", "Desktop/src-tauri/tauri.conf.json", ["version"]),
];

function textTarget(label, file, pattern) {
  return { label, file, kind: "text", pattern };
}

function jsonTarget(label, file, keyPath) {
  return { label, file, kind: "json", keyPath };
}

function jsonValueAt(value, keyPath) {
  return keyPath.reduce((current, key) => current?.[key], value);
}

async function inspectTarget(target) {
  const absolutePath = path.join(ROOT, target.file);
  const content = await readFile(absolutePath, "utf8");
  if (target.kind === "json") {
    const document = JSON.parse(content);
    return { target, content, version: jsonValueAt(document, target.keyPath) };
  }
  return { target, content, version: content.match(target.pattern)?.[2] };
}

function updateTarget(entry, version) {
  const { target, content } = entry;
  if (target.kind === "json") {
    const document = JSON.parse(content);
    let current = document;
    for (const key of target.keyPath.slice(0, -1)) current = current[key];
    current[target.keyPath.at(-1)] = version;
    return `${JSON.stringify(document, null, 2)}\n`;
  }
  return content.replace(
    target.pattern,
    (_match, prefix, _oldVersion, suffix) => `${prefix}${version}${suffix}`,
  );
}

async function main() {
  const args = process.argv.slice(2);
  const checkOnly = args.includes("--check");
  const yes = args.includes("--yes") || args.includes("-y");
  const requested = args.find((arg) => !arg.startsWith("-"))?.replace(/^v/, "");
  const entries = await Promise.all(targets.map(inspectTarget));
  const invalid = entries.filter((entry) => !SEMVER.test(String(entry.version ?? "")));
  if (invalid.length > 0) {
    for (const entry of invalid) {
      console.error(`无法读取 ${entry.target.label}: ${entry.target.file}`);
    }
    process.exit(1);
  }

  const versions = new Set(entries.map((entry) => entry.version));
  if (checkOnly) {
    entries.forEach((entry) =>
      console.log(`${entry.target.file}: ${entry.version}`),
    );
    if (versions.size !== 1) {
      console.error("产品版本不一致");
      process.exit(1);
    }
    console.log(`产品版本一致: ${entries[0].version}`);
    return;
  }

  let nextVersion = requested;
  if (!nextVersion) {
    const prompt = createInterface({ input, output });
    try {
      nextVersion = (await prompt.question("请输入目标版本号: ")).trim().replace(/^v/, "");
    } finally {
      prompt.close();
    }
  }
  if (!SEMVER.test(nextVersion ?? "")) {
    throw new Error(`无效语义化版本: ${nextVersion}`);
  }

  console.log("版本迁移预览:");
  entries.forEach((entry) =>
    console.log(`  ${entry.target.file}: ${entry.version} -> ${nextVersion}`),
  );
  if (!yes) {
    const prompt = createInterface({ input, output });
    try {
      const answer = (await prompt.question("确认写入? (y/N): ")).trim().toLowerCase();
      if (answer !== "y" && answer !== "yes") return;
    } finally {
      prompt.close();
    }
  }

  await Promise.all(
    entries.map((entry) =>
      writeFile(
        path.join(ROOT, entry.target.file),
        updateTarget(entry, nextVersion),
        "utf8",
      ),
    ),
  );
  console.log(`产品版本已更新为 ${nextVersion}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
