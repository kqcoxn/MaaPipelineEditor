import { afterEach, describe, expect, it, vi } from "vitest";
import {
  requestDebugRun,
  subscribeDebugRunRequests,
  type DebugRunRequestIntent,
} from "./debugRunRequestBridge";

describe("debugRunRequestBridge", () => {
  const unsubscribers: Array<() => void> = [];

  afterEach(() => {
    while (unsubscribers.length > 0) unsubscribers.pop()?.();
  });

  it("将节点快捷调试请求交给唯一的 FlowScope 启动器", () => {
    const listener = vi.fn();
    unsubscribers.push(subscribeDebugRunRequests(listener));
    const intent: DebugRunRequestIntent = {
      nodeId: "pipeline-node",
      mode: "single-node-run",
      input: { confirmAction: true },
    };

    expect(requestDebugRun(intent)).toBe(true);
    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith(intent);
  });

  it("没有启动器订阅时明确返回失败", () => {
    expect(
      requestDebugRun({ nodeId: "pipeline-node", mode: "run-from-node" }),
    ).toBe(false);
  });
});
