import { Modal } from "antd";

import { documentProtocol } from "./server";
import { localServer } from "./server";
import { useDocumentStore } from "../stores/documentStore";
import { useFileStore } from "../stores/fileStore";
import {
  useProjectSessionStore,
  type EditorTab,
} from "../stores/projectSessionStore";

export function confirmDocumentTransition(nextKey: string | null): Promise<boolean> {
  const session = useProjectSessionStore.getState();
  if (session.activeKey === nextKey) return Promise.resolve(true);
  const active = session.tabs.find((tab) => tab.key === session.activeKey);
  if (!active || active.kind !== "document") return Promise.resolve(true);
  const document = useDocumentStore.getState().opened[active.path];
  if (!document?.dirty) return Promise.resolve(true);

  return new Promise((resolve) => {
    Modal.confirm({
      title: "文档尚未保存",
      content: `“${document.descriptor.name}”有未保存修改，是否放弃这些修改？`,
      okText: "放弃修改",
      cancelText: "继续编辑",
      okButtonProps: { danger: true },
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    });
  });
}

export async function activateEditorTab(tab: EditorTab): Promise<boolean> {
  if (!(await confirmDocumentTransition(tab.key))) return false;
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
  if (tab.kind === "document") {
    const document = useDocumentStore.getState().opened[tab.path];
    if (document?.dirty && !(await confirmDirtyDocumentClose(document.descriptor.name))) {
      return false;
    }
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

function confirmDirtyDocumentClose(name: string): Promise<boolean> {
  return new Promise((resolve) => {
    Modal.confirm({
      title: "文档尚未保存",
      content: `“${name}”有未保存修改，是否放弃这些修改？`,
      okText: "放弃修改",
      cancelText: "继续编辑",
      okButtonProps: { danger: true },
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    });
  });
}
