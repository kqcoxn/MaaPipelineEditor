import { documentProtocol, fileProtocol } from "./server";
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
  if (entry.kind !== "pipeline") return documentProtocol.openDocument(tab.documentId);

  const file = useFileStore.getState().findFileByDocumentId(tab.documentId);
  if (file) {
    useFileStore.getState().switchFile(file.fileName);
    session.activateTab(tab.documentId);
    return true;
  }
  return entry.path !== undefined ? fileProtocol.requestOpenFile(entry.path) : false;
}

export async function closeEditorTab(tab: EditorTab): Promise<boolean> {
  const dirtyItem = getDirtyTabItem(tab);
  if (dirtyItem && !(await confirmUnsavedTransition("close-tab", [dirtyItem]))) {
    return false;
  }
  const session = useProjectSessionStore.getState();
  const entry = session.entriesById[tab.documentId];
  if (entry?.kind !== "pipeline") {
    useDocumentStore.getState().closeDocument(tab.documentId);
  } else {
    const file = useFileStore.getState().findFileByDocumentId(tab.documentId);
    if (file) useFileStore.getState().removeFile(file.fileName);
  }
  const nextId = session.closeTab(tab.documentId);
  if (nextId) await activateEditorTab({ documentId: nextId });
  return true;
}

function getDirtyTabItem(tab: EditorTab): DirtyEditorItem | undefined {
  const session = useProjectSessionStore.getState();
  const entry = session.entriesById[tab.documentId];
  if (!entry) return undefined;
  if (entry.kind !== "pipeline") {
    const document = useDocumentStore.getState().opened[tab.documentId];
    return document?.dirty
      ? {
          kind: "document",
          key: tab.documentId,
          name: document.descriptor.name,
          path: document.path,
        }
      : undefined;
  }
  const file = useFileStore.getState().findFileByDocumentId(tab.documentId);
  return file?.saveState.dirty
    ? {
        kind: "pipeline",
        key: tab.documentId,
        name: file.fileName,
        path: file.config.filePath,
      }
    : undefined;
}
