import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWSStore } from "@/stores/connection/wsStore";
import type { ConfigResponse } from "@/services/protocols/ConfigProtocol";
import BackendConfigModal from "./BackendConfigModal";
import { useBackendConfigRequests } from "./useBackendConfigRequests";

const mocks = vi.hoisted(() => ({
  configListeners: new Set<(data: ConfigResponse) => void>(),
  requestGetConfig: vi.fn(() => true),
  requestStatus: vi.fn(() => true),
  isConnected: vi.fn(() => true),
  error: vi.fn(), warning: vi.fn(),
}));
vi.mock("@/services/server", () => ({
  localServer: { isConnected: mocks.isConnected },
  configProtocol: {
    requestGetConfig: mocks.requestGetConfig,
    onConfigData: (listener: (data: ConfigResponse) => void) => {
      mocks.configListeners.add(listener);
      return () => mocks.configListeners.delete(listener);
    },
    onReload: () => () => {},
  },
  interfaceProtocol: { requestStatus: mocks.requestStatus, onStatus: () => () => {} },
}));
vi.mock("@/utils/ui/antdAppApi", () => ({ message: { error: mocks.error, warning: mocks.warning }, modal: { info: vi.fn() } }));

describe("LocalBridge config dialog lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isConnected.mockReturnValue(true);
    mocks.requestGetConfig.mockReturnValue(true);
    useWSStore.setState({ connected: true });
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it("does not reload or overwrite a draft when the parent supplies a new close callback", () => {
    const view = render(<BackendConfigModal open onClose={() => {}} />);
    act(() => mocks.configListeners.forEach(listener => listener({
      success: true, config_path: "/config.yaml", config: {
        server: { host: "localhost", port: 9066 },
        file: { root: "/project", exclude: [], extensions: [".json"], max_depth: 10, max_files: 1000 },
        log: { level: "DEBUG", dir: "/logs", push_to_client: true },
        maafw: { enabled: true }, interface: { path: "" },
      },
    })));
    fireEvent.change(screen.getByLabelText("入口路径"), { target: { value: "../project/interface.json" } });
    view.rerender(<BackendConfigModal open onClose={() => {}} />);
    view.rerender(<BackendConfigModal open onClose={() => {}} />);
    expect(mocks.requestGetConfig).toHaveBeenCalledTimes(1);
    expect(mocks.requestStatus).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("入口路径")).toHaveValue("../project/interface.json");
    view.unmount();
    expect(mocks.configListeners.size).toBe(0);
  });

  it("stops loading on send failure and allows a retry after timeout", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useBackendConfigRequests(true));
    act(() => result.current.startRequest("loading", () => false));
    expect(result.current.loading).toBe(false);
    act(() => result.current.startRequest("loading", () => true));
    expect(result.current.loading).toBe(true);
    act(() => vi.advanceTimersByTime(10000));
    expect(result.current.loading).toBe(false);
    expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining("超时"));
    act(() => result.current.startRequest("loading", () => true));
    act(() => result.current.finishRequest("loading"));
    expect(result.current.loading).toBe(false);
  });

  it("cleans up pending requests on disconnect and close", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ open }) => useBackendConfigRequests(open), { initialProps: { open: true } });
    act(() => result.current.startRequest("saving", () => true));
    act(() => useWSStore.setState({ connected: false }));
    expect(result.current.saving).toBe(false);
    act(() => vi.advanceTimersByTime(10000));
    expect(mocks.error).not.toHaveBeenCalled();
    act(() => useWSStore.setState({ connected: true }));
    act(() => result.current.startRequest("reloading", () => true));
    rerender({ open: false });
    expect(result.current.reloading).toBe(false);
    act(() => vi.advanceTimersByTime(10000));
    expect(mocks.error).not.toHaveBeenCalled();
  });
});
