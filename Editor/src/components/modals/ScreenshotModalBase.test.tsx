import { emitAchievementEvent } from "@/features/achievements/bus";
import { StrictMode } from "react";
import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ScreenshotModalBase } from "./ScreenshotModalBase";

const { requestScreencap } = vi.hoisted(() => ({
  requestScreencap: vi.fn(),
}));

vi.mock("@/stores/connection/mfwStore", () => ({
  useMFWStore: () => ({
    connectionStatus: "connected",
    controllerId: "controller-1",
  }),
}));

vi.mock("@/stores/app/configStore", () => ({
  getScreenshotResolutionParams: () => ({}),
  useConfigStore: <T,>(selector: (state: { configs: Record<string, number> }) => T) =>
    selector({
      configs: {
        screenshotResolutionMode: 0,
        screenshotResolutionValue: 0,
      },
    }),
}));

vi.mock("../../services/server", () => ({
  mfwProtocol: { requestScreencap },
}));

vi.mock("@/features/achievements/bus", () => ({ emitAchievementEvent: vi.fn() }));

describe("ScreenshotModalBase", () => {
  it.each([true, false])("截图成功状态为 %s 时仅成功取图计数", async (success) => {
    requestScreencap.mockResolvedValue({ success, image: success ? "data:image/png;base64,test" : undefined });
    const changed = vi.fn();
    const { unmount } = render(<ScreenshotModalBase open onClose={vi.fn()} title="截图" onConfirm={vi.fn()} renderCanvas={() => null} onScreenshotChange={changed} />);
    await waitFor(() => expect(requestScreencap).toHaveBeenCalledTimes(1));
    if (success) {
      await waitFor(() => expect(changed).toHaveBeenCalledWith("data:image/png;base64,test", "device"));
      expect(emitAchievementEvent).toHaveBeenCalledExactlyOnceWith("achievement:tool_screenshot_captured");
    } else {
      expect(emitAchievementEvent).not.toHaveBeenCalled();
    }
    unmount();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("在 StrictMode 下首次打开只发起一次截图", async () => {
    requestScreencap.mockReturnValue(new Promise(() => undefined));

    const { unmount } = render(
      <StrictMode>
        <ScreenshotModalBase
          open
          onClose={vi.fn()}
          title="截图"
          onConfirm={vi.fn()}
          renderCanvas={() => null}
        />
      </StrictMode>,
    );

    await waitFor(() => {
      expect(requestScreencap).toHaveBeenCalledTimes(1);
    });

    unmount();
  });
});
