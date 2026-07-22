import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as desktopProject from "../../services/desktopProject";
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
    vi.restoreAllMocks();
    useWSStore.getState().setConnected(false);
  });

  it("shows a blocking invalid workspace dialog with only rescan", () => {
    useWorkspaceStore.getState().applyDiscovery({
      revision: 1,
      discoveryRoot: "C:/not-a-maafw-project",
      state: "invalid",
      reason: "interface_not_found",
      candidates: [],
      currentInterface: null,
      indexedFiles: 0,
      totalFiles: 0,
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
    useWorkspaceStore.getState().applyDiscovery({
      revision: 2,
      discoveryRoot: "C:/projects",
      state: "selection_required",
      reason: "multiple_interfaces",
      candidates: [
        {
          candidateId: "candidate:assets",
          interfacePath: "assets/interface.json",
          name: "assets",
          label: "Assets",
          version: "1.0.0",
        },
        {
          candidateId: "candidate:desktop",
          interfacePath: "desktop/interface.json",
          name: "desktop",
          label: "Desktop",
          version: "2.0.0",
        },
      ],
      currentInterface: null,
      indexedFiles: 0,
      totalFiles: 0,
      diagnostics: [],
    });

    render(<WorkspaceSetupModal />);

    expect(screen.getAllByRole("radio")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "使用此 Interface" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "取消" })).not.toBeInTheDocument();
  });

  it("stays blocking while rediscovering the workspace", () => {
    useWorkspaceStore.getState().applyDiscovery({
      revision: 3,
      discoveryRoot: "C:/projects",
      state: "discovering",
      reason: "",
      candidates: [],
      currentInterface: null,
      indexedFiles: 0,
      totalFiles: 0,
      diagnostics: [],
    });

    render(<WorkspaceSetupModal />);

    expect(screen.getByRole("dialog")).toHaveTextContent(
      "正在检测 MaaFramework 项目",
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("offers the shared Desktop project picker for an invalid workspace", async () => {
    vi.spyOn(desktopProject, "isDesktopEnvironment").mockReturnValue(true);
    const openProject = vi
      .spyOn(desktopProject, "openDesktopProject")
      .mockResolvedValue({ status: "cancelled" });
    useWorkspaceStore.getState().applyDiscovery({
      revision: 4,
      discoveryRoot: "C:/invalid",
      state: "invalid",
      reason: "interface_not_found",
      candidates: [],
      currentInterface: null,
      indexedFiles: 0,
      totalFiles: 0,
      diagnostics: [],
    });

    render(<WorkspaceSetupModal />);
    fireEvent.click(screen.getByRole("button", { name: /打开项目/ }));

    await waitFor(() => expect(openProject).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: /重新检测/ })).toBeInTheDocument();
  });
});
