import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  staticMessageSuccess: vi.fn(),
  staticNotificationOpen: vi.fn(),
  staticModalConfirm: vi.fn(),
}));

vi.mock("antd", () => ({
  App: { useApp: vi.fn() },
  message: { success: mocks.staticMessageSuccess },
  notification: { open: mocks.staticNotificationOpen },
  Modal: { confirm: mocks.staticModalConfirm },
}));

import {
  message,
  modal,
  notification,
  setAntdAppApi,
} from "./antdAppApi";

describe("antdAppApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAntdAppApi(null);
  });

  afterEach(() => setAntdAppApi(null));

  it("uses static feedback APIs before the React bridge mounts", () => {
    message.success("saved");
    notification.open({ title: "notice" });
    modal.confirm({ title: "confirm" });

    expect(mocks.staticMessageSuccess).toHaveBeenCalledWith("saved");
    expect(mocks.staticNotificationOpen).toHaveBeenCalledWith({
      title: "notice",
    });
    expect(mocks.staticModalConfirm).toHaveBeenCalledWith({ title: "confirm" });
  });

  it("uses context-aware feedback APIs after the bridge mounts", () => {
    const contextMessageSuccess = vi.fn();
    const contextNotificationOpen = vi.fn();
    const contextModalConfirm = vi.fn();
    setAntdAppApi({
      message: { success: contextMessageSuccess },
      notification: { open: contextNotificationOpen },
      modal: { confirm: contextModalConfirm },
    } as never);

    message.success("saved");
    notification.open({ title: "notice" });
    modal.confirm({ title: "confirm" });

    expect(contextMessageSuccess).toHaveBeenCalledWith("saved");
    expect(contextNotificationOpen).toHaveBeenCalledWith({ title: "notice" });
    expect(contextModalConfirm).toHaveBeenCalledWith({ title: "confirm" });
    expect(mocks.staticMessageSuccess).not.toHaveBeenCalled();
    expect(mocks.staticNotificationOpen).not.toHaveBeenCalled();
    expect(mocks.staticModalConfirm).not.toHaveBeenCalled();
  });
});
