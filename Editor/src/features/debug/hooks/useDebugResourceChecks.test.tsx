import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDebugSessionStore } from "@/stores/debug/debugSessionStore";
import { debugProtocolClient } from "../../../services/server";
import type { DebugRunProfile } from "../types";
import { useDebugResourceChecks } from "./useDebugResourceChecks";

describe("useDebugResourceChecks", () => {
  beforeEach(() => {
    useDebugSessionStore.setState({
      resourcePreflight: {
        status: "checking",
        requestId: "stale-request",
        resourceKey: "stale-resource",
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not loop when PI resource paths are temporarily unavailable", () => {
    const profileState = {
      profile: { resourcePaths: [] } as DebugRunProfile,
      buildRunRequest: () => {
        throw new Error("not needed by this test");
      },
      setResourcePaths: () => undefined,
    };

    expect(() =>
      renderHook(() =>
        useDebugResourceChecks({
          modalOpen: true,
          activePanel: "overview",
          connected: true,
          profileState,
          resourcePathsOverride: [],
        }),
      ),
    ).not.toThrow();
    expect(useDebugSessionStore.getState().resourcePreflight).toEqual({
      status: "idle",
    });
  });

  it("requests the resource preflight while the debug panel is closed", () => {
    const preflightResources = vi
      .spyOn(debugProtocolClient, "preflightResources")
      .mockReturnValue(true);
    const profileState = {
      profile: { resourcePaths: ["C:/mpe-resource"] } as DebugRunProfile,
      buildRunRequest: () => {
        throw new Error("not needed by this test");
      },
      setResourcePaths: () => undefined,
    };

    renderHook(() =>
      useDebugResourceChecks({
        modalOpen: false,
        activePanel: "overview",
        connected: true,
        profileState,
      }),
    );

    expect(preflightResources).toHaveBeenCalledWith(
      expect.objectContaining({
        resourcePaths: ["C:/mpe-resource"],
      }),
    );
    expect(useDebugSessionStore.getState().resourcePreflight.status).toBe(
      "checking",
    );
  });
});
