import { activatePipelineDocument } from "../features/pipeline-document/pipelineDocumentService";
import { documentProtocol } from "./server";
import {
  confirmUnsavedTransition,
  type DirtyEditorItem,
} from "./editorDirtyState";
import { useDocumentStore } from "../stores/documentStore";
import { useFileStore } from "../stores/fileStore";
import {
  useProjectSessionStore,
  type EditorTab,
} from "../stores/projectSessionStore";

export async function activateEditorTab(tab: EditorTab): Promise<boolean> {
  const session = useProjectSessionStore.getState();
  const entry = session.entriesById[tab.documentId];
  if (!entry) return false;
  return entry.kind === "pipeline"
    ? activatePipelineDocument(tab.documentId)
    : documentProtocol.openDocument(tab.documentId);
}

export async function closeEditorTab(tab: EditorTab): Promise<boolean> {
  const dirtyItems = getDirtyTabItems(tab);
  if (
    dirtyItems.length > 0 &&
    !(await confirmUnsavedTransition("close-tab", dirtyItems))
  ) {
    return false;
  }

  const session = useProjectSessionStore.getState();
  const entry = session.entriesById[tab.documentId];
  const document = useDocumentStore.getState().opened[tab.documentId];
  useDocumentStore.getState().closeDocument(tab.documentId);
  document?.linkedDocumentIds.forEach((documentId) => {
    const linkedTabOpen = session.tabs.some((item) => item.documentId === documentId);
    if (!linkedTabOpen) useDocumentStore.getState().closeDocument(documentId);
  });
  if (entry?.kind === "pipeline") {
    const file = useFileStore.getState().findFileByDocumentId(tab.documentId);
    if (file) useFileStore.getState().removeDocument(file.documentId);
  }

  const nextId = session.closeTab(tab.documentId);
  if (nextId) await activateEditorTab({ documentId: nextId });
  return true;
}

function getDirtyTabItems(tab: EditorTab): DirtyEditorItem[] {
  const opened = useDocumentStore.getState().opened;
  const document = opened[tab.documentId];
  if (!document) return [];
  return [document.documentId, ...document.linkedDocumentIds]
    .map((documentId) => opened[documentId])
    .filter((item) => item?.dirty)
    .map((item) => ({
      key: item.documentId,
      name: item.descriptor.name,
      path: item.path,
    }));
}
