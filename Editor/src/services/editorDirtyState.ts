import { Modal } from "antd";

import { useDocumentStore } from "../stores/documentStore";
import { useFileStore } from "../stores/fileStore";

export interface DirtyEditorItem {
  kind: "pipeline" | "document";
  key: string;
  name: string;
  path?: string;
}

export type UnsavedTransitionReason =
  | "close-tab"
  | "switch-project"
  | "switch-interface"
  | "disconnect"
  | "exit-application";

export function collectDirtyEditorItems(): DirtyEditorItem[] {
  const pipelines = useFileStore
    .getState()
    .files.filter((file) => file.saveState.dirty)
    .map((file) => ({
      kind: "pipeline" as const,
      key: file.config.filePath ?? file.fileName,
      name: file.fileName,
      path: file.config.filePath,
    }));
  const documents = Object.values(useDocumentStore.getState().opened)
    .filter((document) => document.dirty)
    .map((document) => ({
      kind: "document" as const,
      key: document.path,
      name: document.descriptor.name,
      path: document.path,
    }));
  return [...pipelines, ...documents];
}

export function confirmUnsavedTransition(
  reason: UnsavedTransitionReason,
  items: DirtyEditorItem[] = collectDirtyEditorItems(),
): Promise<boolean> {
  if (items.length === 0) return Promise.resolve(true);
  const names = items
    .slice(0, 3)
    .map((item) => `“${item.name}”`)
    .join("、");
  const suffix = items.length > 3 ? ` 等 ${items.length} 个文件` : "";
  const disconnect = reason === "disconnect";
  return new Promise((resolve) => {
    Modal.confirm({
      title: disconnect ? "断开 LocalBridge" : "存在未保存修改",
      content: disconnect
        ? `${names}${suffix}尚未保存。断开后草稿会保留，但暂时无法保存到项目，是否继续？`
        : `${names}${suffix}尚未保存，继续操作将放弃这些修改。`,
      okText: disconnect ? "继续断开" : "放弃修改",
      cancelText: "继续编辑",
      okButtonProps: disconnect ? undefined : { danger: true },
      mask: { closable: false },
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    });
  });
}

export function hasDirtyEditorItems(): boolean {
  return collectDirtyEditorItems().length > 0;
}

export function handleDirtyBeforeUnload(event: BeforeUnloadEvent): void {
  if (!hasDirtyEditorItems()) return;
  event.preventDefault();
  event.returnValue = "";
}
