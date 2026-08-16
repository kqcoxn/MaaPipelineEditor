import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { App as AntdApp } from "antd";
import { harnessRunner, useAIHarnessStore } from "@/features/ai-harness";
import { useConfigStore } from "@/stores/app/configStore";
import AIHistoryPanel from "./AIHistoryPanel";

describe("AIHistoryPanel", () => {
  beforeEach(() => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    useAIHarnessStore.getState().reset();
    useConfigStore.getState().setStatus("showAIHistoryPanel", true);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    useConfigStore.getState().setStatus("showAIHistoryPanel", false);
  });

  it("新建并切换 Session", async () => {
    render(
      <AntdApp>
        <AIHistoryPanel />
      </AntdApp>,
    );

    fireEvent.click(await screen.findByLabelText("新建 Session"));
    expect(useAIHarnessStore.getState().sessions).toHaveLength(2);

    const firstSession = useAIHarnessStore.getState().sessions[1];
    const sessionItems = screen
      .getByLabelText("AI Session 列表")
      .querySelectorAll('[role="button"]');
    fireEvent.click(sessionItems[1]);
    expect(useAIHarnessStore.getState().activeSessionId).toBe(firstSession.id);
  });

  it("发送用户目标并交给 Harness Runner", async () => {
    const start = vi.spyOn(harnessRunner, "start").mockResolvedValue("run-test");
    render(
      <AntdApp>
        <AIHistoryPanel />
      </AntdApp>,
    );

    fireEvent.change(await screen.findByPlaceholderText("输入目标或问题"), {
      target: { value: "读取当前画布" },
    });
    fireEvent.click(screen.getByLabelText("发送"));

    await waitFor(() =>
      expect(start).toHaveBeenCalledWith(
        "读取当前画布",
        useAIHarnessStore.getState().activeSessionId,
      ),
    );
  });
});
