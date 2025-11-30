import { describe, it, expect, vi, beforeEach } from "vitest";
import { ClipboardHelper } from "../clipboard";
import { message, notification } from "antd";

// Mock antd 消息组件
vi.mock("antd", async () => {
  const actual = await vi.importActual("antd");
  return {
    ...actual,
    message: {
      success: vi.fn(),
      error: vi.fn(),
    },
    notification: {
      error: vi.fn(),
    },
  };
});

describe("ClipboardHelper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 重置 clipboard mock
    navigator.clipboard.writeText = vi.fn(() => Promise.resolve());
    navigator.clipboard.readText = vi.fn(() => Promise.resolve(""));
  });

  describe("write", () => {
    it("应该成功写入字符串到剪贴板", async () => {
      const testString = "test content";
      const result = await ClipboardHelper.write(testString);

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(testString);
      expect(message.success).toHaveBeenCalledWith("已成功复制到粘贴板");
      expect(result).toBe(true);
    });

    it("应该将对象转换为 JSON 字符串后写入", async () => {
      const testObj = { key: "value", number: 123 };
      const result = await ClipboardHelper.write(testObj);

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        JSON.stringify(testObj)
      );
      expect(message.success).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it("应该使用自定义成功消息", async () => {
      const customMsg = "复制成功！";
      await ClipboardHelper.write("test", { successMsg: customMsg });

      expect(message.success).toHaveBeenCalledWith(customMsg);
    });

    it("应该处理写入失败的情况", async () => {
      const error = new Error("Clipboard write failed");
      navigator.clipboard.writeText = vi.fn(() => Promise.reject(error));

      const result = await ClipboardHelper.write("test");

      expect(notification.error).toHaveBeenCalledWith({
        message: "复制到粘贴板失败",
        description: String(error),
        placement: "top",
      });
      expect(result).toBe(false);
    });

    it("应该使用自定义错误消息", async () => {
      const customErrorMsg = "写入失败";
      navigator.clipboard.writeText = vi.fn(() =>
        Promise.reject(new Error("Error"))
      );

      await ClipboardHelper.write("test", { errorMsg: customErrorMsg });

      expect(notification.error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: customErrorMsg,
        })
      );
    });

    it("应该处理复杂对象", async () => {
      const complexObj = {
        nested: { deep: { value: "test" } },
        array: [1, 2, 3],
        boolean: true,
      };

      await ClipboardHelper.write(complexObj);

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        JSON.stringify(complexObj)
      );
    });
  });

  describe("read", () => {
    it("应该成功读取剪贴板内容", async () => {
      const testText = "clipboard content";
      navigator.clipboard.readText = vi.fn(() => Promise.resolve(testText));

      const result = await ClipboardHelper.read();

      expect(navigator.clipboard.readText).toHaveBeenCalled();
      expect(result).toBe(testText);
    });

    it("应该在提供 successMsg 时显示成功消息", async () => {
      const successMsg = "读取成功";
      navigator.clipboard.readText = vi.fn(() => Promise.resolve("test"));

      await ClipboardHelper.read({ successMsg });

      expect(message.success).toHaveBeenCalledWith(successMsg);
    });

    it("应该在未提供 successMsg 时不显示消息", async () => {
      navigator.clipboard.readText = vi.fn(() => Promise.resolve("test"));

      await ClipboardHelper.read();

      expect(message.success).not.toHaveBeenCalled();
    });

    it("应该处理读取失败的情况", async () => {
      const error = new Error("Clipboard read failed");
      navigator.clipboard.readText = vi.fn(() => Promise.reject(error));

      const result = await ClipboardHelper.read();

      expect(notification.error).toHaveBeenCalledWith({
        message: "读取粘贴板失败",
        description: String(error),
        placement: "top",
      });
      expect(result).toBe("");
    });

    it("应该使用自定义错误消息", async () => {
      const customErrorMsg = "无法读取";
      navigator.clipboard.readText = vi.fn(() =>
        Promise.reject(new Error("Error"))
      );

      await ClipboardHelper.read({ errorMsg: customErrorMsg });

      expect(notification.error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: customErrorMsg,
        })
      );
    });

    it("应该读取空字符串", async () => {
      navigator.clipboard.readText = vi.fn(() => Promise.resolve(""));

      const result = await ClipboardHelper.read();

      expect(result).toBe("");
    });
  });

  describe("集成测试", () => {
    it("应该完成写入和读取的完整流程", async () => {
      const testContent = "integration test content";

      // 写入
      await ClipboardHelper.write(testContent);
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(testContent);

      // 模拟读取刚写入的内容
      navigator.clipboard.readText = vi.fn(() => Promise.resolve(testContent));
      const result = await ClipboardHelper.read();

      expect(result).toBe(testContent);
    });

    it("应该处理 JSON 对象的完整流程", async () => {
      const testObj = { name: "test", data: [1, 2, 3] };
      const jsonString = JSON.stringify(testObj);

      // 写入对象
      await ClipboardHelper.write(testObj);
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(jsonString);

      // 读取 JSON 字符串
      navigator.clipboard.readText = vi.fn(() => Promise.resolve(jsonString));
      const result = await ClipboardHelper.read();

      expect(JSON.parse(result)).toEqual(testObj);
    });
  });
});
