import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  confirm: vi.fn(),
  save: vi.fn(),
  flush: vi.fn(),
  status: "idle",
  files: [] as Array<{ fileName: string; config: { filePath?: string } }>,
}));
vi.mock("@/utils/ui/antdAppApi", () => ({
  modal: { confirm: mocks.confirm },
  message: { error: vi.fn() },
}));
vi.mock("./host", () => ({ desktopContext: {}, desktopInvoke: mocks.invoke }));
vi.mock("@/stores/project/fileStore", () => ({
  saveFlow: vi.fn(),
  useFileStore: {
    getState: () => ({
      files: mocks.files,
      currentFile: mocks.files[0],
      saveFileToLocal: mocks.save,
    }),
  },
}));
vi.mock("@/stores/project/fileDirtyState", () => ({
  hasUnsavedContent: () => true,
}));
vi.mock("@/stores/project/fileCache", () => ({
  flushFileCache: mocks.flush,
  flushFileCacheSync: vi.fn(),
  scheduleFileCache: vi.fn(),
}));
vi.mock("@/stores/debug/debugSessionStore", () => ({
  useDebugSessionStore: { getState: () => ({ session: { status: mocks.status } }) },
}));

import { initializeDesktopSession } from "./closeSession";

describe("desktop close handshake", () => {
  let dispose: () => void;
  let requestClose: () => void;
  beforeEach(async () => {
    vi.clearAllMocks();
    mocks.status = "idle";
    mocks.flush.mockResolvedValue(undefined);
    mocks.files = [{ fileName: "pipeline", config: {} }];
    mocks.invoke.mockResolvedValue(undefined);
    mocks.save.mockResolvedValue(true);
    mocks.confirm.mockReturnValue({ update: vi.fn(), destroy: vi.fn() });
    window.__TAURI__ = {
      core: { invoke: mocks.invoke },
      event: {
        listen: vi.fn(async (_name, callback) => {
          requestClose = callback;
          return vi.fn();
        }),
      },
    };
    dispose = initializeDesktopSession();
    await Promise.resolve();
  });
  afterEach(() => {
    dispose();
    delete window.__TAURI__;
  });

  it("caches unsaved files and exits without a save prompt or disk write", async () => {
    let finishCache!: () => void;
    mocks.flush.mockReturnValue(new Promise<void>((resolve) => {
      finishCache = resolve;
    }));
    requestClose();
    requestClose();
    expect(mocks.confirm).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.invoke).not.toHaveBeenCalledWith("desktop_reply", { accept: true });
    finishCache();
    await vi.waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith("desktop_reply", { accept: true }));
    expect(mocks.flush).toHaveBeenCalledTimes(1);
    expect(mocks.invoke.mock.calls.some(([command]) => command === "desktop_save_path")).toBe(false);
  });

  it.each(["running", "stopping"])("allows cancelling exit while the task is %s", async (status) => {
    mocks.status = status;
    requestClose();
    requestClose();
    expect(mocks.confirm).toHaveBeenCalledTimes(1);
    await mocks.confirm.mock.calls[0][0].onCancel();
    expect(mocks.invoke).toHaveBeenCalledWith("desktop_reply", { accept: false });
    expect(mocks.flush).not.toHaveBeenCalled();
  });

  it("caches the session before confirming stop and exit", async () => {
    mocks.status = "running";
    requestClose();
    await mocks.confirm.mock.calls[0][0].onOk();
    expect(mocks.flush).toHaveBeenCalledTimes(1);
    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.invoke).toHaveBeenLastCalledWith("desktop_reply", { accept: true });
  });

  it("allows retrying close after the host fails", async () => {
    mocks.invoke.mockRejectedValueOnce(new Error("stop failed"));
    requestClose();
    await vi.waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith("desktop_reply", { accept: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    requestClose();
    await vi.waitFor(() => expect(mocks.flush).toHaveBeenCalledTimes(2));
  });
});
