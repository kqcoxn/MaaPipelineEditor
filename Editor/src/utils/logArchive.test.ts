import { beforeEach, describe, expect, it, vi } from "vitest";

const host = vi.hoisted(() => ({
  desktopContext: {} as object | undefined,
  desktopInvoke: vi.fn(),
}));
vi.mock("@/features/desktop/host", () => host);
import { saveLogArchive } from "./logArchive";

describe("log archive saving", () => {
  beforeEach(() => {
    host.desktopContext = {};
    host.desktopInvoke.mockReset();
  });
  it("returns the native destination only after saving completes", async () => {
    host.desktopInvoke.mockResolvedValue("D:\\logs\\mpe.zip");
    expect(await saveLogArchive("base64", "mpe.zip")).toEqual({
      path: "D:\\logs\\mpe.zip",
    });
    expect(host.desktopInvoke).toHaveBeenCalledWith("desktop_save_archive", {
      name: "mpe.zip",
      content: "base64",
    });
  });
  it("does not fall back to a browser download when the dialog is cancelled", async () => {
    host.desktopInvoke.mockResolvedValue(null);
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click");
    expect(await saveLogArchive("base64", "mpe.zip")).toBeNull();
    expect(click).not.toHaveBeenCalled();
    click.mockRestore();
  });
  it("propagates write errors instead of reporting success", async () => {
    host.desktopInvoke.mockRejectedValue(new Error("磁盘已满"));
    await expect(saveLogArchive("base64", "mpe.zip")).rejects.toThrow(
      "磁盘已满",
    );
  });
  it("keeps browser downloads working", async () => {
    host.desktopContext = undefined;
    vi.useFakeTimers();
    const create = vi.fn(() => "blob:logs");
    const revoke = vi.fn();
    vi.stubGlobal("URL", { createObjectURL: create, revokeObjectURL: revoke });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    try {
      expect(await saveLogArchive("UEsFBg==", "mpe.zip")).toEqual({});
      expect(click).toHaveBeenCalledOnce();
      expect(host.desktopInvoke).not.toHaveBeenCalled();
      vi.runAllTimers();
      expect(revoke).toHaveBeenCalledWith("blob:logs");
    } finally {
      click.mockRestore();
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });
});
