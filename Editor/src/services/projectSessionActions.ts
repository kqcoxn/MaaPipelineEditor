import { documentProtocol } from "./server";
import { localServer } from "./server";
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
  if (tab.kind === "document") {
    return documentProtocol.openDocument(tab.path);
  }

  const file = useFileStore
    .getState()
    .files.find(
      (item) =>
        item.fileName === tab.path || item.config.filePath === tab.path,
    );
  if (file) {
    useFileStore.getState().switchFile(file.fileName);
    useProjectSessionStore.getState().activateTab(tab.key);
    return true;
  }
  if (!localServer.send("file.open", { file_path: tab.path })) return false;
  return true;
}

export async function closeEditorTab(tab: EditorTab): Promise<boolean> {
  const dirtyItem = getDirtyTabItem(tab);
  if (
    dirtyItem &&
    !(await confirmUnsavedTransition("close-tab", [dirtyItem]))
  ) {
    return false;
  }
  if (tab.kind === "document") {
    useDocumentStore.getState().closeDocument(tab.path);
    const nextKey = useProjectSessionStore.getState().closeTab(tab.key);
    if (nextKey) {
      const next = useProjectSessionStore
        .getState()
        .tabs.find((item) => item.key === nextKey);
      if (next) await activateEditorTab(next);
    }
    return true;
  }
  const file = useFileStore
    .getState()
    .files.find(
      (item) =>
        item.fileName === tab.path || item.config.filePath === tab.path,
    );
  const nextKey = useProjectSessionStore.getState().closeTab(tab.key);
  if (file) useFileStore.getState().removeFile(file.fileName);
  if (nextKey) {
    const next = useProjectSessionStore
      .getState()
      .tabs.find((item) => item.key === nextKey);
    if (next) await activateEditorTab(next);
  }
  return true;
}

function getDirtyTabItem(tab: EditorTab): DirtyEditorItem | undefined {
  if (tab.kind === "document") {
    const document = useDocumentStore.getState().opened[tab.path];
    return document?.dirty
      ? {
          kind: "document",
          key: tab.path,
          name: document.descriptor.name,
          path: tab.path,
        }
      : undefined;
  }
  const file = useFileStore
    .getState()
    .files.find(
      (item) =>
        item.fileName === tab.path || item.config.filePath === tab.path,
    );
  return file?.saveState.dirty
    ? {
        kind: "pipeline",
        key: tab.path,
        name: file.fileName,
        path: file.config.filePath,
      }
    : undefined;
}
