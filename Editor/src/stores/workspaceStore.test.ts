import { beforeEach, describe, expect, it } from "vitest";

import {
  useWorkspaceStore,
  type WorkspaceStatusPayload,
} from "./workspaceStore";

function status(
  revision: number,
  state: WorkspaceStatusPayload["state"],
): WorkspaceStatusPayload {
  return {
    revision,
    root: "C:/project",
    state,
    reason: "",
    candidates: [],
    current_interface: null,
    indexed_files: state === "ready" ? 2 : 1,
    total_files: 2,
    diagnostics: [],
  };
}

describe("workspaceStore", () => {
  beforeEach(() => useWorkspaceStore.getState().clear());

  it("ignores status from an older workspace revision", () => {
    useWorkspaceStore.getState().applyStatus(status(4, "indexing"));
    useWorkspaceStore.getState().applyStatus(status(3, "invalid"));

    expect(useWorkspaceStore.getState()).toMatchObject({
      revision: 4,
      state: "indexing",
      indexedFiles: 1,
    });
  });

  it("keeps interface selection blocking until a current interface is ready", () => {
    const selection = {
      ...status(5, "selection_required"),
      candidates: [
        {
          interface_path: "first/interface.json",
          name: "first",
          label: "First",
          version: "1.0.0",
        },
        {
          interface_path: "second/interface.json",
          name: "second",
          label: "Second",
          version: "2.0.0",
        },
      ],
    } satisfies WorkspaceStatusPayload;
    useWorkspaceStore.getState().applyStatus(selection);
    useWorkspaceStore.getState().closeSelector();

    expect(useWorkspaceStore.getState().selectorOpen).toBe(true);
  });
});
