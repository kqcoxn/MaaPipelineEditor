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

  it("tracks tree revisions independently and ignores stale trees", () => {
    useWorkspaceStore.getState().applyStatus(status(12, "ready"));
    useWorkspaceStore.getState().applyTree({
      revision: 4,
      root: "C:/project",
      entries: [{ path: "new.json", name: "new.json", kind: "file" }],
    });
    useWorkspaceStore.getState().applyTree({
      revision: 3,
      root: "C:/old-project",
      entries: [{ path: "old.json", name: "old.json", kind: "file" }],
    });

    expect(useWorkspaceStore.getState()).toMatchObject({
      revision: 12,
      treeRevision: 4,
      treeRoot: "C:/project",
      treeEntries: [{ path: "new.json" }],
    });
  });

  it("resets revisions for a restarted bridge without clearing visible project data", () => {
    useWorkspaceStore.getState().applyStatus(status(8, "ready"));
    useWorkspaceStore.getState().applyTree({
      revision: 6,
      root: "C:/project",
      entries: [{ path: "main.json", name: "main.json", kind: "file" }],
    });

    useWorkspaceStore.getState().prepareReconnect();

    expect(useWorkspaceStore.getState()).toMatchObject({
      revision: 0,
      treeRevision: 0,
      state: "ready",
      treeEntries: [{ path: "main.json" }],
    });
  });

  it("migrates tree entries and interface identity on directory rename", () => {
    useWorkspaceStore.getState().applyStatus({
      ...status(8, "ready"),
      candidates: [
        {
          interface_path: "project/interface.json",
          name: "project",
          label: "Project",
          version: "1.0.0",
        },
      ],
      current_interface: {
        interface_path: "project/interface.json",
        name: "project",
        label: "Project",
        version: "1.0.0",
      },
    });
    useWorkspaceStore.getState().applyTree({
      revision: 2,
      root: "C:/project",
      entries: [
        { path: "project", name: "project", kind: "directory" },
        { path: "project/interface.json", name: "interface.json", kind: "file" },
      ],
    });

    useWorkspaceStore.getState().renamePath("project", "renamed", true);

    expect(useWorkspaceStore.getState()).toMatchObject({
      treeEntries: [
        { path: "renamed", name: "renamed" },
        { path: "renamed/interface.json", name: "interface.json" },
      ],
      currentInterface: { interface_path: "renamed/interface.json" },
    });
  });
});
