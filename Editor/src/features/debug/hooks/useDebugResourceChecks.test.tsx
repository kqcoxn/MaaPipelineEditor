import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useDebugSessionStore } from "@/stores/debug/debugSessionStore";
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
});
