import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { Modal } from "antd";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fileProtocol } from "../../services/server";
import { AntDesignProvider } from "../../contexts/AntDesignProvider";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import { useProjectSidebarStore } from "../../stores/projectSidebarStore";
import { ProjectSidebar } from "./ProjectSidebar";
import style from "../../styles/layout/ProjectSidebar.module.less";

function renderSidebar() {
  return render(
    <AntDesignProvider>
      <ProjectSidebar />
    </AntDesignProvider>,
  );
}

describe("ProjectSidebar", () => {
  beforeEach(() => {
    localStorage.removeItem("mpe.project-sidebar");
    useProjectSidebarStore.setState({ visible: true, width: 280 });
  });

  afterEach(() => {
    Modal.destroyAll();
    cleanup();
    vi.restoreAllMocks();
    useWorkspaceStore.getState().clear();
  });

  it("starts inline file creation from a directory context menu", async () => {
    useWorkspaceStore.getState().applyTree({
      revision: 1,
      root: "C:/project",
      entries: [
        { path: "pipeline", name: "pipeline", kind: "directory" },
        {
          path: "pipeline/existing.json",
          name: "existing.json",
          kind: "file",
        },
      ],
    });
    renderSidebar();

    const directoryName = screen.getByText("pipeline");
    fireEvent.click(directoryName);
    await waitFor(() => {
      expect(directoryName.closest('[role="treeitem"]')).toHaveAttribute(
        "aria-expanded",
        "true",
      );
    });

    fireEvent.contextMenu(directoryName);
    fireEvent.click(await screen.findByText("新建文件"));

    expect(directoryName.closest('[role="treeitem"]')).toHaveAttribute(
      "aria-expanded",
      "true",
    );

    const input = await screen.findByRole("textbox", {
      name: "在 pipeline 中新建文件",
    });
    await waitFor(() => expect(input).toHaveFocus());

    const createFile = vi
      .spyOn(fileProtocol, "requestCreateFile")
      .mockResolvedValue("pipeline/new.json");
    const openFile = vi
      .spyOn(fileProtocol, "requestOpenFile")
      .mockReturnValue(true);
    fireEvent.change(input, { target: { value: "new.json" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(createFile).toHaveBeenCalledWith("new.json", "pipeline");
    });
    expect(openFile).toHaveBeenCalledWith("pipeline/new.json");
  });

  it("renames a file from its context menu", async () => {
    useWorkspaceStore.getState().applyTree({
      revision: 1,
      root: "C:/project",
      entries: [{ path: "README.md", name: "README.md", kind: "file" }],
    });
    const renameFile = vi
      .spyOn(fileProtocol, "requestRenameEntry")
      .mockResolvedValue("GUIDE.md");
    renderSidebar();

    fireEvent.contextMenu(screen.getByText("README.md"));
    fireEvent.click(await screen.findByText("重命名"));

    const input = await screen.findByRole("textbox", {
      name: "重命名 README.md",
    });
    fireEvent.change(input, { target: { value: "GUIDE.md" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(renameFile).toHaveBeenCalledWith("README.md", "GUIDE.md");
    });
    expect(await screen.findByText("文件已重命名为 GUIDE.md")).toBeInTheDocument();
  });

  it("renames a directory from its context menu", async () => {
    useWorkspaceStore.getState().applyTree({
      revision: 1,
      root: "C:/project",
      entries: [
        { path: "pipeline", name: "pipeline", kind: "directory" },
        {
          path: "pipeline/main.json",
          name: "main.json",
          kind: "file",
        },
      ],
    });
    const renameEntry = vi
      .spyOn(fileProtocol, "requestRenameEntry")
      .mockResolvedValue("pipelines");
    renderSidebar();

    fireEvent.contextMenu(screen.getByText("pipeline"));
    fireEvent.click(await screen.findByText("重命名"));

    const input = await screen.findByRole("textbox", {
      name: "重命名 pipeline",
    });
    expect(input.closest(`.${style.treeTitle}`)?.querySelector(".anticon-folder")).not.toBeNull();
    fireEvent.change(input, { target: { value: "pipelines" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(renameEntry).toHaveBeenCalledWith("pipeline", "pipelines");
    });
    expect(
      await screen.findByText("文件夹已重命名为 pipelines"),
    ).toBeInTheDocument();
  });

  it("requires confirmation before deleting a file", async () => {
    useWorkspaceStore.getState().applyTree({
      revision: 1,
      root: "C:/project",
      entries: [{ path: "README.md", name: "README.md", kind: "file" }],
    });
    const deleteFile = vi
      .spyOn(fileProtocol, "requestDeleteFile")
      .mockResolvedValue(true);
    renderSidebar();

    fireEvent.contextMenu(screen.getByText("README.md"));
    fireEvent.click(await screen.findByText("删除"));

    expect(
      await screen.findByText("确定删除“README.md”吗？此操作无法撤销。"),
    ).toBeInTheDocument();
    expect(deleteFile).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /删\s*除/ }));
    });

    await waitFor(() => {
      expect(deleteFile).toHaveBeenCalledWith("README.md");
    });
    expect(await screen.findByText("文件已删除：README.md")).toBeInTheDocument();
  });

  it("only persists the resized width when the pointer is released", () => {
    renderSidebar();
    const separator = screen.getByRole("separator", {
      name: "调整项目侧栏宽度",
    });

    fireEvent.pointerDown(separator, { clientX: 280, pointerId: 1 });
    fireEvent.pointerMove(window, { clientX: 360, pointerId: 1 });

    expect(useProjectSidebarStore.getState().width).toBe(280);

    fireEvent.pointerUp(window, { clientX: 360, pointerId: 1 });

    expect(useProjectSidebarStore.getState().width).toBe(360);
  });

  it("keeps the sidebar mounted in an inert collapsed state", () => {
    useProjectSidebarStore.setState({ visible: false });

    renderSidebar();

    const sidebar = screen.getByLabelText("项目侧栏", { hidden: true });
    const separator = screen.getByRole("separator", { hidden: true });

    expect(sidebar).toHaveClass(style.sidebarCollapsed);
    expect(sidebar).toHaveStyle({ width: "0px", flexBasis: "0px" });
    expect(sidebar).toHaveAttribute("aria-hidden", "true");
    expect(sidebar).toHaveAttribute("inert");
    expect(separator).toHaveClass(style.resizeHandleCollapsed);
    expect(separator).toHaveAttribute("tabindex", "-1");

    act(() => useProjectSidebarStore.getState().setVisible(true));

    expect(screen.getByLabelText("项目侧栏")).toBe(sidebar);
    expect(sidebar).not.toHaveClass(style.sidebarCollapsed);
    expect(sidebar).toHaveStyle({ width: "280px", flexBasis: "280px" });
    expect(sidebar).not.toHaveAttribute("inert");
    expect(separator).not.toHaveClass(style.resizeHandleCollapsed);
    expect(separator).toHaveAttribute("tabindex", "0");
  });

  it("renders the active mode as a larger two-line label without an icon", () => {
    renderSidebar();

    const modeButton = screen.getByRole("button", {
      name: "MPE Elaborator 查阅、编辑并构建 MaaFW 项目",
    });

    expect(modeButton).toHaveTextContent(/MPE\s*Elaborator/);
    expect(modeButton).toHaveTextContent("查阅、编辑并构建 MaaFW 项目");
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

    renderSidebar();

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
