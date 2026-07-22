import { BrowserProjectStorageAdapter } from "../features/project-storage/BrowserProjectStorageAdapter";
import { projectStorageCoordinator } from "../features/project-storage/projectStorageCoordinator";
import { useDocumentStore } from "../stores/documentStore";
import { useFileStore } from "../stores/fileStore";
import { useProjectSessionStore } from "../stores/projectSessionStore";
import { useResourceStore } from "../stores/resourceStore";
import { confirmUnsavedTransition } from "./editorDirtyState";

export type BrowserProjectOpenResult =
  | { status: "unavailable" }
  | { status: "cancelled" }
  | { status: "declined" }
  | { status: "success"; name: string }
  | { status: "failed"; error: unknown };

interface BrowserDirectoryPickerWindow extends Window {
  showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
}

export function canOpenBrowserProject(): boolean {
  return typeof (window as BrowserDirectoryPickerWindow).showDirectoryPicker === "function";
}

export async function openBrowserProject(): Promise<BrowserProjectOpenResult> {
  const picker = (window as BrowserDirectoryPickerWindow).showDirectoryPicker;
  if (!picker) return { status: "unavailable" };

  let handle: FileSystemDirectoryHandle;
  try {
    handle = await picker.call(window);
  } catch (error) {
    return isAbortError(error)
      ? { status: "cancelled" }
      : { status: "failed", error };
  }

  if (!(await confirmUnsavedTransition("switch-project"))) {
    return { status: "declined" };
  }

  try {
    const adapter = new BrowserProjectStorageAdapter(handle);
    const entries = await adapter.list();
    useFileStore.getState().clearProjectFiles();
    useDocumentStore.getState().clearProject();
    useResourceStore.getState().clear();
    projectStorageCoordinator.setAdapter(adapter);
    useProjectSessionStore.getState().applyEntries(entries);
    return { status: "success", name: handle.name };
  } catch (error) {
    return { status: "failed", error };
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
