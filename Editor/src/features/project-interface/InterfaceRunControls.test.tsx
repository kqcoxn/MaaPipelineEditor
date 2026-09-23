import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { InterfaceRunControls } from "./InterfaceRunControls";
import { useInterfaceRunStore } from "./interfaceRunStore";
import { useProjectInterfaceStore as pi } from "./projectInterfaceStore";
import { emptyPreferences } from "./projectPreferences";
import { useWSStore } from "@/stores/connection/wsStore";
vi.mock("@/services/server", () => ({}));
afterEach(() => { cleanup(); useInterfaceRunStore.setState({ run: undefined, pending: undefined, stopRequested: false }); });
function setup() {
  pi.setState({ preferences: { ...emptyPreferences(), taskOrder: ["a", "b"], checkedTaskNames: ["b"] }, snapshot: {
    projectId: "p", revision: "r", projectRoot: "/p", interfaceRoot: "/p", entryPath: "/p/interface.json", language: "zh_cn",
    document: { task: [{ name: "a", label: "任务甲", entry: "A" }, { name: "b", label: "任务乙", entry: "B" }] },
  } });
}
it("shows the checked queue before any run exists", () => {
  setup();
  render(<InterfaceRunControls />);
  fireEvent.click(screen.getByText(/运行队列 ·/));
  const queue = screen.getByRole("list", { name: "待运行序列" });
  expect(within(queue).getByText(/任务乙/)).toBeTruthy();
  expect(within(queue).queryByText(/任务甲/)).toBeNull();
});
it("offers stop while waiting for the start acknowledgement", () => {
  setup();
  useWSStore.setState({ connected: true });
  useInterfaceRunStore.setState({ pending: { id: "start", kind: "start", signature: "s" } });
  render(<InterfaceRunControls />);
  fireEvent.click(screen.getByRole("button", { name: "停止运行" }));
  expect(useInterfaceRunStore.getState().stopRequested).toBe(true);
  expect((screen.getByRole("button", { name: "正在停止" }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.queryByRole("button", { name: "开始运行" })).toBeNull();
});
it("shows the running snapshot even when next-run selections change", () => {
  setup();
  useInterfaceRunStore.setState({ run: {
    runId: "run", requestId: "request", projectId: "p", revision: "r", controllerId: "device", controllerName: "设备", resourceName: "资源",
    status: "running", error: "Agent 连接失败", items: [{ name: "a", label: "任务甲", entry: "A", status: "running" }], logs: [], sequence: 1, startedAt: new Date().toISOString(),
  } });
  render(<InterfaceRunControls />);
  fireEvent.click(screen.getByText(/运行队列 ·/));
  const queue = screen.getByRole("list", { name: "本次运行序列" });
  expect(within(queue).getByText(/任务甲/)).toBeTruthy();
  expect(within(queue).queryByText(/任务乙/)).toBeNull();
  expect(screen.getByText("已完成 0 / 1")).toBeTruthy();
  expect(screen.getByRole("alert").textContent).toContain("Agent 连接失败");
});
