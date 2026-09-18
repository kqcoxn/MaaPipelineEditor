import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  confirm: vi.fn(),
  save: vi.fn(),
  files: [] as Array<{ fileName: string; config: { filePath?: string } }>,
}));
vi.mock("antd", () => ({ Button: "button", Space: "div" }));
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
  discardDesktopFilesOnClose: vi.fn(),
  flushFileCache: vi.fn().mockResolvedValue(undefined),
  flushFileCacheSync: vi.fn(),
  scheduleFileCache: vi.fn(),
}));
vi.mock("@/stores/debug/debugSessionStore", () => ({
  useDebugSessionStore: { getState: () => ({ session: undefined }) },
}));

import { initializeDesktopSession } from "./closeSession";

describe("desktop close handshake", () => {
  let dispose: () => void;
  let requestClose: () => void;
  beforeEach(async () => {
    vi.clearAllMocks();
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

  it("keeps the session when the native save dialog is cancelled", async () => {
    mocks.invoke.mockImplementation(async (command) =>
      command === "desktop_save_path" ? null : undefined,
    );
    requestClose();
    await expect(mocks.confirm.mock.calls[0][0].onOk()).rejects.toThrow(
      "已取消保存",
    );
    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.invoke).not.toHaveBeenCalledWith("desktop_reply", {
      accept: true,
    });
  });

  it("does not acknowledge exit when the backend write fails", async () => {
    mocks.files[0].config.filePath = "/project/pipeline.json";
    mocks.save.mockResolvedValue(false);
    requestClose();
    await expect(mocks.confirm.mock.calls[0][0].onOk()).rejects.toThrow(
      "保存 pipeline 失败",
    );
    expect(mocks.invoke).not.toHaveBeenCalledWith("desktop_reply", {
      accept: true,
    });
    await mocks.confirm.mock.calls[0][0].onCancel();
    expect(mocks.invoke).toHaveBeenCalledWith("desktop_reply", {
      accept: false,
    });
  });

  it("waits for a selected path and successful write before accepting exit", async () => {
    mocks.invoke.mockImplementation(async (command) =>
      command === "desktop_save_path" ? "/project/new.json" : undefined,
    );
    requestClose();
    await mocks.confirm.mock.calls[0][0].onOk();
    expect(mocks.save).toHaveBeenCalledWith(
      "/project/new.json",
      mocks.files[0],
    );
    expect(mocks.invoke).toHaveBeenLastCalledWith("desktop_reply", {
      accept: true,
    });
  });

  it("ignores repeated close requests while awaiting the user's choice", () => {
    requestClose();
    requestClose();
    expect(mocks.confirm).toHaveBeenCalledTimes(1);
  });
});
