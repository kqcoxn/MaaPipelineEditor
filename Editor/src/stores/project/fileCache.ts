import { normalizeViewport } from "@/stores/flow/utils/viewportUtils";
import type { FileType } from "./fileStore";

const CACHE_PREFIX = "_mpe_file:";
const MANIFEST_KEY = "_mpe_files_manifest";
const LEGACY_KEY = "_mpe_files";
const DATABASE_NAME = "mpe-file-cache";
const DATABASE_VERSION = 1;
const FILE_STORE_NAME = "files";
const META_STORE_NAME = "meta";
const MANIFEST_ID = "manifest";
const CACHE_VERSION = 1;
const CACHE_SCHEDULE_DELAY_MS = 250;
const IDLE_TIMEOUT_MS = 1000;

type FileCacheManifest = {
  version: number;
  order: string[];
  currentFileName?: string;
  updatedAt: number;
};

type PendingWrite = { fileName: string; value: FileType };

let knownFiles = new Map<string, FileType>();
let pendingWrites = new Map<string, PendingWrite>();
let pendingDeletes = new Set<string>();
let scheduledTimer: ReturnType<typeof setTimeout> | null = null;
let idleHandle: number | null = null;
let latestManifest: FileCacheManifest | null = null;
let isManifestDirty = false;
let lastManifestTimestamp = 0;
let dbPromise: Promise<IDBDatabase | null> | null = null;
let errorHandler: ((error: unknown) => void) | null = null;

function getStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function serializeFileForCache(file: FileType): FileType {
  return {
    ...file,
    nodes: file.nodes,
    edges: file.edges,
    config: {
      ...file.config,
      nodeOrderMap: undefined,
      nextOrderNumber: undefined,
      savedViewport: normalizeViewport(file.config.savedViewport),
    },
  };
}

function cacheKey(fileName: string): string {
  return `${CACHE_PREFIX}${encodeURIComponent(fileName)}`;
}

function readManifest(): FileCacheManifest | null {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(MANIFEST_KEY);
    if (!raw) return null;
    const manifest = JSON.parse(raw) as FileCacheManifest;
    if (manifest.version !== CACHE_VERSION || !Array.isArray(manifest.order)) {
      return null;
    }
    return manifest;
  } catch {
    return null;
  }
}

export type FileCacheSnapshot = {
  files: FileType[];
  currentFileName?: string;
  source: "indexeddb" | "local";
  updatedAt: number;
};

function readLocalCachedFiles(): FileCacheSnapshot | null {
  const storage = getStorage();
  if (!storage) return null;
  const manifest = readManifest();
  if (manifest) {
    try {
      const records = manifest.order.map((fileName) => {
        const raw = storage.getItem(cacheKey(fileName));
        return raw ? (JSON.parse(raw) as FileType) : null;
      });
      if (records.some((file) => !file)) throw new Error("缓存记录不完整");
      const files = records.filter((file): file is FileType => Boolean(file));
      if (files.length > 0) {
        return {
          files,
          currentFileName: manifest.currentFileName,
          source: "local",
          updatedAt: manifest.updatedAt ?? 0,
        };
      }
    } catch {
      // Fall through to the legacy single-record cache.
    }
  }
  try {
    const legacy = storage.getItem(LEGACY_KEY);
    if (!legacy) return null;
    const files = JSON.parse(legacy) as FileType[];
    return files.length > 0
      ? {
          files,
          currentFileName: files[0].fileName,
          source: "local",
          updatedAt: 0,
        }
      : null;
  } catch {
    return null;
  }
}

function writeLocalCache(
  writes: PendingWrite[],
  deletes: string[],
  manifest: FileCacheManifest,
): void {
  const storage = getStorage();
  if (!storage) throw new Error("localStorage unavailable");
  for (const write of writes) {
    storage.setItem(cacheKey(write.fileName), JSON.stringify(write.value));
  }
  for (const fileName of deletes) storage.removeItem(cacheKey(fileName));
  storage.setItem(MANIFEST_KEY, JSON.stringify(manifest));
}

function openDatabase(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  dbPromise = new Promise((resolve) => {
    try {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(FILE_STORE_NAME)) {
          db.createObjectStore(FILE_STORE_NAME, { keyPath: "fileName" });
        }
        if (!db.objectStoreNames.contains(META_STORE_NAME)) {
          db.createObjectStore(META_STORE_NAME, { keyPath: "id" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        dbPromise = null;
        resolve(null);
      };
      request.onblocked = () => {
        dbPromise = null;
        resolve(null);
      };
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

async function writeIndexedDb(
  writes: PendingWrite[],
  deletes: string[],
  manifest: FileCacheManifest,
): Promise<boolean> {
  const db = await openDatabase();
  if (!db) return false;
  return new Promise<boolean>((resolve) => {
    try {
      const transaction = db.transaction([FILE_STORE_NAME, META_STORE_NAME], "readwrite");
      const fileStore = transaction.objectStore(FILE_STORE_NAME);
      for (const write of writes) {
        fileStore.put({ fileName: write.fileName, value: write.value });
      }
      for (const fileName of deletes) fileStore.delete(fileName);
      transaction.objectStore(META_STORE_NAME).put({ id: MANIFEST_ID, value: manifest });
      transaction.oncomplete = () => resolve(true);
      transaction.onerror = () => resolve(false);
      transaction.onabort = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readIndexedDb(): Promise<FileCacheSnapshot | null> {
  const db = await openDatabase();
  if (!db) return null;
  try {
    const metaTransaction = db.transaction(META_STORE_NAME, "readonly");
    const manifestRecord = await requestResult<
      { id: string; value: FileCacheManifest } | undefined
    >(metaTransaction.objectStore(META_STORE_NAME).get(MANIFEST_ID));
    const manifest = manifestRecord?.value;
    if (!manifest || manifest.version !== CACHE_VERSION) return null;
    const fileTransaction = db.transaction(FILE_STORE_NAME, "readonly");
    const fileStore = fileTransaction.objectStore(FILE_STORE_NAME);
    const records = await Promise.all(
      manifest.order.map((fileName) =>
        requestResult<{ fileName: string; value: FileType } | undefined>(
          fileStore.get(fileName),
        ),
      ),
    );
    if (records.some((record) => !record)) return null;
    const files = records
      .map((record) => record?.value)
      .filter((file): file is FileType => Boolean(file));
    return files.length > 0
      ? {
          files,
          currentFileName: manifest.currentFileName,
          source: "indexeddb",
          updatedAt: manifest.updatedAt ?? 0,
        }
      : null;
  } catch {
    return null;
  }
}

export async function readCachedFiles(): Promise<FileCacheSnapshot | null> {
  const indexedDbSnapshot = await readIndexedDb();
  const localSnapshot = readLocalCachedFiles();
  if (!indexedDbSnapshot) return localSnapshot;
  if (!localSnapshot) return indexedDbSnapshot;
  return localSnapshot.updatedAt > indexedDbSnapshot.updatedAt
    ? localSnapshot
    : indexedDbSnapshot;
}

export function primeRestoredFileCache(snapshot: FileCacheSnapshot): void {
  latestManifest = {
    version: CACHE_VERSION,
    order: snapshot.files.map((file) => file.fileName),
    currentFileName: snapshot.currentFileName,
    updatedAt: snapshot.updatedAt,
  };
  lastManifestTimestamp = Math.max(lastManifestTimestamp, snapshot.updatedAt);
  knownFiles =
    snapshot.source === "indexeddb"
      ? new Map(snapshot.files.map((file) => [file.fileName, file]))
      : new Map();
}

function collectPending(files: FileType[], currentFileName: string): {
  writes: PendingWrite[];
  deletes: string[];
  manifest: FileCacheManifest;
} {
  const currentNames = new Set(files.map((file) => file.fileName));
  const writes: PendingWrite[] = [];
  for (const file of files) {
    if (knownFiles.get(file.fileName) === file) continue;
    writes.push({ fileName: file.fileName, value: file });
  }
  const deletes = [...knownFiles.keys()].filter((fileName) => !currentNames.has(fileName));
  knownFiles = new Map(files.map((file) => [file.fileName, file]));
  const manifest: FileCacheManifest = {
    version: CACHE_VERSION,
    order: files.map((file) => file.fileName),
    currentFileName,
    updatedAt: Math.max(Date.now(), lastManifestTimestamp + 1),
  };
  lastManifestTimestamp = manifest.updatedAt;
  latestManifest = manifest;
  return { writes, deletes, manifest };
}

function clearSchedule(): void {
  if (scheduledTimer) clearTimeout(scheduledTimer);
  scheduledTimer = null;
  if (idleHandle !== null && typeof cancelIdleCallback === "function") {
    cancelIdleCallback(idleHandle);
  }
  idleHandle = null;
}

async function flushPending(): Promise<void> {
  clearSchedule();
  const writes = [...pendingWrites.values()];
  const deletes = [...pendingDeletes];
  pendingWrites = new Map();
  pendingDeletes = new Set();
  if (
    !latestManifest ||
    (!isManifestDirty && writes.length === 0 && deletes.length === 0)
  ) {
    return;
  }
  isManifestDirty = false;
  lastManifestTimestamp = 0;
  const serializedWrites = writes.map((write) => ({
    ...write,
    value: serializeFileForCache(write.value),
  }));
  try {
    const success = await writeIndexedDb(serializedWrites, deletes, latestManifest);
    if (success) {
      getStorage()?.removeItem(LEGACY_KEY);
    } else {
      writeLocalCache(serializedWrites, deletes, latestManifest);
    }
  } catch (error) {
    console.error("[fileCache] 缓存写入失败:", error);
    for (const write of writes) pendingWrites.set(write.fileName, write);
    for (const fileName of deletes) pendingDeletes.add(fileName);
    isManifestDirty = true;
    errorHandler?.(error);
  }
}

export function scheduleFileCache(files: FileType[], currentFileName: string): void {
  const collected = collectPending(files, currentFileName);
  for (const write of collected.writes) {
    pendingDeletes.delete(write.fileName);
    pendingWrites.set(write.fileName, write);
  }
  for (const fileName of collected.deletes) {
    pendingWrites.delete(fileName);
    pendingDeletes.add(fileName);
  }
  isManifestDirty = true;
  if (scheduledTimer || idleHandle !== null) return;
  scheduledTimer = setTimeout(() => {
    scheduledTimer = null;
    if (typeof requestIdleCallback === "function") {
      idleHandle = requestIdleCallback(() => {
        idleHandle = null;
        void flushPending();
      }, { timeout: IDLE_TIMEOUT_MS });
    } else {
      void flushPending();
    }
  }, CACHE_SCHEDULE_DELAY_MS);
}

export function flushFileCacheSync(): void {
  clearSchedule();
  if (!latestManifest) return;
  const writes = [...pendingWrites.values()];
  const deletes = [...pendingDeletes];
  pendingWrites = new Map();
  pendingDeletes = new Set();
  if (!isManifestDirty && writes.length === 0 && deletes.length === 0) return;
  isManifestDirty = false;
  const serializedWrites = writes.map((write) => ({
    ...write,
    value: serializeFileForCache(write.value),
  }));
  try {
    writeLocalCache(serializedWrites, deletes, latestManifest);
    void writeIndexedDb(serializedWrites, deletes, latestManifest);
  } catch (error) {
    console.error("[fileCache] 关闭前缓存写入失败:", error);
    errorHandler?.(error);
  }
}

export async function flushFileCache(): Promise<void> {
  await flushPending();
}

export function setFileCacheErrorHandler(
  handler: ((error: unknown) => void) | null,
): void {
  errorHandler = handler;
}

export function resetFileCacheForTests(): void {
  clearSchedule();
  knownFiles = new Map();
  pendingWrites = new Map();
  pendingDeletes = new Set();
  latestManifest = null;
  isManifestDirty = false;
  dbPromise = null;
  errorHandler = null;
}
