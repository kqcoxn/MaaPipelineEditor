import { afterEach, describe, expect, it, vi } from "vitest";
import {
  queueDebugRun,
  requestDebugRun,
  subscribeDebugRunRequests,
  type DebugRunRequestIntent,
} from "./debugRunRequestBridge";

describe("debugRunRequestBridge", () => {
  const unsubscribers: Array<() => void> = [];
  const target = {
    fileId: "pipeline",
    nodeId: "pipeline-node",
    runtimeName: "pipeline_entry",
    sourcePath: "C:/resource/pipeline/pipeline.json",
  };

  afterEach(() => {
    while (unsubscribers.length > 0) unsubscribers.pop()?.();
    // Drain a request retained while no listener was mounted.
    const cleanup = subscribeDebugRunRequests(() => undefined);
    cleanup();
  });

  it("将节点快捷调试请求交给唯一的 FlowScope 启动器", () => {
    const listener = vi.fn();
    unsubscribers.push(subscribeDebugRunRequests(listener));
    const intent: DebugRunRequestIntent = {
      target,
      mode: "single-node-run",
      input: { confirmAction: true },
    };

    expect(requestDebugRun(intent)).toBe(true);
    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith(intent);
  });

  it("启动器尚未挂载时保留请求，挂载后自动交给启动器", () => {
    const intent: DebugRunRequestIntent = {
      target,
      mode: "run-from-node",
    };
    expect(
      requestDebugRun(intent),
    ).toBe(true);

    const listener = vi.fn();
    unsubscribers.push(subscribeDebugRunRequests(listener));
    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith(intent);
  });

  it("宿主打开抽屉后重新排队的请求可由内容启动器消费", () => {
    const intent: DebugRunRequestIntent = {
      target,
      mode: "single-node-run",
    };
    queueDebugRun(intent);

    const listener = vi.fn();
    unsubscribers.push(subscribeDebugRunRequests(listener));
    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith(intent);
  });
});
