import { message } from "antd";

import { getCapability } from "../features/project-storage/ProjectStorageAdapter";
import { syncCurrentPipelineToDocuments } from "../features/pipeline-document/pipelineDocumentService";
import { useDocumentStore } from "../stores/documentStore";
import { useProjectSessionStore } from "../stores/projectSessionStore";
import { useToolbarStore } from "../stores/toolbarStore";
import { documentProtocol } from "./server";
import type { DocumentSaveOutcome } from "./protocols/DocumentProtocol";

export type SaveActiveEditorResult =
  | "saved"
  | "clean"
  | "export-requested"
  | "failed";

export async function saveActiveEditor(): Promise<SaveActiveEditorResult> {
  const session = useProjectSessionStore.getState();
  const documentId = session.activeDocumentId;
  if (!documentId) return "failed";
  if (session.entriesById[documentId]?.kind === "pipeline") {
    await syncCurrentPipelineToDocuments();
  }
  const document = useDocumentStore.getState().opened[documentId];
  if (!document) return "failed";
  if (!document.dirty && !hasDirtyLinkedDocument(documentId)) return "clean";

  if (!document.path || !getCapability(session.capabilities, "write").available) {
    useToolbarStore.getState().openExportDialog();
    return "export-requested";
  }

  const outcomes = await documentProtocol.saveDocumentGroup(documentId, "user");
  return summarizeSave(outcomes, false);
}

export async function saveAllDocuments(): Promise<DocumentSaveOutcome[]> {
  const session = useProjectSessionStore.getState();
  if (!getCapability(session.capabilities, "write").available) {
    message.error("当前项目不可写");
    return [];
  }
  const outcomes = await documentProtocol.saveAllDirty("save-all");
  summarizeSave(outcomes, true);
  return outcomes;
}

function hasDirtyLinkedDocument(documentId: string): boolean {
  const opened = useDocumentStore.getState().opened;
  return Boolean(
    opened[documentId]?.linkedDocumentIds.some(
      (linkedId) => opened[linkedId]?.dirty,
    ),
  );
}

function summarizeSave(
  outcomes: DocumentSaveOutcome[],
  isSaveAll: boolean,
): SaveActiveEditorResult {
  const failed = outcomes.filter((outcome) => outcome.status === "failed");
  if (failed.length > 0) {
    message.error(`保存失败：${failed.map((outcome) => outcome.name).join("、")}`);
    return "failed";
  }
  const saved = outcomes.filter((outcome) => outcome.status === "saved");
  if (saved.length === 0) return "clean";
  message.success(
    isSaveAll
      ? `已保存 ${saved.length} 个文档`
      : `已保存 ${saved.map((outcome) => outcome.name).join("、")}`,
  );
  return "saved";
}
