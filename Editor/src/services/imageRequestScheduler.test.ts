import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ImageRequestScheduler,
  type ImageRequestBatch,
} from "./imageRequestScheduler";

function createScheduler(
  sendBatch: (batch: ImageRequestBatch) => boolean,
  overrides: Partial<ConstructorParameters<typeof ImageRequestScheduler>[0]> = {},
) {
  const pendingChanges: Array<{ paths: string[]; pending: boolean }> = [];
  const scheduler = new ImageRequestScheduler({
    isCached: () => false,
    setPending: (paths, pending) =>
      pendingChanges.push({ paths, pending }),
    sendBatch,
    batchDelayMs: 10,
    requestTimeoutMs: 1_000,
    retryDelayMs: 20,
    ...overrides,
  });
  return { scheduler, pendingChanges };
}

describe("ImageRequestScheduler", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("合并同一路径并用单个批次发送", async () => {
    vi.useFakeTimers();
    const batches: ImageRequestBatch[] = [];
    const { scheduler, pendingChanges } = createScheduler((batch) => {
      batches.push(batch);
      return true;
    });

    scheduler.request(["a.png", "a.png", "b.png"]);
    scheduler.request(["a.png", "c.png"]);
    await vi.advanceTimersByTimeAsync(10);

    expect(batches).toHaveLength(1);
    expect(batches[0].paths).toEqual(["a.png", "b.png", "c.png"]);
    expect(pendingChanges).toEqual([
      { paths: ["a.png", "b.png"], pending: true },
      { paths: ["c.png"], pending: true },
    ]);
  });

  it("限制并发批次数并在响应后继续排队请求", async () => {
    vi.useFakeTimers();
    const batches: ImageRequestBatch[] = [];
    const { scheduler } = createScheduler(
      (batch) => {
        batches.push(batch);
        return true;
      },
      { batchSize: 2, maxConcurrentBatches: 2 },
    );

    scheduler.request(["a", "b", "c", "d", "e"]);
    await vi.advanceTimersByTimeAsync(10);

    expect(batches.map((batch) => batch.paths)).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);

    scheduler.complete(batches[0].requestId);
    expect(batches[2].paths).toEqual(["e"]);
  });

  it("发送失败时重试一次并在耗尽后清除 pending", async () => {
    vi.useFakeTimers();
    const batches: ImageRequestBatch[] = [];
    const { scheduler, pendingChanges } = createScheduler(
      (batch) => {
        batches.push(batch);
        return false;
      },
      { maxRetries: 1 },
    );

    scheduler.request(["retry.png"]);
    await vi.advanceTimersByTimeAsync(10);
    await vi.advanceTimersByTimeAsync(20);

    expect(batches).toHaveLength(2);
    expect(batches.every((batch) => batch.paths[0] === "retry.png")).toBe(true);
    expect(pendingChanges.at(-1)).toEqual({
      paths: ["retry.png"],
      pending: false,
    });
  });

  it("清理时取消队列和活动批次", async () => {
    vi.useFakeTimers();
    const batches: ImageRequestBatch[] = [];
    const { scheduler, pendingChanges } = createScheduler((batch) => {
      batches.push(batch);
      return true;
    });

    scheduler.request(["active.png"]);
    await vi.advanceTimersByTimeAsync(10);
    scheduler.request(["queued.png"]);
    scheduler.clear();
    await vi.runAllTimersAsync();

    expect(batches).toHaveLength(1);
    expect(pendingChanges.at(-1)).toEqual({
      paths: ["queued.png", "active.png"],
      pending: false,
    });
  });

  it("服务端主动更新图片时结束该路径的旧请求", async () => {
    vi.useFakeTimers();
    const batches: ImageRequestBatch[] = [];
    const { scheduler, pendingChanges } = createScheduler((batch) => {
      batches.push(batch);
      return true;
    });

    scheduler.request(["changed.png", "other.png"]);
    await vi.advanceTimersByTimeAsync(10);
    scheduler.resolvePaths(["changed.png"]);

    expect(scheduler.getActiveBatchPaths(batches[0].requestId)).toEqual([
      "other.png",
    ]);
    expect(pendingChanges.at(-1)).toEqual({
      paths: ["changed.png"],
      pending: false,
    });
  });
});
