import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import RecorderWorkbench from "./RecorderWorkbench";
import { useRecorderStore } from "./store";
vi.mock("./useRecorderLive", () => ({
  useRecorderLive: () => ({ click: vi.fn() }),
}));
vi.mock("./useRecorderActions", () => ({
  useRecorderActions: () => ({
    candidates: [],
    save: vi.fn(),
    refresh: vi.fn(),
    run: vi.fn(),
    generate: vi.fn(),
  }),
}));
afterEach(() => {
  cleanup();
  useRecorderStore.getState().reset();
});
it("closes the dialog, restores background interaction, and reopens the retained session", async () => {
  const underlyingClick = vi.fn(),
    ancestorMouse = vi.fn();
  useRecorderStore.getState().reset();
  useRecorderStore.getState().setOpen(true);
  useRecorderStore.getState().edit({ expected: "保留编辑" });
  render(
    <div onMouseDown={ancestorMouse}>
      <button onClick={underlyingClick}>主页面操作</button>
      <RecorderWorkbench />
    </div>,
  );
  const dialog = await screen.findByRole("dialog");
  fireEvent.mouseDown(dialog);
  expect(ancestorMouse).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: /close/i }));
  await waitFor(() => {
    const closing = screen.queryByRole("dialog");
    if (closing) fireEvent.animationEnd(closing);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  fireEvent.click(screen.getByText("主页面操作"));
  expect(underlyingClick).toHaveBeenCalledTimes(1);
  expect(useRecorderStore.getState().current.config.expected).toBe("保留编辑");
  act(() => useRecorderStore.getState().setOpen(true));
  expect(await screen.findByRole("dialog")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /close/i }));
  await waitFor(() => {
    const closing = screen.queryByRole("dialog");
    if (closing) fireEvent.animationEnd(closing);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
