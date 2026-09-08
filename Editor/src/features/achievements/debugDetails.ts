import type { DebugNodeExecutionRecord } from "@/features/debug/selectors/nodeExecutionSelector";
import { useFileStore } from "@/stores/project/fileStore";
import { useFlowStore } from "@/stores/flow";
import { emitAchievementEvent } from "./bus";

export function recordDebugFailureFocus(record: DebugNodeExecutionRecord): void {
  const flow = useFlowStore.getState();
  if (!record.hasFailure || !record.nodeId || record.fileId !== useFileStore.getState().currentFile.fileName ||
    !flow.instance || !flow.nodeById.has(record.nodeId)) return;
  emitAchievementEvent("debug:failure:focused", { runId: record.runId, nodeId: record.nodeId, fileId: record.fileId });
}
