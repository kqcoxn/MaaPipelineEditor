import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { transfer } from "./transfer.mjs";
import { installRuntime } from "./install.mjs";
import { withRetry } from "./download.mjs";

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mpe-transfer-test-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}

test("等待响应时输出连接状态，响应头超时退出", async t => {
  const root = await fixture(t);
  const logs = [];
  t.mock.method(globalThis, "fetch", (_url, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener("abort", () => reject(signal.reason), { once: true });
  }));
  await assert.rejects(transfer("https://example.test", path.join(root, "file"), {
    headerTimeoutMs: 100, progressIntervalMs: 10, log: line => logs.push(line),
  }), { name: "TimeoutError" });
  assert.ok(logs.some(line => line.includes("Connecting")));
});

test("慢速但持续传输不触发超时，并输出大小、百分比、速度", async t => {
  const root = await fixture(t);
  const logs = [];
  let chunks = 0;
  t.mock.method(globalThis, "fetch", async () => new Response(new ReadableStream({
    async pull(controller) {
      await delay(30);
      controller.enqueue(new Uint8Array(1024));
      if (++chunks === 6) controller.close();
    },
  }), { headers: { "content-length": "6144" } }));
  const file = path.join(root, "file");
  await transfer("https://example.test", file, { idleTimeoutMs: 100, progressIntervalMs: 10, log: line => logs.push(line) });
  assert.equal((await fs.stat(file)).size, 6144);
  assert.ok(logs.some(line => /MiB \(\d+%\).*KiB\/s/.test(line)));
});

test("收到响应后无数据触发停滞超时并取消流", async t => {
  const root = await fixture(t);
  let cancelled = false;
  t.mock.method(globalThis, "fetch", async () => new Response(new ReadableStream({
    cancel() { cancelled = true; },
  })));
  await assert.rejects(transfer("https://example.test", path.join(root, "file"), {
    idleTimeoutMs: 50, log: () => {},
  }), error => error.name === "TimeoutError" && /stalled/.test(error.message));
  assert.equal(cancelled, true);
});

test("取消下载不重试且释放暂存文件和安装锁", async t => {
  const root = await fixture(t);
  const controller = new AbortController();
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    setTimeout(() => controller.abort(new DOMException("Cancelled", "AbortError")), 50);
    return new Response(new ReadableStream());
  });
  await assert.rejects(installRuntime({ root }, async (_plan, destination) => {
    await withRetry(() => transfer("https://example.test", destination, { signal: controller.signal }), {
      signal: controller.signal, wait: () => assert.fail("取消不应重试"),
    });
  }, { signal: controller.signal }), { name: "AbortError" });
  assert.equal(calls, 1);
  assert.deepEqual(await fs.readdir(root), []);
});
