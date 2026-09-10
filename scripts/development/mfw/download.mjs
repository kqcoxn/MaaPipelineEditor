import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { setTimeout as sleep } from "node:timers/promises";

const RETRY_DELAYS = [5000, 15000];
const NETWORK_CODES = new Set([
  "ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "EAI_AGAIN", "ENOTFOUND", "EPIPE",
  "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_SOCKET", "UND_ERR_HEADERS_TIMEOUT", "UND_ERR_BODY_TIMEOUT",
]);

export function isTransient(error) {
  return error.name === "TimeoutError" || error.status === 429 || error.status >= 500
    || NETWORK_CODES.has(error.code) || (error.cause ? isTransient(error.cause) : false);
}

export async function withRetry(operation, { wait = sleep, log = console.log } = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= RETRY_DELAYS.length || !isTransient(error)) throw error;
      const delay = RETRY_DELAYS[attempt];
      log(`临时网络失败，${delay / 1000} 秒后重试 (${attempt + 1}/2): ${error.message}`);
      await wait(delay);
    }
  }
}

async function response(url, timeout, headers = {}) {
  const result = await fetch(url, {
    headers: { "User-Agent": "MaaPipelineEditor-dev-runtime", ...headers },
    signal: AbortSignal.timeout(timeout),
  });
  if (!result.ok) {
    await result.body?.cancel();
    const error = new Error(`HTTP ${result.status}: ${url}`);
    error.status = result.status;
    throw error;
  }
  return result;
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

export async function downloadRuntime(plan, destination) {
  const api = `https://api.github.com/repos/MaaXYZ/MaaFramework/releases/tags/${encodeURIComponent(plan.version)}`;
  const headers = process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {};
  const release = await withRetry(async () => (await response(api, 30000, headers)).json());
  const asset = selectAsset(release, plan);
  console.log(`下载 ${asset.name} (${Math.round(asset.size / 1024 / 1024)} MiB)`);
  await withRetry(async () => {
    const result = await response(asset.browser_download_url, 600000);
    await pipeline(result.body, createWriteStream(destination));
  });
  const hash = createHash("sha256");
  let size = 0;
  for await (const chunk of createReadStream(destination)) {
    size += chunk.length;
    hash.update(chunk);
  }
  if (size !== asset.size) throw new Error(`下载大小不匹配: ${size} / ${asset.size}`);
  const digest = `sha256:${hash.digest("hex")}`;
  if (asset.digest && asset.digest !== digest) throw new Error("发行包 SHA-256 校验失败");
  console.log(asset.digest ? "发行包大小与 SHA-256 校验通过" : "发行包大小校验通过（上游未提供 SHA-256）");
}
