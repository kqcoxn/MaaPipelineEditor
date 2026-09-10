import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createPlan, platformAsset, userConfigPath } from "./plan.mjs";
import { withRetry, selectAsset, downloadRuntime } from "./download.mjs";
import { createHash } from "node:crypto";
import { commitRuntime, findRuntime, installRuntime } from "./install.mjs";

const exec = promisify(execFile);
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mpe-runtime-test-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}

async function write(root, name, contents) {
  await fs.mkdir(path.dirname(path.join(root, name)), { recursive: true });
  await fs.writeFile(path.join(root, name), contents);
}

async function runtime(root, label, library = platformAsset().library) {
  await write(root, `bin/${library}`, label);
  await write(root, `bin/${library.replace("MaaFramework", "MaaAgentServer")}`, label);
  await write(root, "share/MaaAgentBinary/agent.js", label);
  await write(root, ".version", label);
}

test("解析开发配置、启动目录相对路径和失效配置的附带运行时回退", async t => {
  const root = await fixture(t);
  await write(root, "Editor/src/stores/app/configStore.ts", '  mfwVersion: "5.13.0",');
  const userConfig = path.join(root, "user.json");
  await write(root, "user.json", JSON.stringify({ maafw: { lib_dir: "deps/bin" } }));
  await fs.mkdir(path.join(root, "LocalBridge/deps/bin"), { recursive: true });
  let plan = createPlan(root, {}, userConfig);
  assert.equal(plan.libDir, path.join(root, "LocalBridge/deps/bin"));
  assert.equal(plan.version, "v5.13.0");
  await write(root, "LocalBridge/build/config/default.json", JSON.stringify({ maafw: { lib_dir: "missing/bin" } }));
  const bundled = path.join(root, "LocalBridge/build/runtime/maafw/bin");
  await fs.mkdir(bundled, { recursive: true });
  plan = createPlan(root, {}, userConfig);
  assert.equal(plan.libDir, bundled);
  assert.equal(plan.configPath, path.join(root, "LocalBridge/build/config/default.json"));
  const explicit = path.join(root, "other/bin");
  assert.equal(createPlan(root, { "lib-dir": explicit, version: "5.13.1" }, userConfig).libDir, explicit);
  assert.equal(createPlan(root, { "lib-dir": explicit, version: "5.13.1" }, userConfig).version, "v5.13.1");
  assert.throws(() => createPlan(root, { "lib-dir": root }, userConfig), /专用的 bin/);
  assert.throws(() => createPlan(root, { config: path.join(root, "absent.json") }, userConfig), /配置文件不存在/);
  await write(root, "unrelated/bin/other-tool", "keep");
  assert.throws(() => createPlan(root, { "lib-dir": path.join(root, "unrelated/bin") }, userConfig), /无法确认/);
});

test("平台包与用户配置位置覆盖 Windows、macOS 和 Linux", () => {
  assert.equal(platformAsset("win32", "arm64").prefix, "MAA-win-aarch64-");
  assert.equal(platformAsset("darwin", "x64").library, "libMaaFramework.dylib");
  assert.equal(platformAsset("linux", "arm64").prefix, "MAA-linux-aarch64-");
  assert.throws(() => platformAsset("linux", "ia32"), /不支持/);
  assert.equal(userConfigPath("linux", "/home/example", { XDG_CONFIG_HOME: "/custom" }), "/custom/MaaPipelineEditor/LocalBridge/config/config.json");
  assert.equal(userConfigPath("win32", "/home/example", { APPDATA: "/roaming" }), "/roaming/MaaPipelineEditor/LocalBridge/config/config.json");
});

test("临时网络问题最多尝试三次，等待 5 秒和 15 秒", async () => {
  let attempts = 0;
  const delays = [];
  await assert.rejects(withRetry(async () => {
    attempts++;
    throw Object.assign(new Error("connection reset"), { cause: { code: "ECONNRESET" } });
  }, { wait: async delay => delays.push(delay), log: () => {} }), /connection reset/);
  assert.equal(attempts, 3);
  assert.deepEqual(delays, [5000, 15000]);
  attempts = 0;
  const result = await withRetry(async () => {
    if (++attempts === 1) throw Object.assign(new Error("temporary"), { status: 503 });
    return "ok";
  }, { wait: async () => {}, log: () => {} });
  assert.equal(result, "ok");
  assert.equal(attempts, 2);
});

test("认证、证书和本地文件错误不重试", async () => {
  for (const props of [{ status: 401 }, { status: 403 }, { status: 404 }, { code: "CERT_HAS_EXPIRED" }, { code: "EACCES" }]) {
    let attempts = 0;
    await assert.rejects(withRetry(async () => {
      attempts++;
      throw Object.assign(new Error("permanent"), props);
    }, { wait: async () => assert.fail("不应等待"), log: () => {} }), /permanent/);
    assert.equal(attempts, 1);
  }
});

test("发行包须匹配版本、平台且来自官方仓库", () => {
  const plan = { version: "v5.13.0", prefix: "MAA-macos-aarch64-" };
  const asset = { name: "MAA-macos-aarch64-v5.13.0.zip", browser_download_url: "https://github.com/MaaXYZ/MaaFramework/releases/download/v5.13.0/MAA-macos-aarch64-v5.13.0.zip" };
  assert.equal(selectAsset({ tag_name: plan.version, assets: [asset] }, plan), asset);
  assert.throws(() => selectAsset({ tag_name: "v5.12.0", assets: [asset] }, plan), /版本/);
  assert.throws(() => selectAsset({ tag_name: plan.version, assets: [] }, plan), /唯一/);
  assert.throws(() => selectAsset({ tag_name: plan.version, assets: [{ ...asset, browser_download_url: "https://example.com/a.zip" }] }, plan), /不属于/);
});

test("下载校验大小和摘要，GitHub 令牌仅发送给 API", async t => {
  const root = await fixture(t);
  const content = Buffer.from("fake release archive");
  const plan = { version: "v5.13.0", prefix: "MAA-macos-aarch64-" };
  const url = "https://github.com/MaaXYZ/MaaFramework/releases/download/v5.13.0/runtime.zip";
  const asset = {
    name: "MAA-macos-aarch64-v5.13.0.zip", browser_download_url: url,
    size: content.length, digest: `sha256:${createHash("sha256").update(content).digest("hex")}`,
  };
  const previousToken = process.env.GITHUB_TOKEN;
  process.env.GITHUB_TOKEN = "test-token";
  t.after(() => {
    if (previousToken === undefined) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = previousToken;
  });
  let downloadAsset = asset;
  t.mock.method(globalThis, "fetch", async (requestUrl, options) => {
    if (requestUrl === url) {
      assert.equal(options.headers.Authorization, undefined);
      return new Response(content);
    }
    assert.equal(new URL(requestUrl).hostname, "api.github.com");
    assert.equal(options.headers.Authorization, "Bearer test-token");
    return Response.json({ tag_name: plan.version, assets: [downloadAsset] });
  });
  const destination = path.join(root, "download.zip");
  await downloadRuntime(plan, destination);
  assert.deepEqual(await fs.readFile(destination), content);
  downloadAsset = { ...asset, digest: `sha256:${"0".repeat(64)}` };
  await assert.rejects(downloadRuntime(plan, destination), /SHA-256 校验失败/);
  downloadAsset = { ...asset, size: content.length + 1 };
  await assert.rejects(downloadRuntime(plan, destination), /大小不匹配/);
});

test("更新同时替换库、Agent 和版本，保留 OCR 且不留下备份", async t => {
  const root = await fixture(t);
  const target = path.join(root, "target");
  const staged = path.join(root, "staged");
  await runtime(target, "old");
  await runtime(staged, "new");
  await write(target, "resource/model/ocr/model.onnx", "ocr");
  await commitRuntime(staged, target);
  assert.equal(await fs.readFile(path.join(target, ".version"), "utf8"), "new");
  assert.equal(await fs.readFile(path.join(target, "share/MaaAgentBinary/agent.js"), "utf8"), "new");
  assert.deepEqual((await fs.readdir(target)).filter(name => name.startsWith(".mpe-")), []);
  assert.equal(await fs.readFile(path.join(target, "resource/model/ocr/model.onnx"), "utf8"), "ocr");
});

test("Agent 或版本标记替换失败时恢复完整旧运行时", async t => {
  const root = await fixture(t);
  for (const failingComponent of [path.join("share", "MaaAgentBinary"), ".version"]) {
    const target = path.join(root, `target-${path.basename(failingComponent)}`);
    const staged = path.join(root, `staged-${path.basename(failingComponent)}`);
    await runtime(target, "old");
    await runtime(staged, "new");
    await assert.rejects(commitRuntime(staged, target, {
      ...fs,
      rename: async (from, to) => {
        if (from === path.join(staged, failingComponent)) throw Object.assign(new Error("模拟文件占用"), { code: "EBUSY" });
        return fs.rename(from, to);
      },
    }), /已恢复旧运行时/);
    assert.equal(await fs.readFile(path.join(target, ".version"), "utf8"), "old");
    assert.equal(await fs.readFile(path.join(target, `bin/${platformAsset().library}`), "utf8"), "old");
    assert.equal(await fs.readFile(path.join(target, "share/MaaAgentBinary/agent.js"), "utf8"), "old");
    assert.deepEqual((await fs.readdir(target)).filter(name => name.startsWith(".mpe-")), []);
  }
});

test("下载失败不改动原库并释放暂存目录和锁", async t => {
  const root = await fixture(t);
  await runtime(root, "old");
  await assert.rejects(installRuntime({ root }, async () => { throw new Error("下载失败"); }), /下载失败/);
  assert.equal(await fs.readFile(path.join(root, ".version"), "utf8"), "old");
  assert.deepEqual((await fs.readdir(root)).filter(name => name.startsWith(".mpe-")), []);
});

test("缺少 Agent 的发行包不可安装", async t => {
  const root = await fixture(t);
  await runtime(root, "new");
  await fs.rm(path.join(root, "share"), { recursive: true });
  await assert.rejects(findRuntime(root, platformAsset().library), /ENOENT/);
});

test("通过实际 ZIP 解压完成安装；旧锁阻止并发更新", async t => {
  const root = await fixture(t);
  const target = path.join(root, "target");
  const packageRoot = path.join(root, "package");
  const zip = path.join(root, "runtime.zip");
  await runtime(target, "old");
  await runtime(packageRoot, "new");
  if (process.platform === "win32") {
    await exec("powershell.exe", ["-NoProfile", "-Command", "Compress-Archive -Path ($env:MPE_TEST_SOURCE + '/*') -DestinationPath $env:MPE_TEST_ZIP"], {
      env: { ...process.env, MPE_TEST_SOURCE: packageRoot, MPE_TEST_ZIP: zip },
    });
  } else {
    await exec("zip", ["-qr", zip, "."], { cwd: packageRoot });
  }
  const plan = { root: target, version: "v5.13.0", library: platformAsset().library };
  await installRuntime(plan, async (_plan, destination) => fs.copyFile(zip, destination));
  assert.equal(await fs.readFile(path.join(target, ".version"), "utf8"), "v5.13.0\n");
  assert.deepEqual((await fs.readdir(target)).filter(name => name.startsWith(".mpe-")), []);
  await fs.mkdir(path.join(target, ".mpe-mfw-update.lock"));
  await assert.rejects(installRuntime(plan, async () => assert.fail("不应下载")), /更新锁已存在/);
});
