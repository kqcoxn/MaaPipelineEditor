import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { request, transfer } from "./transfer.mjs";

const RETRY_DELAYS = [5000, 15000];
const NETWORK_CODES = new Set([
  "ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "EAI_AGAIN", "ENOTFOUND", "EPIPE",
  "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_SOCKET", "UND_ERR_HEADERS_TIMEOUT", "UND_ERR_BODY_TIMEOUT",
]);

export function isTransient(error) {
  return error.name === "TimeoutError" || error.status === 429 || error.status >= 500
    || NETWORK_CODES.has(error.code) || (error.cause ? isTransient(error.cause) : false);
}

export async function withRetry(operation, { wait = sleep, log = console.log, signal } = {}) {
  for (let attempt = 0; ; attempt++) {
    signal?.throwIfAborted();
    try {
      return await operation();
    } catch (error) {
      if (signal?.aborted || attempt >= RETRY_DELAYS.length || !isTransient(error)) throw error;
      const delay = RETRY_DELAYS[attempt];
      log(`Retry ${attempt + 1}/2 in ${delay / 1000}s: ${error.message}`);
      await wait(delay, undefined, { signal });
    }
  }
}

export function selectAsset(release, plan) {
  if (release.tag_name !== plan.version) throw new Error("发行版本与请求版本不一致");
  const assets = (release.assets || []).filter(asset => asset.name.startsWith(plan.prefix) && asset.name.endsWith(".zip"));
  if (assets.length !== 1) throw new Error(`未找到唯一的平台发行包: ${plan.prefix}*.zip`);
  const asset = assets[0];
  const url = new URL(asset.browser_download_url);
  if (url.origin !== "https://github.com" || !url.pathname.startsWith("/MaaXYZ/MaaFramework/releases/download/")) {
    throw new Error("发行包下载地址不属于 MaaXYZ/MaaFramework");
  }
  return asset;
}

export async function downloadRuntime(plan, destination, { signal } = {}) {
  const api = `https://api.github.com/repos/MaaXYZ/MaaFramework/releases/tags/${encodeURIComponent(plan.version)}`;
  const headers = process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {};
  const release = await withRetry(async () => {
    const timeout = AbortSignal.timeout(30000);
    return (await request(api, { headers, signal: signal ? AbortSignal.any([signal, timeout]) : timeout })).json();
  }, { signal });
  const asset = selectAsset(release, plan);
  console.log(`Downloading ${asset.name} (${Math.round(asset.size / 1024 / 1024)} MiB)`);
  await downloadFile(asset.browser_download_url, destination, asset, { signal });
}

export async function downloadFile(url, destination, expected = {}, { signal } = {}) {
  const expectedSize = await withRetry(() => transfer(url, destination, { size: expected.size, signal }), { signal });
  const hash = createHash("sha256");
  let size = 0;
  for await (const chunk of createReadStream(destination)) {
    size += chunk.length;
    hash.update(chunk);
  }
  if (!size) throw new Error("下载文件为空");
  if (expectedSize !== undefined && size !== expectedSize) throw new Error(`下载大小不匹配: ${size} / ${expectedSize}`);
  const digest = `sha256:${hash.digest("hex")}`;
  if (expected.digest && expected.digest !== digest) throw new Error("发行包 SHA-256 校验失败");
  console.log(expected.digest ? "  Download verified (size + SHA-256)." : "  Download complete; checking archive contents.");
}
