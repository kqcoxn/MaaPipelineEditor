import { flowToPipelineString } from "../core/parser";
import { saveFlow, useFileStore } from "../stores/fileStore";
import { createPipelineFingerprint } from "../stores/pipelineSaveState";

export interface EmbedSaveData {
  saveToken: string;
  fileName: string;
  data: string;
}

interface PendingEmbedSave {
  fileName: string;
  fingerprint: string;
}

const pendingSaves = new Map<string, PendingEmbedSave>();
let saveSequence = 0;

export function beginEmbedSave(): EmbedSaveData {
  saveFlow();
  const file = useFileStore.getState().currentFile;
  const saveToken = `mpe-save-${Date.now()}-${++saveSequence}`;
  pendingSaves.set(saveToken, {
    fileName: file.fileName,
    fingerprint: createPipelineFingerprint(file),
  });
  return {
    saveToken,
    fileName: file.fileName,
    data: flowToPipelineString(),
  };
}

export function resolveEmbedSaveResult(payload: unknown): boolean {
  if (!isEmbedSaveResult(payload)) return false;
  const pending = pendingSaves.get(payload.saveToken);
  if (!pending) return false;
  pendingSaves.delete(payload.saveToken);
  if (!payload.success) return false;
  useFileStore
    .getState()
    .markFileSaved(pending.fileName, pending.fingerprint);
  return true;
}

export function clearPendingEmbedSaves(): void {
  pendingSaves.clear();
}

function isEmbedSaveResult(
  value: unknown,
): value is { saveToken: string; success: boolean } {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { saveToken?: unknown }).saveToken === "string" &&
    typeof (value as { success?: unknown }).success === "boolean"
  );
}
