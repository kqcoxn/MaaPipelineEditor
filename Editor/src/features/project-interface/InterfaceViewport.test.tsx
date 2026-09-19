import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useConfigStore } from "@/stores/app/configStore";
import { InterfaceViewport } from "./InterfaceViewport";
import { useMFWStore } from "@/stores/connection/mfwStore";
import { useInterfaceRunStore } from "./interfaceRunStore";
const mock = vi.hoisted(() => ({ screenshot: vi.fn() }));
vi.mock("@/services/server", () => ({ mfwProtocol: { requestScreencap: mock.screenshot } }));
beforeEach(() => {
  vi.useFakeTimers(); mock.screenshot.mockReset();
  useConfigStore.setState(s => ({ configs: { ...s.configs, liveScreenRefreshRate: 10 } }));
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  useMFWStore.setState({ controllerId: "one", connectionStatus: "connected" });
  useInterfaceRunStore.setState({ run: undefined });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });
describe("Interface device viewport", () => {
  it("serializes captures and cancels the request when leaving Interface", async () => {
    let resolve!: (value: { success: boolean; image: string }) => void;
    mock.screenshot.mockImplementation(() => new Promise(r => { resolve = r; }));
    const view = render(<InterfaceViewport />);
    expect(mock.screenshot).toHaveBeenCalledTimes(1);
    await act(async () => { vi.advanceTimersByTime(4000); });
    expect(mock.screenshot).toHaveBeenCalledTimes(1);
    await act(async () => { resolve({ success: true, image: "data:image/png;base64,first" }); });
    expect(screen.getByAltText("设备实时画面")).toHaveAttribute("src", "data:image/png;base64,first");
    await act(async () => { vi.advanceTimersByTime(800); });
    expect(mock.screenshot).toHaveBeenCalledTimes(2);
    const signal = mock.screenshot.mock.calls[1][1] as AbortSignal;
    view.unmount(); expect(signal.aborted).toBe(true);
    await act(async () => { resolve({ success: true, image: "late" }); vi.advanceTimersByTime(4000); });
    expect(mock.screenshot).toHaveBeenCalledTimes(2);
  });
  it("uses configured frame timing, subtracts capture time and responds to rate changes", async () => {
    mock.screenshot.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ success: true, image: "frame" }), 40)));
    render(<InterfaceViewport />);
    await act(async () => { await vi.advanceTimersByTimeAsync(99); });
    expect(mock.screenshot).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(mock.screenshot).toHaveBeenCalledTimes(2);
    act(() => { useConfigStore.setState(s => ({ configs: { ...s.configs, liveScreenRefreshRate: 20 } })); });
    expect(mock.screenshot).toHaveBeenCalledTimes(3);
    await act(async () => { await vi.advanceTimersByTimeAsync(49); });
    expect(mock.screenshot).toHaveBeenCalledTimes(3);
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(mock.screenshot).toHaveBeenCalledTimes(4);
  });
  it("does not retain another device's picture after the device changes", async () => {
    mock.screenshot.mockResolvedValue({ success: true, image: "data:image/png;base64,one" });
    render(<InterfaceViewport />);
    await act(async () => {});
    expect(screen.getByAltText("设备实时画面")).toBeInTheDocument();
    mock.screenshot.mockImplementation(() => new Promise(() => {}));
    act(() => { useMFWStore.setState({ controllerId: "two" }); });
    expect(screen.queryByAltText("设备实时画面")).not.toBeInTheDocument();
  });
});
