import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useWorkspaceStore } from "../../stores/workspaceStore";
import { useWSStore } from "../../stores/wsStore";
import { WorkspaceSetupModal } from "./WorkspaceSetupModal";

describe("WorkspaceSetupModal", () => {
  beforeEach(() => {
    useWorkspaceStore.getState().clear();
    useWSStore.getState().setConnected(true);
  });

  afterEach(() => {
    cleanup();
    useWSStore.getState().setConnected(false);
  });

  it("shows a blocking invalid workspace dialog with only rescan", () => {
    useWorkspaceStore.getState().applyStatus({
      revision: 1,
      root: "C:/not-a-maafw-project",
      state: "invalid",
      reason: "interface_not_found",
      candidates: [],
      current_interface: null,
      indexed_files: 0,
      total_files: 0,
      diagnostics: [],
    });

    render(<WorkspaceSetupModal />);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("C:/not-a-maafw-project")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /重新检测/ }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "取消" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "使用此 Interface" }),
    ).not.toBeInTheDocument();
  });

  it("requires choosing one of multiple interfaces", () => {
    useWorkspaceStore.getState().applyStatus({
      revision: 2,
      root: "C:/projects",
      state: "selection_required",
      reason: "multiple_interfaces",
      candidates: [
        {
          interface_path: "assets/interface.json",
          name: "assets",
          label: "Assets",
          version: "1.0.0",
        },
        {
          interface_path: "desktop/interface.json",
          name: "desktop",
          label: "Desktop",
          version: "2.0.0",
        },
      ],
      current_interface: null,
      indexed_files: 0,
      total_files: 0,
      diagnostics: [],
    });

    render(<WorkspaceSetupModal />);

    expect(screen.getAllByRole("radio")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "使用此 Interface" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "取消" })).not.toBeInTheDocument();
  });

  it("stays blocking while rediscovering the workspace", () => {
    useWorkspaceStore.getState().applyStatus({
      revision: 3,
      root: "C:/projects",
      state: "discovering",
      reason: "",
      candidates: [],
      current_interface: null,
      indexed_files: 0,
      total_files: 0,
      diagnostics: [],
    });

    render(<WorkspaceSetupModal />);

    expect(screen.getByRole("dialog")).toHaveTextContent(
      "正在检测 MaaFramework 项目",
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
