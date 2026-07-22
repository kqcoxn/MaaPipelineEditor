import { syncCurrentPipelineToDocuments } from "../features/pipeline-document/pipelineDocumentService";
import type { DocumentId } from "../features/project-session/types";
import { useDocumentStore } from "../stores/documentStore";
import { saveFlow, useFileStore } from "../stores/fileStore";

export interface EmbedSaveData {
  saveToken: string;
  fileName: string;
  data: string;
}

interface PendingEmbedSave {
  documentId: DocumentId;
  savedText: string;
}

const pendingSaves = new Map<string, PendingEmbedSave>();
let saveSequence = 0;

export async function beginEmbedSave(): Promise<EmbedSaveData> {
  saveFlow();
  await syncCurrentPipelineToDocuments();
  const file = useFileStore.getState().currentFile;
  const document = useDocumentStore.getState().opened[file.documentId];
  if (!document) throw new Error("当前 Pipeline 尚未注册为文档");
  const saveToken = `mpe-save-${Date.now()}-${++saveSequence}`;
  pendingSaves.set(saveToken, {
    documentId: document.documentId,
    savedText: document.workingText,
  });
  return {
    saveToken,
    fileName: file.fileName,
    data: document.workingText,
  };
}

export function resolveEmbedSaveResult(payload: unknown): boolean {
  if (!isEmbedSaveResult(payload)) return false;
  const pending = pendingSaves.get(payload.saveToken);
  if (!pending) return false;
  pendingSaves.delete(payload.saveToken);
  if (!payload.success) return false;
  const document = useDocumentStore.getState().opened[pending.documentId];
  if (!document) return false;
  const size = new TextEncoder().encode(pending.savedText).length;
  useDocumentStore.getState().markSaved(
    pending.documentId,
    {
      path: document.path,
      revision: `embedded:${payload.saveToken}`,
      size,
      sha256: `embedded:${payload.saveToken}`,
      operationId: payload.saveToken,
      encoding: document.encoding,
    },
    pending.savedText,
  );
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
