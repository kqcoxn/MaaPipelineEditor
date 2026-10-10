import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { newStep } from "./types";
import { RecorderHost } from "./RecorderHost";
import { useRecorderStore } from "./store";
import { useMFWStore } from "@/stores/connection/mfwStore";

const originalConnection = useMFWStore.getState();
beforeEach(() => {
  useMFWStore.setState({ connectionStatus: "connected", controllerId: "device" });
});

const io = vi.hoisted(() => ({ generate: vi.fn(), unmount: vi.fn() }));
vi.mock("./useRecorderLive", async () => {
  const { useEffect } = await import("react");
  return { useRecorderLive: () => {
    useEffect(() => () => io.unmount(), []);
    return { click: vi.fn() };
  } };
});
vi.mock("./useRecorderActions", () => ({
  useRecorderActions: () => ({ generate: io.generate }),
}));
afterEach(() => {
  cleanup();
  useRecorderStore.getState().reset();
  useMFWStore.setState({ connectionStatus: originalConnection.connectionStatus, controllerId: originalConnection.controllerId });
  vi.resetAllMocks();
});

it("opens without recording when disconnected and waits for manual start after connection", async () => {
  useMFWStore.setState({ connectionStatus: "disconnected", controllerId: null });
  render(<RecorderHost />);
  await act(async () => {
    useRecorderStore.getState().setOpen(true);
    await import("./RecorderWorkbench");
  });
  expect(await screen.findByRole("button", { name: /开始录制/ })).toBeDisabled();
  expect(useRecorderStore.getState().recording).toBe(false);
  act(() => {
    useMFWStore.setState({ connectionStatus: "connected", controllerId: "device" });
    useRecorderStore.getState().setLiveFrame({ image: "frame", width: 800, height: 600, controllerId: "device" });
  });
  expect(useRecorderStore.getState().recording).toBe(false);
  const start = screen.getByRole("button", { name: /开始录制/ });
  expect(start).toBeEnabled();
  fireEvent.click(start);
  expect(useRecorderStore.getState().recording).toBe(true);
});

it("does not mount while closed and clears an empty session on close", async () => {
  render(<RecorderHost />);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  await act(async () => {
    useRecorderStore.getState().setOpen(true);
    await import("./RecorderWorkbench");
  });
  await screen.findByRole("dialog");
  expect(useRecorderStore.getState().recording).toBe(true);
  act(() => useRecorderStore.getState().setLiveFrame({ image: "frame", width: 800, height: 600, controllerId: "device" }));
  fireEvent.click(screen.getByRole("button", { name: /close/i }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(io.unmount).toHaveBeenCalledTimes(1);
  expect(useRecorderStore.getState().liveFrame).toBeUndefined();
  expect(useRecorderStore.getState().recording).toBe(false);
});

it("cancels without losing steps, then clears and unmounts the session", async () => {
  const state = useRecorderStore.getState();
  state.setOpen(true);
  const step = newStep();
  state.appendCapture(step);
  const session = state.sessionId;
  render(<RecorderHost />);
  fireEvent.click(await screen.findByRole("button", { name: /close/i }));
  fireEvent.click(await screen.findByRole("button", { name: /取\s*消/ }));
  expect(useRecorderStore.getState().steps).toEqual([step]);
  expect(useRecorderStore.getState().recording).toBe(true);
  await waitFor(() => {
    const closing = screen.queryByText("结束本次录制？")?.closest('[role="dialog"]');
    if (closing) fireEvent.animationEnd(closing);
    expect(screen.queryByRole("button", { name: "清除并关闭" })).not.toBeInTheDocument();
  });
  fireEvent.click(screen.getByRole("button", { name: /close/i }));
  fireEvent.click(await screen.findByRole("button", { name: "清除并关闭" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(io.unmount).toHaveBeenCalledTimes(1);
  expect(useRecorderStore.getState().steps).toEqual([]);
  expect(useRecorderStore.getState().sessionId).not.toBe(session);
  await act(async () => {
    useRecorderStore.getState().setOpen(true);
    await import("./RecorderWorkbench");
  });
  await screen.findByRole("dialog");
  expect(useRecorderStore.getState().steps).toEqual([]);
  expect(useRecorderStore.getState().recording).toBe(true);
});

it("keeps the session after failed application and unmounts only after successful application", async () => {
  const state = useRecorderStore.getState();
  state.setOpen(true);
  const step = newStep();
  state.appendCapture(step);
  io.generate.mockResolvedValueOnce(undefined);
  render(<RecorderHost />);
  fireEvent.click(await screen.findByRole("button", { name: /close/i }));
  fireEvent.click(await screen.findByRole("button", { name: "应用并关闭" }));
  expect(io.generate).toHaveBeenCalledTimes(1);
  expect(useRecorderStore.getState().open).toBe(true);
  expect(useRecorderStore.getState().steps).toEqual([step]);
  io.generate.mockImplementationOnce(() => useRecorderStore.getState().reset());
  fireEvent.click(screen.getByRole("button", { name: "应用并关闭" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(io.unmount).toHaveBeenCalledTimes(1);
});

it("resumes recording from review even before a live frame is available", async () => {
  const state = useRecorderStore.getState();
  state.setOpen(true);
  const step = newStep();
  state.appendCapture(step);
  state.select(step.id);
  render(<RecorderHost />);
  const resume = await screen.findByRole("button", { name: /继续录制/ });
  expect(resume).toBeEnabled();
  fireEvent.click(resume);
  expect(useRecorderStore.getState().detailsOpen).toBe(false);
  expect(useRecorderStore.getState().recording).toBe(true);
  expect(useRecorderStore.getState().steps).toEqual([step]);
});
