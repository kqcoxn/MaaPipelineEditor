import { beforeEach, describe, expect, it } from "vitest";

import type { ProjectDiscoveryStatus } from "../services/generated/bridge-v2";
import { useWorkspaceStore } from "./workspaceStore";

function discovery(revision: number): ProjectDiscoveryStatus {
  return {
    revision,
    discoveryRoot: "C:/projects",
    state: "selection_required",
    reason: "multiple_interfaces",
    candidates: [
      {
        candidateId: "candidate:a",
        interfacePath: "a/interface.json",
        name: "a",
        label: "A",
        version: "1.0.0",
      },
    ],
    currentInterface: null,
    indexedFiles: 0,
    totalFiles: 0,
    diagnostics: [],
  };
}

describe("workspaceStore", () => {
  beforeEach(() => useWorkspaceStore.getState().clear());

  it("only stores project discovery state and ignores stale revisions", () => {
    useWorkspaceStore.getState().applyDiscovery(discovery(4));
    useWorkspaceStore.getState().applyDiscovery({
      ...discovery(3),
      state: "invalid",
    });

    expect(useWorkspaceStore.getState()).toMatchObject({
      revision: 4,
      root: "C:/projects",
      state: "selection_required",
      candidates: [
        {
          candidate_id: "candidate:a",
          interface_path: "a/interface.json",
        },
      ],
    });
  });

  it("keeps required selection blocking", () => {
    useWorkspaceStore.getState().applyDiscovery(discovery(1));
    useWorkspaceStore.getState().closeSelector();
    expect(useWorkspaceStore.getState().selectorOpen).toBe(true);
  });

  it("prepares reconnect without discarding visible discovery", () => {
    useWorkspaceStore.getState().applyDiscovery(discovery(2));
    useWorkspaceStore.getState().prepareReconnect();
    expect(useWorkspaceStore.getState()).toMatchObject({
      revision: 0,
      state: "disconnected",
      root: "C:/projects",
    });
  });
});
