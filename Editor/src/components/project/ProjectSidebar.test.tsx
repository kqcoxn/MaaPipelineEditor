import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useWorkspaceStore } from "../../stores/workspaceStore";
import { useProjectSidebarStore } from "../../stores/projectSidebarStore";
import { ProjectSidebar } from "./ProjectSidebar";
import style from "../../styles/layout/ProjectSidebar.module.less";

describe("ProjectSidebar", () => {
  beforeEach(() => {
    localStorage.removeItem("mpe.project-sidebar");
    useProjectSidebarStore.setState({ visible: true, width: 280 });
  });

  afterEach(() => {
    cleanup();
    useWorkspaceStore.getState().clear();
  });

  it("only persists the resized width when the pointer is released", () => {
    render(<ProjectSidebar />);
    const separator = screen.getByRole("separator", {
      name: "调整项目侧栏宽度",
    });

    fireEvent.pointerDown(separator, { clientX: 280, pointerId: 1 });
    fireEvent.pointerMove(window, { clientX: 360, pointerId: 1 });

    expect(useProjectSidebarStore.getState().width).toBe(280);

    fireEvent.pointerUp(window, { clientX: 360, pointerId: 1 });

    expect(useProjectSidebarStore.getState().width).toBe(360);
  });

  it("renders the active mode as a larger two-line label without an icon", () => {
    render(<ProjectSidebar />);

    const modeButton = screen.getByRole("button", {
      name: "MPE Elaborator 查阅、编辑并构建",
    });

    expect(modeButton).toHaveTextContent(/MPE\s*Elaborator/);
    expect(modeButton).toHaveTextContent("查阅、编辑并构建");
    expect(modeButton.querySelector(".anticon-edit")).toBeNull();
  });

  it("renders one icon per node with compact right-to-down switchers and unclipped titles", () => {
    useWorkspaceStore.getState().applyTree({
      revision: 1,
      root: "C:/project",
      entries: [
        { path: ".agents", name: ".agents", kind: "directory" },
        {
          path: ".agents/custom",
          name: "custom",
          kind: "directory",
        },
        { path: "README.md", name: "README.md", kind: "file" },
      ],
    });

    render(<ProjectSidebar />);

    const treeItems = screen.getAllByRole("treeitem");
    expect(treeItems).toHaveLength(3);
    treeItems.forEach((treeItem) => {
      expect(
        treeItem.querySelectorAll(
          ".anticon-folder, .anticon-folder-open, .anticon-file",
        ),
      ).toHaveLength(1);
    });

    const fileItem = screen.getByText("README.md").closest('[role="treeitem"]');
    const leafSwitcher = fileItem?.querySelector(".ant-tree-switcher-noop");
    expect(leafSwitcher).toHaveClass(style.treeItemSwitcher);

    const switchers = document.querySelectorAll(`.${style.treeChevron}`);
    expect(switchers).toHaveLength(2);
    expect(switchers[0]).toHaveClass(style.treeChevronExpanded);
    expect(switchers[1]).not.toHaveClass(style.treeChevronExpanded);
    expect(document.querySelectorAll(".anticon-down")).toHaveLength(0);

    const rootName = screen.getByText("project");
    expect(rootName).toHaveClass(style.treeName);
    expect(rootName).toBeVisible();
    expect(screen.getByText(".agents")).toBeVisible();
    expect(rootName.closest(`.${style.treeTitle}`)).toBeVisible();
  });
});
