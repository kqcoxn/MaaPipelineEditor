import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InterfaceViewport } from "./InterfaceViewport";
import { useMFWStore } from "@/stores/connection/mfwStore";
import { useInterfaceRunStore } from "./interfaceRunStore";
const mock = vi.hoisted(() => ({ screenshot: vi.fn() }));
vi.mock("@/services/server", () => ({ mfwProtocol: { requestScreencap: mock.screenshot } }));
beforeEach(() => {
  vi.useFakeTimers(); mock.screenshot.mockReset();
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
