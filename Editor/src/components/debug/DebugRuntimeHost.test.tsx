import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  requestDebugRun,
  subscribeDebugRunRequests,
} from "@/features/debug/actions/debugRunRequestBridge";
import { useDebugSessionStore } from "@/stores/debug/debugSessionStore";

vi.mock("@/components/async/LazyFeature", () => ({
  LazyFeature: () => <div>调试运行时正在加载</div>,
}));

vi.mock("@/features/debug/hooks/useDebugRunStatusTracker", () => ({
  useDebugRunStatusTracker: () => undefined,
}));

import { DebugRuntimeHost } from "./DebugRuntimeHost";

describe("DebugRuntimeHost", () => {
  afterEach(() => {
    cleanup();
    useDebugSessionStore.setState({ modalOpen: false });
    const drainPendingRequest = subscribeDebugRunRequests(() => undefined);
    drainPendingRequest();
    vi.restoreAllMocks();
  });

  it("快捷调试请求会加载运行时但不会自动打开侧边栏", () => {
    render(<DebugRuntimeHost />);

    act(() => {
      requestDebugRun({
        target: {
          fileId: "pipeline",
          nodeId: "pipeline-node",
          runtimeName: "pipeline_entry",
          sourcePath: "C:/resource/pipeline/pipeline.json",
        },
        mode: "single-node-run",
      });
    });

    expect(screen.getByText("调试运行时正在加载")).toBeInTheDocument();
    expect(useDebugSessionStore.getState().modalOpen).toBe(false);
  });
});
