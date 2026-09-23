import { createWriteStream } from "node:fs";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

export async function request(url, { signal, headers = {} } = {}) {
  const result = await fetch(url, {
    headers: { "User-Agent": "MaaPipelineEditor-dev-runtime", ...headers }, signal,
  });
  if (!result.ok) {
    await result.body?.cancel();
    throw Object.assign(new Error(`HTTP ${result.status}: ${url}`), { status: result.status });
  }
  return result;
}

const mib = value => (value / 1024 / 1024).toFixed(1);

export async function transfer(url, destination, {
  signal, size, headerTimeoutMs = 30000, idleTimeoutMs = 30000,
  progressIntervalMs = 5000, log = console.log,
} = {}) {
  const controller = new AbortController();
  const activeSignal = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
  let watchdog;
  const deadline = (ms, message) => {
    clearTimeout(watchdog);
    watchdog = setTimeout(() => controller.abort(new DOMException(message, "TimeoutError")), ms);
  };
  let received = 0;
  let total = size;
  const started = Date.now();
  let connected = false;
  const progress = setInterval(() => {
    if (!connected) return log("  Connecting...");
    const speed = (received / 1024 / Math.max((Date.now() - started) / 1000, 0.001)).toFixed(0);
    const percent = total ? ` / ${mib(total)} MiB (${Math.min(100, received / total * 100).toFixed(0)}%)` : " MiB";
    log(`  ${mib(received)}${percent} | ${speed} KiB/s`);
  }, progressIntervalMs);
  try {
    deadline(headerTimeoutMs, "Connection timed out (no response headers)");
    const result = await request(url, { signal: activeSignal });
    connected = true;
    const length = result.headers.get("content-length");
    // fetch 自动解压 HTTP 编码，此时 Content-Length 不是解码后大小。
    total = size ?? (length && !result.headers.get("content-encoding") ? Number(length) : undefined);
    deadline(idleTimeoutMs, "Download stalled (no data received)");
    const meter = new Transform({
      transform(chunk, _encoding, callback) {
        received += chunk.length;
        deadline(idleTimeoutMs, "Download stalled (no data received)");
        callback(null, chunk);
      },
    });
    await pipeline(Readable.fromWeb(result.body), meter, createWriteStream(destination), { signal: activeSignal });
    return total;
  } catch (error) {
    if (activeSignal.aborted) throw activeSignal.reason;
    throw error;
  } finally {
    clearTimeout(watchdog);
    clearInterval(progress);
  }
}
