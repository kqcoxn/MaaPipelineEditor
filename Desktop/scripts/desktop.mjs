import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

import {
  commandName,
  executableName,
  packagedExecutableDir,
  resolveRuntimeDir,
  wailsCandidates,
} from "./platform.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const desktopDir = resolve(scriptDir, "..");
const repositoryDir = resolve(desktopDir, "..");
const editorDir = join(repositoryDir, "Editor");
const localBridgeDir = join(repositoryDir, "LocalBridge");
const buildBinDir = join(desktopDir, "build", "bin");
const command = process.argv[2];
const platform = process.platform;
const homeDir = homedir();

const bridgeExecutableName = executableName(platform);
const yarnCommand = commandName("yarn", platform);
const wailsCommand =
  wailsCandidates({ platform, env: process.env, homeDir }).find(existsSync) ??
  (platform === "win32" ? "wails.exe" : "wails");

function run(program, args, cwd) {
  const result = spawnSync(program, args, {
    cwd,
    env: process.env,
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`${program} 执行失败，退出码: ${result.status}`);
  }
}

function findGitkeepFiles(root, directory = root) {
  if (!existsSync(directory)) {
    return [];
  }

  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      return findGitkeepFiles(root, entryPath);
    }
    return entry.name === ".gitkeep" ? [relative(root, entryPath)] : [];
  });
}

function replaceDirectory(source, destination) {
  const gitkeepFiles = findGitkeepFiles(destination);
  rmSync(destination, { force: true, recursive: true });
  mkdirSync(dirname(destination), { recursive: true });
  cpSync(source, destination, { recursive: true });

  for (const gitkeepFile of gitkeepFiles) {
    const target = join(destination, gitkeepFile);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, "");
  }
}

function buildEditor() {
  run(yarnCommand, ["build", "--mode", "desktop"], editorDir);
  replaceDirectory(join(editorDir, "dist"), join(desktopDir, "frontend", "dist"));
}

function prepareNativeResources(targetDir) {
  const resourcesDir = join(targetDir, "resources");
  const configDir = join(targetDir, "config");
  const bridgePath = join(resourcesDir, bridgeExecutableName);

  mkdirSync(resourcesDir, { recursive: true });
  mkdirSync(configDir, { recursive: true });
  run("go", ["build", "-o", bridgePath, "./cmd/lb"], localBridgeDir);
  cpSync(join(desktopDir, "config", "default.json"), join(configDir, "default.json"));

  const runtimeDir = resolveRuntimeDir({ platform, env: process.env, homeDir });
  const maafwDir = join(runtimeDir, "maafw", "bin");
  const resourceDir = join(runtimeDir, "resource");

  if (!existsSync(maafwDir) || !existsSync(resourceDir)) {
    console.warn(
      `未找到完整运行时: ${runtimeDir}\n` +
        "桌面端仍可构建，但设备连接、原生 OCR 和流程调试不可用。可设置 MPE_RUNTIME_DIR 指向 runtime 目录。",
    );
    return;
  }

  replaceDirectory(maafwDir, join(resourcesDir, "maafw", "bin"));
  replaceDirectory(resourceDir, join(resourcesDir, "resource"));
}

function prepareDevelopment() {
  buildEditor();
  prepareNativeResources(buildBinDir);
}

function buildDesktop() {
  buildEditor();
  run(wailsCommand, ["build"], desktopDir);
  prepareNativeResources(
    packagedExecutableDir({
      platform,
      buildBinDir,
      appName: "MaaPipelineEditor",
    }),
  );
}

switch (command) {
  case "doctor":
    run(wailsCommand, ["doctor"], desktopDir);
    break;
  case "prepare":
    prepareDevelopment();
    break;
  case "dev":
    prepareDevelopment();
    run(wailsCommand, ["dev"], desktopDir);
    break;
  case "build":
    buildDesktop();
    break;
  default:
    console.error("用法: node scripts/desktop.mjs <doctor|prepare|dev|build>");
    process.exitCode = 1;
}
