import { beforeEach, describe, expect, it, vi } from "vitest";

const dirtyStateMocks = vi.hoisted(() => ({
  confirmUnsavedTransition: vi.fn(async () => true),
}));

vi.mock("./editorDirtyState", () => dirtyStateMocks);

import { projectStorageCoordinator } from "../features/project-storage/projectStorageCoordinator";
import { useDocumentStore } from "../stores/documentStore";
import { useFileStore } from "../stores/fileStore";
import { useProjectSessionStore } from "../stores/projectSessionStore";
import { useResourceStore } from "../stores/resourceStore";
import { openBrowserProject } from "./browserProject";

function directoryHandle(
  name = "project",
  values: () => AsyncIterableIterator<
    FileSystemDirectoryHandle | FileSystemFileHandle
  > = async function* () {},
): FileSystemDirectoryHandle {
  return {
    kind: "directory",
    name,
    values,
    getDirectoryHandle: vi.fn(),
    getFileHandle: vi.fn(),
    removeEntry: vi.fn(),
    resolve: vi.fn(),
    isSameEntry: vi.fn(),
    queryPermission: vi.fn(),
    requestPermission: vi.fn(),
  } as unknown as FileSystemDirectoryHandle;
}

function setPicker(
  picker: (() => Promise<FileSystemDirectoryHandle>) | undefined,
): void {
  Object.defineProperty(window, "showDirectoryPicker", {
    configurable: true,
    value: picker,
  });
}

describe("browserProject", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    projectStorageCoordinator.destroy();
    useProjectSessionStore.getState().clear();
    useDocumentStore.getState().clearProject();
    useFileStore.getState().resetProjectSession();
    useResourceStore.getState().clear();
    setPicker(undefined);
  });

  it("leaves the current session untouched when directory selection is cancelled", async () => {
    const documentId = useProjectSessionStore
      .getState()
      .registerDraft("draft", "pipeline");
    setPicker(async () => {
      throw new DOMException("cancelled", "AbortError");
    });

    await expect(openBrowserProject()).resolves.toEqual({ status: "cancelled" });

    expect(useProjectSessionStore.getState().entriesById[documentId]).toBeDefined();
    expect(dirtyStateMocks.confirmUnsavedTransition).not.toHaveBeenCalled();
  });

  it("keeps the current session when the dirty transition is declined", async () => {
    const documentId = useProjectSessionStore
      .getState()
      .registerDraft("draft", "pipeline");
    const handle = directoryHandle();
    dirtyStateMocks.confirmUnsavedTransition.mockResolvedValueOnce(false);
    setPicker(async () => handle);

    await expect(openBrowserProject()).resolves.toEqual({ status: "declined" });

    expect(useProjectSessionStore.getState().entriesById[documentId]).toBeDefined();
    expect(projectStorageCoordinator.getAdapter()).toBeNull();
  });

  it("does not replace the current session when the selected directory cannot be listed", async () => {
    const documentId = useProjectSessionStore
      .getState()
      .registerDraft("draft", "pipeline");
    const error = new Error("directory read failed");
    const handle = directoryHandle("broken", async function* () {
      yield* [];
      throw error;
    });
    setPicker(async () => handle);

    await expect(openBrowserProject()).resolves.toEqual({ status: "failed", error });

    expect(useProjectSessionStore.getState().entriesById[documentId]).toBeDefined();
    expect(projectStorageCoordinator.getAdapter()).toBeNull();
  });

  it("establishes the directory session while retaining draft Pipelines", async () => {
    const draftId = useProjectSessionStore
      .getState()
      .registerDraft("draft", "pipeline");
    const handle = directoryHandle("next-project");
    setPicker(async () => handle);

    await expect(openBrowserProject()).resolves.toEqual({
      status: "success",
      name: "next-project",
    });

    const session = useProjectSessionStore.getState();
    expect(session.adapterKind).toBe("browser");
    expect(session.identity?.name).toBe("next-project");
    expect(session.entriesById[draftId]).toBeDefined();
    expect(projectStorageCoordinator.getAdapter()?.identity).toBe(session.identity);
  });
});
