import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import LiveScreenPanel from "./LiveScreenPanel";

const { clearConnection, requestScreencap } = vi.hoisted(() => ({
  clearConnection: vi.fn(),
  requestScreencap: vi.fn(),
}));

vi.mock("@/stores/connection/mfwStore", () => ({
  useMFWStore: <T,>(
    selector: (state: {
      connectionStatus: string;
      controllerId: string;
      clearConnection: () => void;
    }) => T,
  ) =>
    selector({
      connectionStatus: "connected",
      controllerId: "controller-1",
      clearConnection,
    }),
}));

vi.mock("@/stores/app/configStore", () => ({
  getLiveScreenFrameInterval: () => 1000 / 15,
  useConfigStore: <T,>(
    selector: (state: {
      configs: {
        enableLiveScreen: boolean;
        liveScreenRefreshRate: number;
      };
    }) => T,
  ) =>
    selector({
      configs: {
        enableLiveScreen: true,
        liveScreenRefreshRate: 15,
      },
    }),
}));

vi.mock("../../../hooks/usePanelOccupancy", () => ({
  usePanelOccupancy: () => ({ isDisplaced: false }),
}));

vi.mock("../../../services/server", () => ({
  mfwProtocol: { requestScreencap },
}));

describe("LiveScreenPanel", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("将实时画面截图标记为后台请求", async () => {
    requestScreencap.mockReturnValue(new Promise(() => undefined));

    const { unmount } = render(<LiveScreenPanel />);

    await waitFor(() => {
      expect(requestScreencap).toHaveBeenCalledWith(
        {
          controller_id: "controller-1",
          background: true,
          output_long_side: 400,
        },
        expect.any(AbortSignal),
      );
    });

    unmount();
  });

  it("被主动截图接管时仅跳帧，不累计失败或断开连接", async () => {
    requestScreencap.mockResolvedValue({
      success: false,
      error: "screencap skipped",
    });

    const { unmount } = render(<LiveScreenPanel />);

    await waitFor(
      () => {
        expect(requestScreencap).toHaveBeenCalledTimes(4);
      },
      { timeout: 2000 },
    );

    expect(clearConnection).not.toHaveBeenCalled();
    expect(screen.queryByText("截图异常")).not.toBeInTheDocument();
    unmount();
  });
});
