import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDebugSessionStore } from "@/stores/debug/debugSessionStore";
import { useDebugTraceStore } from "@/stores/debug/debugTraceStore";
import type { DebugSessionSnapshot } from "@/features/debug/types";
import { useDebugStopControl } from "@/features/debug/hooks/useDebugStopControl";
import { debugProtocolClient } from "@/services/server";
import { DebugRunIsland } from "./DebugRunIsland";

vi.mock("@/services/server", () => ({ debugProtocolClient: { stopRun: vi.fn(() => true) } }));
vi.mock("@/utils/ui/antdAppApi", () => ({ message: { error: vi.fn(), warning: vi.fn() } }));

const session: DebugSessionSnapshot = {
  sessionId: "live-session", status: "running", createdAt: "", updatedAt: "",
  capabilities: {
    generation: "debug-vNext", runModes: [], diagnostics: [], artifacts: [],
    screenshotSources: [], profileFeatures: [],
    maa: { mfwVersion: "test", supportedControllers: [], supportedTaskerApis: [], supportedResourceApis: [], supportedAgentTransports: [] },
  },
};

function startRun(runId = "run-1") {
  useDebugSessionStore.getState().setRunStarted({ sessionId: session.sessionId, runId, mode: "single-node-run", entry: "入口节点", startedAt: "", session });
}

describe("调试悬浮状态条", () => {
  beforeEach(() => {
    const canvas = document.createElement("div");
    canvas.id = "mpe-main-canvas";
    document.body.appendChild(canvas);
    vi.useFakeTimers();
    useDebugSessionStore.setState(useDebugSessionStore.getInitialState());
    useDebugTraceStore.setState(useDebugTraceStore.getInitialState());
    vi.mocked(debugProtocolClient.stopRun).mockReset().mockReturnValue(true);
  });
  afterEach(() => {
    cleanup();
    document.getElementById("mpe-main-canvas")?.remove();
    vi.useRealTimers();
  });

  it("历史会话不会唤起状态条，关闭面板的实时运行仍可停止和打开详情", () => {
    const stop = vi.fn();
    render(<DebugRunIsland stopPending={false} onStop={stop} />);
    expect(screen.queryByRole("button", { name: "打开调试面板" })).toBeNull();
    act(() => startRun());
    expect(screen.getByText("入口节点")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /停.*止/ }));
    expect(stop).toHaveBeenCalledOnce();
    expect(useDebugSessionStore.getState().modalOpen).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "打开调试面板" }));
    expect(useDebugSessionStore.getState().activePanel).toBe("overview");
    expect(useDebugSessionStore.getState().modalOpen).toBe(true);
  });

  it("结果定时收起不会隐藏紧接着开始的新运行，断线立即移除入口", () => {
    startRun();
    render(<DebugRunIsland stopPending={false} onStop={vi.fn()} />);
    act(() => useDebugSessionStore.getState().setSessionSnapshot({ ...session, status: "completed" }));
    expect(screen.getByText("已完成")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(3100));
    act(() => startRun("run-2"));
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByText("调试运行中")).toBeInTheDocument();
    act(() => useDebugSessionStore.getState().resetForConnectionLoss());
    expect(screen.queryByText("调试运行中")).toBeNull();
  });

  it("停止结果显示后自动收起", () => {
    startRun();
    render(<DebugRunIsland stopPending={false} onStop={vi.fn()} />);
    act(() => useDebugTraceStore.setState({ displaySessions: [{ id: "live-session:run-1", sessionId: "live-session", runId: "run-1", status: "stopped", firstSeq: 1, lastSeq: 2, eventCount: 2 }] }));
    expect(screen.getByText("已停止")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^停.*止$/ })).toBeNull();
    act(() => vi.advanceTimersByTime(4999));
    expect(screen.getByText("已停止")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "打开调试面板" }).closest('[data-terminal]')).toHaveAttribute("data-exiting", "false");
    act(() => vi.advanceTimersByTime(241));
    expect(screen.getByText("已停止")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "打开调试面板" }).closest('[data-terminal]')).toHaveAttribute("data-exiting", "true");
    act(() => vi.advanceTimersByTime(240));
    expect(screen.queryByText("已停止")).toBeNull();
  });

  it("展开显示轮次和候选，结束后保持详情直到收起", () => {
    startRun();
    useDebugTraceStore.getState().appendEvents([
      { sessionId: "live-session", runId: "run-1", seq: 1, timestamp: "2026-09-05T00:00:00Z", source: "maafw", kind: "node", phase: "starting", node: { runtimeName: "入口节点" }, data: { nodeId: 1 } },
      { sessionId: "live-session", runId: "run-1", seq: 2, timestamp: "2026-09-05T00:00:01Z", source: "maafw", kind: "next-list", phase: "starting", node: { runtimeName: "入口节点" }, data: { next: [{ name: "候选A" }, { name: "候选B" }] } },
    ]);
    render(<DebugRunIsland stopPending={false} onStop={vi.fn()} />);
    expect(screen.getByText("识别下一步")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "展开当前阶段详情" }));
    expect(screen.getByText("候选A")).toBeInTheDocument();
    expect(screen.getByText("本轮尝试")).toBeInTheDocument();
    act(() => useDebugSessionStore.getState().setSessionSnapshot({ ...session, status: "completed" }));
    act(() => vi.advanceTimersByTime(10000));
    expect(screen.getByText("已完成")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "收起当前阶段详情" }));
    act(() => vi.advanceTimersByTime(5500));
    expect(screen.queryByText("已完成")).toBeNull();
  });

  it("失败结果悬停时暂停收起，离开后重新计时", () => {
    startRun();
    render(<DebugRunIsland stopPending={false} onStop={vi.fn()} />);
    act(() => useDebugSessionStore.getState().setSessionSnapshot({ ...session, status: "failed" }));
    const island = screen.getByRole("button", { name: "打开调试面板" }).closest('[data-terminal]')!;
    fireEvent.mouseEnter(island);
    act(() => vi.advanceTimersByTime(15000));
    expect(screen.getByText("执行失败")).toBeInTheDocument();
    fireEvent.mouseLeave(island);
    act(() => vi.advanceTimersByTime(5500));
    expect(screen.queryByText("执行失败")).toBeNull();
  });

  it("没有新事件时搜索计时继续，轮次不会随计时刷新增加", () => {
    startRun();
    useDebugTraceStore.getState().appendEvent({ sessionId: "live-session", runId: "run-1", seq: 1,
      timestamp: "2026-09-05T00:00:00Z", source: "maafw", kind: "next-list", phase: "starting",
      node: { runtimeName: "入口节点" }, data: { next: [{ name: "B" }] } });
    render(<DebugRunIsland stopPending={false} onStop={vi.fn()} />);
    expect(screen.getByText("已搜索 0.0s · 第 1 轮")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(2000));
    expect(screen.getByText("已搜索 2.0s · 第 1 轮")).toBeInTheDocument();
  });

  it("切换历史展示会话仍显示实时运行节点", () => {
    startRun();
    const event = { sessionId: "live-session", runId: "run-1", seq: 1, timestamp: "2026-09-05T00:00:00Z", source: "localbridge" as const, kind: "action" as const, phase: "starting" as const, node: { runtimeName: "实时节点" } };
    useDebugTraceStore.getState().appendEvents([
      event,
      { ...event, runId: "history", seq: 2, node: { runtimeName: "历史节点" } },
    ]);
    useDebugTraceStore.getState().selectDisplaySessions(["live-session:history"]);
    render(<DebugRunIsland stopPending={false} onStop={vi.fn()} />);
    expect(screen.getByText("实时节点")).toBeInTheDocument();
    expect(screen.queryByText("历史节点")).toBeNull();
  });

  it("连续点击只发送一次，后端停止失败后可重试", () => {
    startRun();
    const { result } = renderHook(() => useDebugStopControl());
    act(() => { result.current.stopRun(); result.current.stopRun(); });
    expect(debugProtocolClient.stopRun).toHaveBeenCalledTimes(1);
    expect(result.current.stopPending).toBe(true);
    act(() => useDebugSessionStore.getState().setProtocolError({ code: "debug_run_stop_failed", message: "停止失败" }));
    expect(result.current.stopPending).toBe(false);
    act(() => result.current.stopRun());
    expect(debugProtocolClient.stopRun).toHaveBeenCalledTimes(2);
    expect(result.current.stopPending).toBe(true);
  });

  it("发送失败可以重试，收到停止中状态仍等待运行结束", () => {
    startRun();
    vi.mocked(debugProtocolClient.stopRun).mockReturnValueOnce(false);
    const { result } = renderHook(() => useDebugStopControl());
    act(() => result.current.stopRun());
    expect(result.current.stopPending).toBe(false);
    act(() => result.current.stopRun());
    expect(result.current.stopPending).toBe(true);
    act(() => useDebugSessionStore.getState().setSessionSnapshot({ ...session, status: "stopping" }));
    expect(result.current.stopPending).toBe(true);
    act(() => useDebugSessionStore.getState().setSessionSnapshot({ ...session, status: "completed" }));
    expect(result.current.stopPending).toBe(false);
  });
});
