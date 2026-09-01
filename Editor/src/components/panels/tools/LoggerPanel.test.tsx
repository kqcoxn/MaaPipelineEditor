import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useLoggerStore } from "@/stores/app/loggerStore";
import { useOperationLogStore } from "@/stores/flow/operationLogStore";
import { useWSStore } from "@/stores/connection/wsStore";
import { LoggerPanel } from "./LoggerPanel";

async function waitForAnimationFrames() {
  await act(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
}

function setScrollPosition(holder: HTMLElement, scrollTop: number) {
  Object.defineProperties(holder, {
    clientHeight: { configurable: true, value: 308 },
    scrollHeight: { configurable: true, value: 4800 },
  });
  holder.scrollTop = scrollTop;
  fireEvent.scroll(holder);
}

function createOperationLogs(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `operation-${index}`,
    timestamp: index,
    category: "node" as const,
    action: "update",
    description: `Operation ${index}`,
  }));
}

describe("LoggerPanel", () => {
  afterEach(() => {
    cleanup();
    useLoggerStore.setState({ logs: [], importantLogs: [], expanded: false });
    useOperationLogStore.setState({ logs: [] });
    useWSStore.setState({ connected: false, connecting: false });
  });

  it("用户向上查看时新增日志不抢回底部", async () => {
    const logs = createOperationLogs(100);
    useLoggerStore.setState({ expanded: true });
    useOperationLogStore.setState({ logs });
    render(<LoggerPanel />);

    const list = await screen.findByRole("list", { name: /操作记录，共 100 条/ });
    const holder = list.querySelector<HTMLElement>(".rc-virtual-list-holder")!;
    setScrollPosition(holder, 1200);

    act(() => {
      useOperationLogStore.setState({
        logs: [...logs, ...createOperationLogs(1).map((log) => ({ ...log, id: "new-log" }))],
      });
    });

    await waitForAnimationFrames();
    expect(holder.scrollTop).toBe(1200);
  });

  it("切换 Tab 时恢复各自的滚动位置", async () => {
    const operationLogs = createOperationLogs(100);
    useLoggerStore.setState({
      expanded: true,
      logs: Array.from({ length: 100 }, (_, index) => ({
        id: `backend-${index}`,
        level: "INFO",
        module: "test",
        message: `Backend ${index}`,
        timestamp: new Date(index * 1000).toISOString(),
      })),
    });
    useOperationLogStore.setState({ logs: operationLogs });
    useWSStore.setState({ connected: true });
    render(<LoggerPanel />);

    const operationList = await screen.findByRole("list", {
      name: /操作记录，共 100 条/,
    });
    setScrollPosition(
      operationList.querySelector<HTMLElement>(".rc-virtual-list-holder")!,
      1200,
    );

    fireEvent.click(screen.getByRole("button", { name: "后端日志" }));
    const backendList = await screen.findByRole("list", {
      name: /后端日志，共 100 条/,
    });
    setScrollPosition(
      backendList.querySelector<HTMLElement>(".rc-virtual-list-holder")!,
      700,
    );

    fireEvent.click(screen.getByRole("button", { name: "操作记录" }));
    await waitForAnimationFrames();
    const restoredHolder = screen
      .getByRole("list", { name: /操作记录，共 100 条/ })
      .querySelector<HTMLElement>(".rc-virtual-list-holder")!;
    await waitFor(() => expect(restoredHolder.scrollTop).toBe(1200));
  });
});
