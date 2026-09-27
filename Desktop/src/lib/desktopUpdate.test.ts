import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { updateDesktop } from "./desktopUpdate";
import type { InstallProgress } from "./installProgress";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
  Channel: class {
    onmessage = (_event: unknown) => {};
  },
}));

beforeEach(() => {
  vi.mocked(invoke).mockReset();
});

describe("desktop update progress", () => {
  it("shows download amounts and clears the bar for verification and installation", async () => {
    const states: InstallProgress[] = [];
    vi.mocked(invoke).mockImplementation(async (_command, args) => {
      const { onProgress } = args as {
        onProgress: { onmessage: (event: unknown) => void };
      };
      for (const event of [
        { phase: "downloading", downloaded: 0 },
        {
          phase: "downloading",
          downloaded: 512,
          total: 1024,
          bytesPerSecond: 256,
          elapsedSeconds: 2,
        },
        { phase: "downloading", downloaded: 1024, total: null },
        { phase: "verifying" },
        { phase: "installing" },
      ])
        onProgress.onmessage({ artifact: "desktop", ...event });
      return "完成";
    });
    await expect(updateDesktop((state) => states.push(state))).resolves.toBe(
      "完成",
    );
    expect(states[0].text).toContain("等待下载响应");
    expect(states[1]).toEqual({
      text: "MPE Desktop：512.0 B / 1.0 KiB（50.0%） · 256.0 B/s · 已用 2s",
      download: { label: "MPE Desktop下载进度", percent: 50 },
    });
    expect(states[2].text).toContain("1.0 KiB（总大小未知）");
    expect(states[2].download?.percent).toBeUndefined();
    expect(states[3]).toEqual({ text: "MPE Desktop 下载完成，正在校验更新包" });
    expect(states[4]).toEqual({
      text: "正在安装 MPE Desktop，安装完成后将重启",
    });
  });

  it("ignores queued progress after failure and isolates the next attempt", async () => {
    const channels: Array<{ onmessage: (event: unknown) => void }> = [];
    vi.mocked(invoke).mockImplementation(async (_command, args) => {
      const { onProgress } = args as { onProgress: (typeof channels)[number] };
      channels.push(onProgress);
      if (channels.length === 1) throw new Error("连接中断");
      channels[0].onmessage({ artifact: "desktop", phase: "installing" });
      onProgress.onmessage({
        artifact: "desktop",
        phase: "downloading",
        downloaded: 0,
      });
      return "已是最新版";
    });
    const first = vi.fn();
    await expect(updateDesktop(first)).rejects.toThrow("连接中断");
    const retry = vi.fn();
    await updateDesktop(retry);
    channels[1].onmessage({ artifact: "desktop", phase: "installing" });
    expect(first).not.toHaveBeenCalled();
    expect(retry).toHaveBeenCalledTimes(1);
    expect(retry.mock.calls[0][0].text).toContain("等待下载响应");
  });
});
