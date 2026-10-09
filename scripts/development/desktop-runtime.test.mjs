import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, access, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { withDesktopRuntime } from "./desktop-runtime.mjs";

async function fixture(t, version) {
  const root = await mkdtemp(path.join(os.tmpdir(), "mpe-runtime-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const runtime = path.join(root, "runtime");
  if (version) {
    await mkdir(path.join(runtime, "maafw"), { recursive: true });
    await writeFile(path.join(runtime, "maafw/.version"), version);
  }
  return { root, runtime, version: "5.14.2", explicit: false };
}

test("匹配版本复用全局 runtime，不下载", async t => {
  const options = await fixture(t, "v5.14.2\n");
  const result = await withDesktopRuntime(options, runtime => runtime, () => assert.fail("不应下载"));
  assert.equal(result, options.runtime);
});

for (const version of [undefined, "v5.13.0"]) {
  test(`运行时 ${version ?? "缺失"} 在临时目录准备，失败后清理并保留原环境`, async t => {
    const options = await fixture(t, version);
    let staged;
    await assert.rejects(withDesktopRuntime(options, async runtime => {
      assert.equal(await readFile(path.join(runtime, "marker"), "utf8"), "downloaded");
      throw new Error("安装失败");
    }, async directory => {
      staged = directory;
      assert.notEqual(directory, options.root);
      await mkdir(path.join(directory, "runtime"));
      await writeFile(path.join(directory, "runtime/marker"), "downloaded");
    }), /安装失败/);
    await assert.rejects(access(staged), { code: "ENOENT" });
    if (version) assert.equal(await readFile(path.join(options.runtime, "maafw/.version"), "utf8"), version);
    else await assert.rejects(access(options.runtime), { code: "ENOENT" });
  });
}

test("显式目录不匹配时拒绝修改", async t => {
  const options = await fixture(t, "5.13.0");
  await assert.rejects(withDesktopRuntime({ ...options, explicit: true },
    () => assert.fail("不应安装"), () => assert.fail("不应下载")), /指定 runtime/);
});

test("下载失败不执行安装并清理临时目录", async t => {
  const options = await fixture(t);
  let staged;
  await assert.rejects(withDesktopRuntime(options, () => assert.fail("不应安装"), directory => {
    staged = directory;
    throw new Error("下载失败");
  }), /下载失败/);
  await assert.rejects(access(staged), { code: "ENOENT" });
});
