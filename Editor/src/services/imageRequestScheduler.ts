export interface ImageRequestBatch {
  requestId: string;
  paths: string[];
}

interface ActiveBatch extends ImageRequestBatch {
  timeoutId: ReturnType<typeof setTimeout> | null;
}

export interface ImageRequestSchedulerOptions {
  isCached: (path: string) => boolean;
  setPending: (paths: string[], pending: boolean) => void;
  sendBatch: (batch: ImageRequestBatch) => boolean;
  batchSize?: number;
  maxConcurrentBatches?: number;
  batchDelayMs?: number;
  requestTimeoutMs?: number;
  retryDelayMs?: number;
  maxRetries?: number;
}

const DEFAULT_BATCH_SIZE = 20;
const DEFAULT_MAX_CONCURRENT_BATCHES = 2;
const DEFAULT_BATCH_DELAY_MS = 50;
const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;
const DEFAULT_RETRY_DELAY_MS = 500;
const DEFAULT_MAX_RETRIES = 1;

export class ImageRequestScheduler {
  private readonly queuedPaths = new Set<string>();
  private readonly activeBatches = new Map<string, ActiveBatch>();
  private readonly activeRequestByPath = new Map<string, string>();
  private readonly retryCountByPath = new Map<string, number>();
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private requestSequence = 0;

  constructor(private readonly options: ImageRequestSchedulerOptions) {}

  request(paths: string[]): boolean {
    const nextPaths: string[] = [];

    for (const path of new Set(paths)) {
      if (
        !path ||
        this.options.isCached(path) ||
        this.queuedPaths.has(path) ||
        this.activeRequestByPath.has(path)
      ) {
        continue;
      }
      this.queuedPaths.add(path);
      nextPaths.push(path);
    }

    if (nextPaths.length === 0) return true;

    this.options.setPending(nextPaths, true);
    this.scheduleFlush(this.options.batchDelayMs ?? DEFAULT_BATCH_DELAY_MS);
    return true;
  }

  hasActiveBatch(requestId: string): boolean {
    return this.activeBatches.has(requestId);
  }

  getActiveBatchPaths(requestId: string): readonly string[] | undefined {
    return this.activeBatches.get(requestId)?.paths;
  }

  complete(requestId: string): void {
    const batch = this.takeBatch(requestId);
    if (!batch) return;

    for (const path of batch.paths) {
      this.retryCountByPath.delete(path);
    }
    this.flush();
  }

  /** 服务端主动推送结果时，从排队或活动批次中结束对应路径。 */
  resolvePaths(paths: string[]): void {
    const completedPaths: string[] = [];

    for (const path of new Set(paths)) {
      if (!path) continue;
      this.queuedPaths.delete(path);
      this.retryCountByPath.delete(path);

      const requestId = this.activeRequestByPath.get(path);
      if (requestId) {
        const batch = this.activeBatches.get(requestId);
        if (batch) {
          batch.paths = batch.paths.filter((batchPath) => batchPath !== path);
          if (batch.paths.length === 0) {
            if (batch.timeoutId) clearTimeout(batch.timeoutId);
            this.activeBatches.delete(requestId);
          }
        }
        this.activeRequestByPath.delete(path);
      }
      completedPaths.push(path);
    }

    if (completedPaths.length > 0) {
      this.options.setPending(completedPaths, false);
    }
    if (this.queuedPaths.size === 0 && this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    this.flush();
  }

  clear(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    const pendingPaths = new Set(this.queuedPaths);
    for (const batch of this.activeBatches.values()) {
      if (batch.timeoutId) clearTimeout(batch.timeoutId);
      batch.paths.forEach((path) => pendingPaths.add(path));
    }

    this.queuedPaths.clear();
    this.activeBatches.clear();
    this.activeRequestByPath.clear();
    this.retryCountByPath.clear();

    if (pendingPaths.size > 0) {
      this.options.setPending([...pendingPaths], false);
    }
  }

  private scheduleFlush(delayMs: number): void {
    if (this.flushTimer || this.queuedPaths.size === 0) return;

    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flush();
    }, delayMs);
  }

  private flush(): void {
    const maxConcurrentBatches =
      this.options.maxConcurrentBatches ?? DEFAULT_MAX_CONCURRENT_BATCHES;

    while (
      this.activeBatches.size < maxConcurrentBatches &&
      this.queuedPaths.size > 0
    ) {
      this.dispatchNextBatch();
    }
  }

  private dispatchNextBatch(): void {
    const batchSize = this.options.batchSize ?? DEFAULT_BATCH_SIZE;
    const paths = [...this.queuedPaths].slice(0, batchSize);
    paths.forEach((path) => this.queuedPaths.delete(path));

    const requestId = `image-batch-${Date.now()}-${this.requestSequence++}`;
    const batch: ActiveBatch = { requestId, paths, timeoutId: null };
    this.activeBatches.set(requestId, batch);
    paths.forEach((path) => this.activeRequestByPath.set(path, requestId));

    if (!this.options.sendBatch(batch)) {
      this.retryBatch(requestId);
      return;
    }

    batch.timeoutId = setTimeout(() => {
      this.retryBatch(requestId);
    }, this.options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS);
  }

  private retryBatch(requestId: string): void {
    const batch = this.takeBatch(requestId);
    if (!batch) return;

    const retryPaths: string[] = [];
    const failedPaths: string[] = [];
    const maxRetries = this.options.maxRetries ?? DEFAULT_MAX_RETRIES;

    for (const path of batch.paths) {
      const retryCount = this.retryCountByPath.get(path) ?? 0;
      if (retryCount < maxRetries) {
        this.retryCountByPath.set(path, retryCount + 1);
        this.queuedPaths.add(path);
        retryPaths.push(path);
      } else {
        this.retryCountByPath.delete(path);
        failedPaths.push(path);
      }
    }

    if (failedPaths.length > 0) {
      this.options.setPending(failedPaths, false);
    }

    if (retryPaths.length > 0) {
      this.scheduleFlush(this.options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS);
    } else {
      this.flush();
    }
  }

  private takeBatch(requestId: string): ActiveBatch | undefined {
    const batch = this.activeBatches.get(requestId);
    if (!batch) return undefined;

    if (batch.timeoutId) clearTimeout(batch.timeoutId);
    this.activeBatches.delete(requestId);
    batch.paths.forEach((path) => this.activeRequestByPath.delete(path));
    return batch;
  }
}
