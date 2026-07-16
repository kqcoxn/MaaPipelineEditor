#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const sources = [
  {
    file: "LocalBridge/src/mpe_localbridge/constants.py",
    pattern: /(PROTOCOL_VERSION\s*=\s*")([^"]+)(")/,
  },
  {
    file: "Editor/src/stores/configStore.ts",
    pattern: /(protocolVersion:\s*")([^"]+)(")/,
  },
  {
    file: "Desktop/src-tauri/src/models.rs",
    pattern: /(PROTOCOL_VERSION:\s*&str\s*=\s*")([^"]+)(")/,
  },
];

async function inspectSources() {
  return Promise.all(
    sources.map(async (source) => {
      const content = await readFile(path.join(ROOT, source.file), "utf8");
      return { ...source, content, version: content.match(source.pattern)?.[2] };
    }),
  );
}

async function generatedVersions() {
  const schema = JSON.parse(
    await readFile(path.join(ROOT, "LocalBridge/schema/protocol-v2.schema.json"), "utf8"),
  );
  const types = await readFile(
    path.join(ROOT, "Editor/src/services/generated/bridge-v2.ts"),
    "utf8",
  );
  return [
    { file: "LocalBridge/schema/protocol-v2.schema.json", version: schema["x-protocol-version"] },
    {
      file: "Editor/src/services/generated/bridge-v2.ts",
      version: types.match(/BRIDGE_PROTOCOL_VERSION = "([^"]+)"/)?.[1],
    },
  ];
}

async function main() {
  const args = process.argv.slice(2);
  const checkOnly = args.includes("--check");
  const yes = args.includes("--yes") || args.includes("-y");
  const entries = await inspectSources();
  const generated = await generatedVersions();
  const all = [...entries, ...generated];
  if (all.some((entry) => !SEMVER.test(entry.version ?? ""))) {
    throw new Error("存在无法识别的协议版本");
  }
  if (checkOnly) {
    all.forEach((entry) => console.log(`${entry.file}: ${entry.version}`));
    if (new Set(all.map((entry) => entry.version)).size !== 1) {
      throw new Error("协议版本或生成产物不一致");
    }
    return;
  }

  let nextVersion = args.find((arg) => !arg.startsWith("-"))?.replace(/^v/, "");
  if (!nextVersion) {
    const prompt = createInterface({ input, output });
    try {
      nextVersion = (await prompt.question("请输入目标协议版本: ")).trim().replace(/^v/, "");
    } finally {
      prompt.close();
    }
  }
  if (!SEMVER.test(nextVersion ?? "")) {
    throw new Error(`无效语义化版本: ${nextVersion}`);
  }
  entries.forEach((entry) =>
    console.log(`${entry.file}: ${entry.version} -> ${nextVersion}`),
  );
  if (!yes) {
    const prompt = createInterface({ input, output });
    try {
      const answer = (await prompt.question("确认写入并重新生成契约? (y/N): "))
        .trim()
        .toLowerCase();
      if (answer !== "y" && answer !== "yes") return;
    } finally {
      prompt.close();
    }
  }

  await Promise.all(
    entries.map((entry) =>
      writeFile(
        path.join(ROOT, entry.file),
        entry.content.replace(
          entry.pattern,
          (_match, prefix, _version, suffix) => `${prefix}${nextVersion}${suffix}`,
        ),
        "utf8",
      ),
    ),
  );
  const command = spawnSync(
    "uv",
    [
      "run",
      "--project",
      "LocalBridge",
      "python",
      "-m",
      "mpe_localbridge.schema",
      "--schema",
      "LocalBridge/schema/protocol-v2.schema.json",
      "--typescript",
      "Editor/src/services/generated/bridge-v2.ts",
    ],
    { cwd: ROOT, stdio: "inherit", shell: process.platform === "win32" },
  );
  if (command.status !== 0) {
    throw new Error("协议源已更新，但 schema/type 生成失败，请修复后重新运行 yarn localbridge:schema");
  }
  console.log(`协议版本已更新为 ${nextVersion}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
