import { beforeEach, describe, expect, it, vi } from "vitest";

const host = vi.hoisted(() => ({
  desktopContext: {} as object | undefined,
  desktopInvoke: vi.fn(),
}));
vi.mock("@/features/desktop/host", () => host);
vi.mock("@/services/server", () => ({ localServer: { getAddress: () => "ws://localhost:9066" } }));
import { saveLogArchive } from "./logArchive";

describe("log archive saving", () => {
  beforeEach(() => {
    host.desktopContext = {};
    host.desktopInvoke.mockReset();
  });
  it("returns the native destination only after saving completes", async () => {
    host.desktopInvoke.mockResolvedValue("D:\\logs\\mpe.zip");
    expect(await saveLogArchive("/diagnostics/test", "mpe.zip")).toEqual({
      path: "D:\\logs\\mpe.zip",
    });
    expect(host.desktopInvoke).toHaveBeenCalledWith("desktop_save_archive", {
      name: "mpe.zip",
      downloadPath: "/diagnostics/test",
    });
  });
  it("does not fall back to a browser download when the dialog is cancelled", async () => {
    host.desktopInvoke.mockResolvedValue(null);
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click");
    expect(await saveLogArchive("/diagnostics/test", "mpe.zip")).toBeNull();
    expect(click).not.toHaveBeenCalled();
    click.mockRestore();
  });
  it("propagates write errors instead of reporting success", async () => {
    host.desktopInvoke.mockRejectedValue(new Error("磁盘已满"));
    await expect(saveLogArchive("/diagnostics/test", "mpe.zip")).rejects.toThrow(
      "磁盘已满",
    );
  });
  it("keeps browser downloads working", async () => {
    host.desktopContext = undefined;
    vi.useFakeTimers();
    const archive = new Blob([new Uint8Array([80, 75, 5, 6])], { type: "application/zip" });
    const download = vi.fn().mockResolvedValue({ ok: true, blob: async () => archive });
    vi.stubGlobal("fetch", download);
    const create = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:logs");
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    try {
      expect(await saveLogArchive("/diagnostics/test", "mpe.zip")).toEqual({});
      expect(String(download.mock.calls[0][0])).toBe("http://localhost:9066/diagnostics/test");
      expect(create).toHaveBeenCalledWith(archive);
      expect(click).toHaveBeenCalledOnce();
      expect(host.desktopInvoke).not.toHaveBeenCalled();
      vi.runAllTimers();
      expect(revoke).toHaveBeenCalledWith("blob:logs");
    } finally {
      click.mockRestore();
      create.mockRestore();
      revoke.mockRestore();
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });
  it("does not download a partial archive or an invalid ticket", async () => {
    host.desktopContext = undefined;
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const download = vi.fn().mockResolvedValue({ ok: false });
    vi.stubGlobal("fetch", download);
    try {
      await expect(saveLogArchive("https://example.com", "mpe.zip")).rejects.toThrow("无效");
      expect(download).not.toHaveBeenCalled();
      await expect(saveLogArchive("/diagnostics/test", "mpe.zip")).rejects.toThrow("日志下载失败");
      download.mockResolvedValue({ ok: true, blob: async () => { throw new Error("连接中断"); } });
      await expect(saveLogArchive("/diagnostics/test", "mpe.zip")).rejects.toThrow("连接中断");
      expect(click).not.toHaveBeenCalled();
    } finally {
      click.mockRestore();
      vi.unstubAllGlobals();
    }
  });
});
