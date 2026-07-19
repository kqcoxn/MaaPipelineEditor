import { invoke } from "@tauri-apps/api/core";
import { Modal } from "antd";

import { localServer } from "./server";
import { useFileStore } from "../stores/fileStore";
import { useLocalFileStore } from "../stores/localFileStore";
import { useWorkspaceStore } from "../stores/workspaceStore";

export type DesktopProjectOpenResult =
  | { status: "unavailable" }
  | { status: "cancelled" }
  | { status: "declined"; path: string }
  | { status: "success"; path: string }
  | { status: "failed"; path?: string; error: unknown };

export interface DesktopProjectDependencies {
  selectDirectory: () => Promise<string | null>;
  confirmSwitch: (path: string) => Promise<boolean>;
  switchWorkspace: (path: string) => Promise<unknown>;
  resetSession: () => void;
  reconnect: () => void;
}

export function isDesktopEnvironment(): boolean {
  return "__TAURI_INTERNALS__" in window;
}

function confirmProjectSwitch(path: string): Promise<boolean> {
  return new Promise((resolve) => {
    Modal.confirm({
      title: "打开新项目",
      content: `切换到“${path}”将关闭当前 Pipeline 标签并清空画布。是否继续？`,
      okText: "打开项目",
      cancelText: "取消",
      mask: { closable: false },
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    });
  });
}

function resetProjectSession(): void {
  useFileStore.getState().resetProjectSession();
  localStorage.removeItem("_mpe_files");
  useWorkspaceStore.getState().clear();
  useLocalFileStore.getState().clear();
}

function reconnectLocalBridge(): void {
  useWorkspaceStore.getState().prepareReconnect();
  useLocalFileStore.getState().prepareReconnect();
  localServer.disconnect();
  localServer.connect();
}

const defaultDependencies: DesktopProjectDependencies = {
  selectDirectory: () => invoke<string | null>("select_workspace"),
  confirmSwitch: confirmProjectSwitch,
  switchWorkspace: (path) => invoke("switch_workspace", { path }),
  resetSession: resetProjectSession,
  reconnect: reconnectLocalBridge,
};

let pendingOpen: Promise<DesktopProjectOpenResult> | undefined;
let workspaceSwitchInProgress = false;

export function shouldPreserveProjectStateOnDisconnect(): boolean {
  return workspaceSwitchInProgress;
}

export function openDesktopProject(
  dependencies: DesktopProjectDependencies = defaultDependencies,
): Promise<DesktopProjectOpenResult> {
  if (!isDesktopEnvironment() && dependencies === defaultDependencies) {
    return Promise.resolve({ status: "unavailable" });
  }
  pendingOpen ??= runOpenDesktopProject(dependencies).finally(() => {
    pendingOpen = undefined;
  });
  return pendingOpen;
}

async function runOpenDesktopProject(
  dependencies: DesktopProjectDependencies,
): Promise<DesktopProjectOpenResult> {
  let path: string | null;
  try {
    path = await dependencies.selectDirectory();
  } catch (error) {
    return { status: "failed", error };
  }
  if (!path) return { status: "cancelled" };

  let confirmed: boolean;
  try {
    confirmed = await dependencies.confirmSwitch(path);
  } catch (error) {
    return { status: "failed", path, error };
  }
  if (!confirmed) {
    return { status: "declined", path };
  }

  workspaceSwitchInProgress = true;
  try {
    await dependencies.switchWorkspace(path);
    dependencies.resetSession();
    dependencies.reconnect();
    return { status: "success", path };
  } catch (error) {
    dependencies.reconnect();
    return { status: "failed", path, error };
  } finally {
    workspaceSwitchInProgress = false;
  }
}
