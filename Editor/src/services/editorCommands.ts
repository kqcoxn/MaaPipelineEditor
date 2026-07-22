import { Modal } from "antd";

import { documentProtocol } from "./server";
import { sendToParent, isEmbedEnvironment } from "../utils/embedBridge";
import { useFileStore } from "../stores/fileStore";
import { useProjectSessionStore } from "../stores/projectSessionStore";
import { useToolbarStore } from "../stores/toolbarStore";

export type SaveActiveEditorResult =
  | "saved"
  | "clean"
  | "export-requested"
  | "delegated"
  | "failed";

export async function saveActiveEditor(): Promise<SaveActiveEditorResult> {
  if (isEmbedEnvironment()) {
    sendToParent("mpe:saveRequest", { hint: "user-triggered" });
    return "delegated";
  }

  const session = useProjectSessionStore.getState();
  const active = session.tabs.find((tab) => tab.key === session.activeKey);
  if (!active) return "failed";
  if (active.kind === "document") {
    const document = documentProtocol
      ? await documentProtocol.saveDocument(active.path)
      : false;
    return document ? "saved" : "failed";
  }

  const fileStore = useFileStore.getState();
  const file = fileStore.files.find(
    (item) =>
      item.config.filePath === active.path || item.fileName === active.path,
  );
  if (!file) return "failed";
  if (!file.saveState.dirty) return "clean";
  if (file.saveState.externalChange === "deleted") {
    useToolbarStore.getState().openExportDialog();
    return "export-requested";
  }
  if (!file.config.filePath) {
    useToolbarStore.getState().openExportDialog();
    return "export-requested";
  }
  const allowOverwrite =
    file.saveState.externalChange === "modified"
      ? await confirmOverwriteExternalFile(file.fileName)
      : false;
  if (file.saveState.externalChange === "modified" && !allowOverwrite) {
    return "failed";
  }
  return (await fileStore.saveFileToLocal(undefined, file, undefined, {
    allowOverwrite,
  }))
    ? "saved"
    : "failed";
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
