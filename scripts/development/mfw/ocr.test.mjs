import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { platformAsset } from "./plan.mjs";
import { downloadOCR, findOCR, OCR_COMPONENT, OCR_URL } from "./ocr.mjs";
import { commitComponents, installRuntime, MFW_COMPONENTS } from "./install.mjs";

const exec = promisify(execFile);
const library = platformAsset().library;
const components = [...MFW_COMPONENTS.map(name => path.join("maafw", name)), OCR_COMPONENT];

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mpe-ocr-test-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}

async function write(root, name, content) {
  const file = path.join(root, name);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, content);
}

async function runtime(root, label) {
  await write(root, `maafw/bin/${library}`, label);
  await write(root, `maafw/bin/${library.replace("MaaFramework", "MaaAgentServer")}`, label);
  await write(root, "maafw/share/MaaAgentBinary/agent.js", label);
  await write(root, "maafw/.version", label);
  for (const name of ["det.onnx", "rec.onnx", "keys.txt"]) await write(root, path.join(OCR_COMPONENT, name), label);
}

async function zip(source, destination) {
  if (process.platform === "win32") {
    await exec("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command",
      "$ErrorActionPreference = 'Stop'; Compress-Archive -Path ($env:MPE_TEST_SOURCE + '/*') -DestinationPath $env:MPE_TEST_ZIP"], {
      env: { ...process.env, MPE_TEST_SOURCE: source, MPE_TEST_ZIP: destination },
    });
  } else {
    await exec("zip", ["-qr", destination, "."], { cwd: source });
  }
}

test("OCR 下载使用发布模型地址并拒绝空包和截断内容", async t => {
  const root = await fixture(t);
  let content = "model-archive";
  let length = content.length;
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, OCR_URL);
    assert.equal(options.headers.Authorization, undefined);
    return new Response(content, { headers: { "content-length": String(length) } });
  });
  const archive = path.join(root, "ocr.zip");
  await downloadOCR(archive);
  assert.equal(await fs.readFile(archive, "utf8"), content);
  length++;
  await assert.rejects(downloadOCR(archive), /大小不匹配/);
  content = "";
  length = 0;
  await assert.rejects(downloadOCR(archive), /为空/);
});

test("OCR 模型目录必须唯一，三个文件均须存在且非空", async t => {
  const root = await fixture(t);
  const model = path.join(root, "nested/small");
  for (const name of ["det.onnx", "rec.onnx", "keys.txt"]) await write(model, name, "model");
  assert.equal(await findOCR(root), model);
  await fs.rm(path.join(model, "rec.onnx"));
  await assert.rejects(findOCR(root), /缺少 rec.onnx/);
  await write(model, "rec.onnx", "");
  await assert.rejects(findOCR(root), /非空文件/);
  await write(root, "second/det.onnx", "model");
  await assert.rejects(findOCR(root), /唯一/);
});

test("OCR 替换失败恢复已替换的 MFW、Agent、版本与旧 OCR", async t => {
  const root = await fixture(t);
  const target = path.join(root, "target");
  const staged = path.join(root, "staged");
  await runtime(target, "old");
  await runtime(staged, "new");
  await assert.rejects(commitComponents(staged, target, components, {
    ...fs,
    rename: async (from, to) => {
      if (from === path.join(staged, OCR_COMPONENT)) throw Object.assign(new Error("OCR 被占用"), { code: "EBUSY" });
      return fs.rename(from, to);
    },
  }), /已恢复旧运行时/);
  for (const name of [`maafw/bin/${library}`, "maafw/.version", "maafw/share/MaaAgentBinary/agent.js", `${OCR_COMPONENT}/rec.onnx`]) {
    assert.equal(await fs.readFile(path.join(target, name), "utf8"), "old");
  }
  assert.deepEqual((await fs.readdir(target)).filter(name => name.startsWith(".mpe-")), []);
});

test("实际 ZIP 全量安装支持空目录，下载或校验 OCR 失败不更改旧依赖", async t => {
  const root = await fixture(t);
  const source = path.join(root, "source");
  await runtime(source, "new");
  const mfwZip = path.join(root, "mfw.zip");
  const ocrZip = path.join(root, "ocr.zip");
  const badZip = path.join(root, "bad.zip");
  await zip(path.join(source, "maafw"), mfwZip);
  await zip(path.join(source, "resource"), ocrZip);
  await write(root, "bad/det.onnx", "missing rec and keys");
  await zip(path.join(root, "bad"), badZip);
  const copyMFW = async (_plan, destination) => fs.copyFile(mfwZip, destination);

  for (const existing of [false, true]) {
    const target = path.join(root, existing ? "existing" : "fresh", "runtime");
    if (existing) await runtime(target, "old");
    await write(target, "config/keep.json", "keep");
    const plan = { root: path.join(target, "maafw"), library, version: "v5.13.0" };
    if (existing) {
      for (const downloadOCR of [async () => { throw new Error("OCR 下载失败"); }, async dest => fs.copyFile(badZip, dest)]) {
        await assert.rejects(installRuntime(plan, copyMFW, { downloadOCR }), /OCR/);
        assert.equal(await fs.readFile(path.join(plan.root, ".version"), "utf8"), "old");
        assert.equal(await fs.readFile(path.join(target, OCR_COMPONENT, "rec.onnx"), "utf8"), "old");
        assert.deepEqual((await fs.readdir(plan.root)).filter(name => name.startsWith(".mpe-")), []);
      }
    }
    await installRuntime(plan, copyMFW, { downloadOCR: async dest => fs.copyFile(ocrZip, dest) });
    assert.equal(await fs.readFile(path.join(plan.root, ".version"), "utf8"), "v5.13.0\n");
    assert.equal(await fs.readFile(path.join(plan.root, "share/MaaAgentBinary/agent.js"), "utf8"), "new");
    assert.equal(await fs.readFile(path.join(target, OCR_COMPONENT, "rec.onnx"), "utf8"), "new");
    assert.equal(await fs.readFile(path.join(target, "config/keep.json"), "utf8"), "keep");
    for (const dir of [target, plan.root]) assert.deepEqual((await fs.readdir(dir)).filter(name => name.startsWith(".mpe-")), []);
    await fs.mkdir(path.join(plan.root, ".mpe-mfw-update.lock"));
    await assert.rejects(installRuntime(plan, () => assert.fail("不应下载"), { downloadOCR }), /更新锁已存在/);
  }
});

test("完整安装 dry-run 显示版本与 OCR 路径且不写入目标", async t => {
  const root = await fixture(t);
  const target = path.join(root, "not-created");
  const script = fileURLToPath(new URL("../update-lb-deps.mjs", import.meta.url));
  const { stdout } = await exec(process.execPath, [script, "--dry-run", "--binary-dir", target, "--version", "5.13.1"]);
  assert.match(stdout, /v5.13.1/);
  assert.ok(stdout.includes(path.join(target, "runtime", OCR_COMPONENT)));
  assert.match(stdout, /ppocr_v6-small/);
  await assert.rejects(fs.stat(target), { code: "ENOENT" });
});
