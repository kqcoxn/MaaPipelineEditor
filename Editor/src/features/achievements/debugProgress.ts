import type { DebugEvent, DebugRunStarted } from "@/features/debug/types";

interface Failure {
  runId: string;
  fileIds: Set<string>;
  edited: boolean;
  focusedNode?: string;
  focusedFile?: string;
  focusedNodeEdited: boolean;
}

/**仅保存本次打开编辑器的因果链；终态重复回传、回放与其他入口均不会误计。 */
export function createDebugAchievementTracker(award: (counter: string) => void) {
  const failures = new Map<string, Failure>();
  const startedRuns = new Set<string>();
  let active: { run: Pick<DebugRunStarted, "runId" | "sessionId" | "mode" | "entry">; key: string; retry?: Failure; recognitionReported: boolean; fileIds: Set<string> } | undefined;
  return {
    start(run: Pick<DebugRunStarted, "runId" | "sessionId" | "mode" | "entry">, fileId: string, resourcePaths: string[]) {
      const identity = `${run.sessionId}:${run.runId}`;
      if (startedRuns.has(identity)) return;
      startedRuns.add(identity);
      if (startedRuns.size > 256) startedRuns.delete(startedRuns.values().next().value!);
      const key = JSON.stringify([resourcePaths, run.entry]);
      active = { run, key, retry: failures.get(key), recognitionReported: false, fileIds: new Set([fileId]) };
      // 开始运行后再做的编辑，不属于这次验证。
      if (active.retry) active.retry = { ...active.retry };
    },
    edit(fileId: string, nodeId: string) {
      for (const failure of failures.values()) {
        if (!failure.fileIds.has(fileId)) continue;
        failure.edited = true;
        if (failure.focusedNode === nodeId && failure.focusedFile === fileId) failure.focusedNodeEdited = true;
      }
    },
    focusFailure(runId: string, fileId: string, nodeId: string) {
      for (const failure of failures.values()) {
        if (failure.runId !== runId || !failure.fileIds.has(fileId)) continue;
        failure.focusedNode = nodeId;
        failure.focusedFile = fileId;
        failure.focusedNodeEdited = false;
      }
    },
    event(event: DebugEvent) {
      if (!active || event.runId !== active.run.runId || event.sessionId !== active.run.sessionId) return;
      const { run, key, retry } = active;
      if (event.node?.fileId) active.fileIds.add(event.node.fileId);
      if (run.mode === "recognition-only" && event.kind === "recognition" &&
        (event.phase === "succeeded" || event.phase === "failed" || event.phase === "completed") && !active.recognitionReported) {
        award("debug_recognition_result");
        active.recognitionReported = true;
      }
      if (event.kind !== "session") return;
      const status = event.status === "stopped" ? "stopped" : event.phase ?? event.status;
      if (status !== "completed" && status !== "failed" && status !== "stopped") return;
      if (run.mode === "single-node-run" && status === "completed") award("debug_single_completed");
      if (run.mode === "run-from-node") {
        if (status === "completed") {
          award("debug_run_completed");
          if (retry?.edited) award("debug_retry_completed");
          if (retry?.focusedNodeEdited) award("debug_fix_completed");
          failures.delete(key);
        } else if (status === "failed") {
          failures.set(key, { runId: run.runId, fileIds: active.fileIds, edited: false, focusedNodeEdited: false });
        } else {
          // 停止也消耗“下一次”机会，但保留普通重试的历史。
          const failure = failures.get(key);
          if (failure) failures.set(key, { ...failure, focusedNode: undefined, focusedNodeEdited: false });
        }
      }
      active = undefined;
    },
  };
}
