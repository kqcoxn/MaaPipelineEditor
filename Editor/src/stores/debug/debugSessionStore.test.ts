import { beforeEach, describe, expect, it } from "vitest";
import type {
  DebugCapabilityManifest,
  DebugProtocolError,
  DebugRunStarted,
  DebugSessionSnapshot,
} from "@/features/debug/types";
import { useDebugSessionStore } from "./debugSessionStore";

const capabilities: DebugCapabilityManifest = {
  generation: "debug-vNext",
  runModes: ["single-node-run"],
  diagnostics: [],
  artifacts: [],
  screenshotSources: [],
  profileFeatures: [],
  maa: {
    mfwVersion: "test",
    supportedControllers: ["adb"],
    supportedTaskerApis: [],
    supportedResourceApis: [],
    supportedAgentTransports: ["identifier"],
  },
};

const session: DebugSessionSnapshot = {
  sessionId: "stale-session",
  status: "completed",
  createdAt: "2026-08-27T00:00:00.000Z",
  updatedAt: "2026-08-27T00:00:01.000Z",
  capabilities,
};

const run: DebugRunStarted = {
  sessionId: session.sessionId,
  runId: "run-1",
  mode: "single-node-run",
  entry: "entry",
  startedAt: session.createdAt,
  session,
};

const protocolError: DebugProtocolError = {
  code: "debug_session_not_found",
  message: "debug session not found",
};

describe("debugSessionStore", () => {
  beforeEach(() => {
    useDebugSessionStore.getState().resetForConnectionLoss();
  });

  it("断开 LocalBridge 后清除仅存在于服务进程内的调试状态", () => {
    useDebugSessionStore.setState({
      session,
      activeRun: run,
      lastStopRequest: { sessionId: session.sessionId, runId: run.runId },
      agentTestResults: {
        agent: {
          agentId: "agent",
          success: true,
          checkedAt: session.createdAt,
          message: "ok",
        },
      },
      lastError: protocolError,
      capabilities,
      capabilityStatus: "ready",
      resourcePreflight: { status: "ready" },
      resourceHealth: { status: "ready" },
      runBadgeStatus: "completed",
      runBadgeAcknowledged: false,
    });

    useDebugSessionStore.getState().resetForConnectionLoss();
    const state = useDebugSessionStore.getState();

    expect(state.session).toBeUndefined();
    expect(state.activeRun).toBeUndefined();
    expect(state.lastStopRequest).toBeUndefined();
    expect(state.agentTestResults).toEqual({});
    expect(state.lastError).toBeUndefined();
    expect(state.capabilities).toBeUndefined();
    expect(state.capabilityStatus).toBe("idle");
    expect(state.resourcePreflight.status).toBe("idle");
    expect(state.resourceHealth.status).toBe("idle");
    expect(state.runBadgeStatus).toBe("idle");
    expect(state.runBadgeAcknowledged).toBe(true);
  });
});
