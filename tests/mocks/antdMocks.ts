import { vi } from "vitest";

/**
 * Ant Design 消息 Mock
 */
export const mockMessage = {
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
  loading: vi.fn(),
};

/**
 * Ant Design 通知 Mock
 */
export const mockNotification = {
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
  open: vi.fn(),
};

/**
 * 重置所有 Ant Design Mock
 */
export const resetAntdMocks = () => {
  Object.values(mockMessage).forEach((fn) => fn.mockClear());
  Object.values(mockNotification).forEach((fn) => fn.mockClear());
};
