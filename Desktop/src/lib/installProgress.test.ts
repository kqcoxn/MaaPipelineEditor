import { describe, expect, it } from "vitest";
import { parseInstallProgress } from "./installProgress";

describe("install progress", () => {
  it("shows byte progress for the current artifact and clears it for verification", () => {
    const result = parseInstallProgress(
      JSON.stringify({
        phase: "downloading",
        artifact: "editor",
        downloaded: 512,
        total: 1024,
        bytesPerSecond: 256,
        elapsedSeconds: 2,
      }),
    );
    expect(result.download).toEqual({ label: "Editor下载进度", percent: 50 });
    expect(result.text).toContain("512.0 B / 1.0 KiB（50.0%）");
    expect(result.text).toContain("256.0 B/s");
    expect(parseInstallProgress('{"phase":"verifying"}')).toEqual({
      text: "正在校验与解压",
    });
  });

  it("keeps unknown lengths indeterminate, including a completed transfer", () => {
    const waiting = parseInstallProgress(
      '{"phase":"downloading","downloaded":0,"total":0,"elapsedSeconds":10}',
    );
    expect(waiting.text).toContain("等待下载响应");
    expect(waiting.text).toContain("已用 10s");
    const streaming = parseInstallProgress(
      '{"phase":"downloading","downloaded":2048,"total":0}',
    );
    expect(streaming.download?.percent).toBeUndefined();
    expect(streaming.text).toContain("2.0 KiB（总大小未知）");
    expect(streaming.text).not.toContain("%");
  });

  it("preserves plain messages and tolerates malformed event data", () => {
    expect(parseInstallProgress("连接失败")).toEqual({ text: "连接失败" });
    for (const value of [
      "null",
      '{"phase":"downloading","downloaded":-1}',
      '{"phase":"downloading","downloaded":"1"}',
    ]) {
      expect(parseInstallProgress(value).download).toBeUndefined();
    }
  });
});
