import assert from "node:assert/strict";
import { join, win32 } from "node:path";
import test from "node:test";

import {
  commandName,
  executableName,
  packagedExecutableDir,
  resolveRuntimeDir,
  wailsCandidates,
} from "./platform.mjs";

test("Windows 使用 exe/cmd 命令与安装器 runtime 目录", () => {
  const env = {
    LOCALAPPDATA: "C:\\Users\\dev\\AppData\\Local",
    USERPROFILE: "C:\\Users\\dev",
  };

  assert.equal(executableName("win32"), "mpelb.exe");
  assert.equal(commandName("yarn", "win32"), "yarn.cmd");
  assert.equal(
    win32.normalize(resolveRuntimeDir({ platform: "win32", env, homeDir: env.USERPROFILE })),
    "C:\\Users\\dev\\AppData\\Local\\mpelb\\runtime",
  );
  assert.equal(
    packagedExecutableDir({
      platform: "win32",
      buildBinDir: "C:\\repo\\Desktop\\build\\bin",
      appName: "MaaPipelineEditor",
    }),
    "C:\\repo\\Desktop\\build\\bin",
  );
});

test("Windows 可从 Go 默认目录定位 Wails", () => {
  const candidates = wailsCandidates({
    platform: "win32",
    env: {},
    homeDir: "C:\\Users\\dev",
  }).map(win32.normalize);

  assert.ok(candidates.includes("C:\\Users\\dev\\go\\bin\\wails.exe"));
});

test("macOS 使用 app 内可执行目录与用户 runtime", () => {
  const homeDir = "/Users/dev";
  const buildBinDir = "/repo/Desktop/build/bin";

  assert.equal(executableName("darwin"), "mpelb");
  assert.equal(commandName("yarn", "darwin"), "yarn");
  assert.equal(
    resolveRuntimeDir({ platform: "darwin", env: {}, homeDir }),
    join(homeDir, ".local", "bin", "runtime"),
  );
  assert.equal(
    packagedExecutableDir({
      platform: "darwin",
      buildBinDir,
      appName: "MaaPipelineEditor",
    }),
    join(buildBinDir, "MaaPipelineEditor.app", "Contents", "MacOS"),
  );
});

test("显式环境变量优先于平台默认值", () => {
  const env = {
    MPE_RUNTIME_DIR: "/custom/runtime",
    MPE_WAILS_BIN: "/custom/bin/wails",
  };

  assert.equal(
    resolveRuntimeDir({ platform: "darwin", env, homeDir: "/Users/dev" }),
    "/custom/runtime",
  );
  assert.equal(
    wailsCandidates({ platform: "darwin", env, homeDir: "/Users/dev" })[0],
    "/custom/bin/wails",
  );
});
