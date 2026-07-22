import { Modal } from "antd";

import { getCapability } from "../features/project-storage/ProjectStorageAdapter";
import { projectStorageCoordinator } from "../features/project-storage/projectStorageCoordinator";
import { useDocumentStore } from "../stores/documentStore";
import { useFileStore } from "../stores/fileStore";
import { useProjectSessionStore } from "../stores/projectSessionStore";
import { useToolbarStore } from "../stores/toolbarStore";
import { documentProtocol } from "./server";

export type SaveActiveEditorResult =
  | "saved"
  | "clean"
  | "export-requested"
  | "delegated"
  | "failed";

export async function saveActiveEditor(): Promise<SaveActiveEditorResult> {
  const session = useProjectSessionStore.getState();
  const documentId = session.activeDocumentId;
  if (!documentId) return "failed";
  const entry = session.entriesById[documentId];
  if (!entry) return "failed";

  if (entry.kind !== "pipeline") {
    const document = useDocumentStore.getState().opened[documentId];
    if (!document?.dirty) return "clean";
    if (!getCapability(session.capabilities, "write").available) return "failed";
    return (await documentProtocol.saveDocument(documentId)) ? "saved" : "failed";
  }

  const file = useFileStore.getState().findFileByDocumentId(documentId);
  if (!file) return "failed";
  if (!file.saveState.dirty) return "clean";
  if (file.saveState.externalChange === "deleted") {
    useToolbarStore.getState().openExportDialog();
    return "export-requested";
  }
  const adapter = projectStorageCoordinator.requireAdapter();
  const canWrite = getCapability(session.capabilities, "write").available;
  if (entry.path === undefined) {
    if (canWrite) {
      const delegated = await adapter.savePipeline(documentId, file);
      if (delegated !== "unsupported") return delegated;
    }
    useToolbarStore.getState().openExportDialog();
    return "export-requested";
  }
  if (!canWrite) return "failed";
  const allowOverwrite =
    file.saveState.externalChange === "modified"
      ? await confirmOverwriteExternalFile(file.fileName)
      : false;
  if (file.saveState.externalChange === "modified" && !allowOverwrite) {
    return "failed";
  }
  const result = await adapter.savePipeline(documentId, file, { allowOverwrite });
  return result === "unsupported" ? "failed" : result;
}

function confirmOverwriteExternalFile(fileName: string): Promise<boolean> {
  return new Promise((resolve) => {
    Modal.confirm({
      title: "覆盖磁盘版本",
      content: `文件“${fileName}”已被外部修改。确认使用当前本地草稿覆盖磁盘版本？`,
      okText: "覆盖磁盘版本",
      cancelText: "取消",
      okButtonProps: { danger: true },
      mask: { closable: false },
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    });
  });
}
