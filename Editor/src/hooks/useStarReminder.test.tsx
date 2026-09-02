import { StrictMode } from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEmbedStore } from "@/stores/embed/embedStore";
import { useNewcomerStore } from "@/stores/ui/newcomerStore";

const notificationMocks = vi.hoisted(() => ({
  destroy: vi.fn(),
  open: vi.fn(),
}));

vi.mock("@ant-design/icons", () => ({
  GithubOutlined: () => null,
}));
vi.mock("antd", () => ({
  App: {
    useApp: () => ({ notification: notificationMocks }),
  },
  Button: () => null,
  Flex: () => null,
}));

import {
  resolveStarReminderTargets,
  useStarReminder,
} from "./useStarReminder";

const targets = [
  {
    id: "mpe" as const,
    name: "MaaPipelineEditor",
    repositoryUrl: "https://github.com/kqcoxn/MaaPipelineEditor",
  },
  {
    id: "mse" as const,
    name: "Maa Pipeline Support",
    repositoryUrl: "https://github.com/neko-para/maa-support-extension",
  },
];

describe("resolveStarReminderTargets", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("shows both repository links when only MSE is pending", () => {
    localStorage.setItem("mpe_stared", "true");

    expect(resolveStarReminderTargets(targets)?.map((target) => target.id)).toEqual(
      ["mpe", "mse"],
    );
  });

  it("does not show a reminder after both projects are handled", () => {
    localStorage.setItem("mpe_stared", "true");
    localStorage.setItem("_mse_stared", "true");

    expect(resolveStarReminderTargets(targets)).toBeNull();
  });
});

describe("useStarReminder", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    notificationMocks.destroy.mockClear();
    notificationMocks.open.mockClear();
    useEmbedStore.getState().reset();
    useNewcomerStore.setState({ passed: true });
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("keeps one interval and one visibility listener across StrictMode remounts", () => {
    const addListener = vi.spyOn(document, "addEventListener");
    const removeListener = vi.spyOn(document, "removeEventListener");
    const setIntervalSpy = vi.spyOn(window, "setInterval");
    const clearIntervalSpy = vi.spyOn(window, "clearInterval");

    const view = renderHook(() => useStarReminder(false), {
      wrapper: StrictMode,
    });

    expect(setIntervalSpy).toHaveBeenCalledTimes(2);
    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
    expect(
      addListener.mock.calls.filter(([type]) => type === "visibilitychange"),
    ).toHaveLength(2);
    expect(
      removeListener.mock.calls.filter(([type]) => type === "visibilitychange"),
    ).toHaveLength(1);

    view.unmount();

    expect(clearIntervalSpy).toHaveBeenCalledTimes(2);
    expect(
      removeListener.mock.calls.filter(([type]) => type === "visibilitychange"),
    ).toHaveLength(2);
  });

  it("does not wake in the background and restarts after becoming visible", () => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    const setIntervalSpy = vi.spyOn(window, "setInterval");
    const clearIntervalSpy = vi.spyOn(window, "clearInterval");

    const view = renderHook(() => useStarReminder(false));
    expect(setIntervalSpy).not.toHaveBeenCalled();

    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(setIntervalSpy).toHaveBeenCalledOnce();

    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(clearIntervalSpy).toHaveBeenCalledOnce();

    view.unmount();
    expect(clearIntervalSpy).toHaveBeenCalledOnce();
  });
});
