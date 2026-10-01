import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWSStore } from "@/stores/connection/wsStore";
import type { ConfigResponse } from "@/services/protocols/ConfigProtocol";
import BackendConfigPanel from "./BackendConfigPanel";
import { useBackendConfigRequests } from "./useBackendConfigRequests";

const mocks = vi.hoisted(() => ({
  configListeners: new Set<(data: ConfigResponse) => void>(),
  requestGetConfig: vi.fn(() => true),
  requestSetConfig: vi.fn(() => true),
  requestReload: vi.fn(() => true),
  requestStatus: vi.fn(() => true),
  isConnected: vi.fn(() => true),
  error: vi.fn(), warning: vi.fn(),
}));
vi.mock("@/services/server", () => ({
  localServer: { isConnected: mocks.isConnected },
  configProtocol: {
    requestGetConfig: mocks.requestGetConfig,
    requestSetConfig: mocks.requestSetConfig,
    requestReload: mocks.requestReload,
    onConfigData: (listener: (data: ConfigResponse) => void) => {
      mocks.configListeners.add(listener);
      return () => mocks.configListeners.delete(listener);
    },
    onReload: () => () => {},
  },
  interfaceProtocol: { requestStatus: mocks.requestStatus, onStatus: () => () => {} },
}));
vi.mock("@/utils/ui/antdAppApi", () => ({ message: { error: mocks.error, warning: mocks.warning }, modal: { info: vi.fn() } }));

describe("LocalBridge config panel lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isConnected.mockReturnValue(true);
    mocks.requestGetConfig.mockReturnValue(true);
    useWSStore.setState({ connected: true });
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it("does not reload or overwrite a draft when the parent rerenders", () => {
    const view = render(<BackendConfigPanel />);
    act(() => mocks.configListeners.forEach(listener => listener({
      success: true, config_path: "/config.yaml", config: {
        server: { host: "localhost", port: 9066 },
        file: { root: "/project", exclude: [], extensions: [".json"], max_depth: 10, max_files: 1000 },
        log: { level: "DEBUG", dir: "/logs", push_to_client: true },
        interface: { path: "" },
      },
    })));
    fireEvent.change(screen.getByLabelText("入口路径"), { target: { value: "../project/interface.json" } });
    view.rerender(<BackendConfigPanel />);
    view.rerender(<BackendConfigPanel />);
    expect(mocks.requestGetConfig).toHaveBeenCalledTimes(1);
    expect(mocks.requestStatus).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("入口路径")).toHaveValue("../project/interface.json");
    view.unmount();
    expect(mocks.configListeners.size).toBe(0);
  });

  it("waits for a connection and disables saving until fresh configuration arrives", () => {
    useWSStore.setState({ connected: false });
    render(<BackendConfigPanel />);
    expect(screen.getByText("连接本地服务后，可查看和修改后端配置。")).toBeInTheDocument();
    expect(mocks.requestGetConfig).not.toHaveBeenCalled();
    act(() => useWSStore.setState({ connected: true }));
    expect(screen.getByRole("button", { name: "保存配置" })).toBeDisabled();
    act(() => mocks.configListeners.forEach(listener => listener({
      success: true, config: {
        server: { host: "localhost", port: 9066 },
        file: { root: "/project", exclude: [], extensions: [".json"], max_depth: 10, max_files: 1000 },
        log: { level: "DEBUG", dir: "/logs", push_to_client: true },
        interface: { path: "" },
      },
    })));
    expect(screen.getByRole("button", { name: "保存配置" })).toBeEnabled();
    act(() => useWSStore.setState({ connected: false }));
    expect(mocks.configListeners.size).toBe(0);
    act(() => useWSStore.setState({ connected: true }));
    expect(screen.getByRole("button", { name: "保存配置" })).toBeDisabled();
    expect(mocks.requestGetConfig).toHaveBeenCalledTimes(2);
  });

  it("saves edits and keeps the inline form visible after applying the response", async () => {
    render(<BackendConfigPanel />);
    const config = {
      server: { host: "localhost", port: 9066 },
      file: { root: "/project", exclude: [], extensions: [".json"], max_depth: 10, max_files: 1000 },
      log: { level: "DEBUG", dir: "/logs", push_to_client: true },
      interface: { path: "" },
    };
    act(() => mocks.configListeners.forEach(listener => listener({ success: true, config })));
    fireEvent.change(screen.getByLabelText("主机"), { target: { value: "127.0.0.1" } });
    fireEvent.click(screen.getByRole("button", { name: "保存配置" }));
    await waitFor(() => expect(mocks.requestSetConfig).toHaveBeenCalledWith({
      ...config, server: { ...config.server, host: "127.0.0.1" },
    }));
    act(() => mocks.configListeners.forEach(listener => listener({ success: true, config, message: "已保存" })));
    expect(mocks.requestReload).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("主机")).toBeInTheDocument();
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
