import { describe, expect, it } from "vitest";

import { getDebugReadiness } from "./readiness";

const readyInput = {
  localBridgeConnected: true,
  deviceConnectionStatus: "connected",
  controllerId: "controller-1",
  resourceStatus: "ready",
} as const;

describe("getDebugReadiness", () => {
  it("blocks debug while the workspace index is incomplete", () => {
    const readiness = getDebugReadiness({
      ...readyInput,
      workspaceState: "indexing",
    });

    expect(readiness.ready).toBe(false);
    expect(readiness.issues).toContainEqual({
      code: "debug.workspace.indexing",
      title: "Pipeline 索引未完成",
      message: "Pipeline 正在建立索引，请等待索引完成后再启动调试。",
    });
  });

  it("allows debug after the workspace index is ready", () => {
    const readiness = getDebugReadiness({
      ...readyInput,
      workspaceState: "ready",
    });

    expect(readiness).toEqual({ ready: true, issues: [] });
  });
});
