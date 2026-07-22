import { beforeEach, describe, expect, it } from "vitest";

import { useDebugSessionStore } from "../../stores/debugSessionStore";
import { useDebugRunProfileStore } from "../../stores/debugRunProfileStore";
import { useResourceStore } from "../../stores/resourceStore";
import { useMFWStore } from "../../stores/mfwStore";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import { useWSStore } from "../../stores/wsStore";
import { getCurrentDebugReadiness } from "./readinessState";

beforeEach(() => {
  useWSStore.setState({ connected: true });
  useWorkspaceStore.setState({ state: "ready" });
  useMFWStore.setState({
    connectionStatus: "connected",
    controllerId: "controller-1",
  });
  useResourceStore.setState({ resourceBundles: [] });
  useDebugRunProfileStore.getState().setResourcePaths(["C:/resource"]);
  useDebugSessionStore.setState({
    resourcePreflight: {
      status: "checking",
      resourceKey: "C:/resource",
    },
  });
});

describe("getCurrentDebugReadiness", () => {
  it("reads the latest resource status without waiting for a React render", () => {
    expect(getCurrentDebugReadiness().readiness.ready).toBe(false);

    useDebugSessionStore.setState({
      resourcePreflight: {
        status: "ready",
        resourceKey: "C:/resource",
      },
    });

    expect(getCurrentDebugReadiness().readiness).toEqual({
      ready: true,
      issues: [],
    });
  });
});
