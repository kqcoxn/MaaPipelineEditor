import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { InterfaceMonitor } from "./InterfaceMonitor";
import { useInterfaceRunStore } from "./interfaceRunStore";

vi.mock("@/services/server", () => ({}));
vi.mock("./InterfaceViewport", () => ({ InterfaceViewport: () => null }));
afterEach(() => { cleanup(); useInterfaceRunStore.setState({ run: undefined }); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("displays and exports focus and print contents as plain text", () => {
  const text = "**消息** <b>{name}</b>\nhttps://example.com $模板";
  useInterfaceRunStore.setState({ run: {
    runId: "run", requestId: "request", projectId: "p", revision: "r", controllerId: "device", controllerName: "c", resourceName: "r",
    status: "running", items: [], sequence: 2, startedAt: "2026-09-23T00:00:00Z",
    logs: [1, 2].map(sequence => ({ sequence, time: "2026-09-23T00:00:00Z", message: text })),
  } });
  const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  const blob = vi.fn(function () {});
  vi.stubGlobal("Blob", blob);
  render(<InterfaceMonitor />);
  const output = screen.getByLabelText("日志内容");
  expect(output.querySelectorAll("b, a").length).toBe(0);
  expect(output.textContent?.split(text).length).toBe(3);
  expect(screen.queryByRole("combobox", { name: "日志级别" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "导出运行日志" }));
  expect(createObjectURL).toHaveBeenCalledOnce();
  expect(blob).toHaveBeenCalledWith([`${text}\n${text}`], { type: "text/plain;charset=utf-8" });
});
