import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { clearFeedback, setError, setNotice } from "./feedback";

beforeEach(() => {
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
    setTimeout(() => callback(0), 0),
  );
  vi.stubGlobal("cancelAnimationFrame", clearTimeout);
});
afterEach(() => {
  toast.dismiss();
  vi.unstubAllGlobals();
});

describe("launcher notifications", () => {
  it("keeps actionable and pending notices until the same workflow replaces them", () => {
    setNotice("需要手动安装", "action", "environment");
    setNotice("Token 已保存", "success", "token");
    expect(toast.getToasts()).toMatchObject([
      { title: "需要手动安装", duration: Infinity },
      { title: "Token 已保存", duration: 4500 },
    ]);
    setNotice("正在安装", "pending", "environment");
    expect(toast.getToasts()).toMatchObject([
      { title: "正在安装", duration: Infinity },
      { title: "Token 已保存" },
    ]);
    setError("安装失败", "environment");
    setNotice("Token 已清除", "success", "token");
    expect(toast.getToasts()).toMatchObject([
      { type: "error", duration: Infinity },
      { title: "Token 已清除", type: "success" },
    ]);
    clearFeedback("token");
    expect(toast.getToasts()).toMatchObject([
      { type: "error", duration: Infinity },
    ]);
    expect(toast.getToasts()).toHaveLength(1);
  });
  it("replaces an earlier result, including its error details and persistent duration", () => {
    setError("download failed");
    expect(toast.getToasts()).toMatchObject([
      { type: "error", duration: Infinity },
    ]);
    setNotice("更新完成", "success");
    expect(toast.getToasts()).toMatchObject([
      {
        title: "更新完成",
        type: "success",
        duration: 4500,
        description: undefined,
      },
    ]);
    expect(toast.getToasts()).toHaveLength(1);
  });

  it("shows the same message again after dismissal without retaining the previous operation", () => {
    setNotice("Token 已保存", "success");
    clearFeedback();
    expect(toast.getToasts()).toHaveLength(0);
    setNotice("Token 已保存", "success");
    expect(toast.getToasts()).toMatchObject([
      { title: "Token 已保存", type: "success" },
    ]);
    expect(toast.getToasts()).toHaveLength(1);
  });
});
