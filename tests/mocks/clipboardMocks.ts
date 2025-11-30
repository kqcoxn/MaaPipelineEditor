import { vi } from "vitest";

/**
 * Clipboard API Mock
 */
export const mockClipboard = {
  writeText: vi.fn(() => Promise.resolve()),
  readText: vi.fn(() => Promise.resolve("")),
};

/**
 * 设置剪贴板读取返回值
 */
export const setClipboardText = (text: string) => {
  mockClipboard.readText.mockResolvedValue(text);
};

/**
 * 设置剪贴板写入失败
 */
export const setClipboardWriteError = (error: Error) => {
  mockClipboard.writeText.mockRejectedValue(error);
};

/**
 * 设置剪贴板读取失败
 */
export const setClipboardReadError = (error: Error) => {
  mockClipboard.readText.mockRejectedValue(error);
};

/**
 * 重置剪贴板 Mock
 */
export const resetClipboardMocks = () => {
  mockClipboard.writeText.mockClear();
  mockClipboard.readText.mockClear();
  mockClipboard.writeText.mockResolvedValue(undefined);
  mockClipboard.readText.mockResolvedValue("");
};
