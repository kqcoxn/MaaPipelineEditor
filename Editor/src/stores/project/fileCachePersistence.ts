import { notification } from "antd";

import { useFlowStore } from "@/stores/flow";
import {
  flushFileCacheSync,
  primeRestoredFileCache,
  readCachedFiles,
  scheduleFileCache,
  setFileCacheErrorHandler,
} from "./fileCache";
import { saveFlow, useFileStore } from "./fileStore";

const FILE_CACHE_DEBOUNCE_MS = 500;

export async function restoreFileCache(signal?: AbortSignal): Promise<boolean> {
  const initialGraphRevision = useFlowStore.getState().graphRevision;
  const initialFiles = useFileStore.getState().files;
  const snapshot = await readCachedFiles();
  if (
    signal?.aborted ||
    !snapshot ||
    useFlowStore.getState().graphRevision !== initialGraphRevision ||
    useFileStore.getState().files !== initialFiles
  ) {
    return false;
  }
  const restored = !useFileStore
    .getState()
    .replace(snapshot.files, snapshot.currentFileName);
  if (restored) primeRestoredFileCache(snapshot);
  return restored;
}

function reportCacheError(error: unknown): void {
  const isQuotaExceeded =
    error instanceof DOMException && error.name === "QuotaExceededError";
  notification.error({
    title: isQuotaExceeded ? "本地存储空间不足" : "本地文件缓存写入失败",
    description: isQuotaExceeded
      ? "浏览器本地存储空间已满，无法保存文件缓存。建议清理浏览器数据或减少文件数量。"
      : "最近的编辑可能无法在刷新后恢复，请检查浏览器存储权限和可用空间。",
    placement: "topRight",
    duration: 10,
  });
}

export function initializeFileCachePersistence(): () => void {
  let graphTimer: ReturnType<typeof setTimeout> | null = null;
  setFileCacheErrorHandler(reportCacheError);

  const scheduleCurrentFiles = () => {
    const state = useFileStore.getState();
    scheduleFileCache(state.files, state.currentFile.fileName);
  };
  const syncGraph = () => {
    if (graphTimer) clearTimeout(graphTimer);
    graphTimer = setTimeout(() => {
      graphTimer = null;
      saveFlow();
      scheduleCurrentFiles();
    }, FILE_CACHE_DEBOUNCE_MS);
  };
  const commitBeforeLeave = () => {
    if (graphTimer) clearTimeout(graphTimer);
    graphTimer = null;
    saveFlow();
    scheduleCurrentFiles();
    flushFileCacheSync();
  };
  const handleVisibilityChange = () => {
    if (document.hidden) commitBeforeLeave();
  };

  const unsubscribeGraph = useFlowStore.subscribe(
    (state) => state.graphRevision,
    syncGraph,
  );
  const unsubscribeFiles = useFileStore.subscribe(scheduleCurrentFiles);
  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("pagehide", commitBeforeLeave);
  window.addEventListener("beforeunload", commitBeforeLeave);
  scheduleCurrentFiles();

  return () => {
    if (graphTimer) clearTimeout(graphTimer);
    unsubscribeGraph();
    unsubscribeFiles();
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    window.removeEventListener("pagehide", commitBeforeLeave);
    window.removeEventListener("beforeunload", commitBeforeLeave);
    setFileCacheErrorHandler(null);
  };
}
