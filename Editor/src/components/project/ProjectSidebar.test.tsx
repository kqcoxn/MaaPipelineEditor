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
import { useDocumentStore } from "../../stores/documentStore";
import { useResourceStore } from "../../stores/resourceStore";
import { useProjectSessionStore } from "../../stores/projectSessionStore";
import { asProjectId } from "../../features/project-session/types";
import { parseProjectPath } from "../../features/project-session/projectPath";
import { ProjectSidebar } from "./ProjectSidebar";
import style from "../../styles/layout/ProjectSidebar.module.less";

function renderSidebar() {
  return render(
    <AntDesignProvider>
      <ProjectSidebar />
    </AntDesignProvider>,
  );
}

function applyProjectEntries(payload: {
  revision: number;
  root: string;
  entries: Array<{
    path: string;
    name: string;
    kind: "directory" | "file";
    documentKind?: "pipeline" | "interface" | "json" | "text" | "markdown";
  }>;
}) {
  const store = useProjectSessionStore.getState();
  store.establishSession(
    {
      projectId: asProjectId("project:test"),
      projectRoot: payload.root,
      interfacePath: parseProjectPath("interface.json"),
      name: "project",
      label: "project",
      version: "1.0.0",
    },
    "localbridge",
  );
  store.setCapabilities({
    projectId: "project:test",
    pathCaseSensitive: true,
    operations: Object.fromEntries(
      ["list", "read", "write", "create", "rename", "delete", "watch"].map(
        (name) => [name, { available: true, reason: null }],
      ),
    ),
  });
  store.applyEntries({
    revision: payload.revision,
    projectId: "project:test",
    entries: payload.entries.map((entry) => ({
      path: entry.path,
      name: entry.name,
      entryKind: entry.kind,
      ...(entry.kind === "file"
        ? {
            documentId: `document:${entry.path}`,
            kind: entry.documentKind ?? "text",
            language: "",
            mimeType: "text/plain",
            size: 0,
            editable: true,
            previewable: true,
          }
        : {}),
    })),
  });
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
    useDocumentStore.getState().clearProject();
  useResourceStore.getState().clear();
    useProjectSessionStore.getState().clear();
  });

  it("starts inline file creation from a directory context menu", async () => {
    applyProjectEntries({
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
    applyProjectEntries({
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
    applyProjectEntries({
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
    applyProjectEntries({
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

  it("keeps the file filter in its own file section", () => {
    renderSidebar();

    const filterButton = screen.getByRole("button", {
      name: "筛选项目文件",
    });
    const fileSection = filterButton.closest(`.${style.fileSection}`);

    expect(fileSection).not.toBeNull();
    expect(fileSection).toHaveTextContent("项目");
    expect(fileSection?.querySelector(".anticon-down")).toBeNull();
    expect(
      screen.getByRole("button", { name: /打开项目|选择 MaaFramework 项目目录/ }),
    ).not.toBe(fileSection);
  });

  it("renders one icon per node with compact right-to-down switchers and unclipped titles", () => {
    applyProjectEntries({
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
      expect(treeItem.querySelectorAll(`.${style.treeNodeIcon}`)).toHaveLength(1);
    });

    const fileItem = screen.getByText("README.md").closest('[role="treeitem"]');
    const leafSwitcher = fileItem?.querySelector(".ant-tree-switcher-noop");
    expect(leafSwitcher).toHaveClass(style.treeItemSwitcher);

    const switchers = document.querySelectorAll(`.${style.treeChevron}`);
    expect(switchers).toHaveLength(2);
    expect(switchers[0]).toHaveClass(style.treeChevronExpanded);
    expect(switchers[1]).not.toHaveClass(style.treeChevronExpanded);
    expect(document.querySelectorAll(".anticon-down")).toHaveLength(0);

    const rootName = screen
      .getAllByText("project")
      .find((element) => element.classList.contains(style.treeName));
    expect(rootName).toBeDefined();
    expect(rootName).toHaveClass(style.treeName);
    expect(rootName).toBeVisible();
    expect(screen.getByText(".agents")).toBeVisible();
    expect(rootName.closest(`.${style.treeTitle}`)).toBeVisible();
  });

  it("filters the tree by resource directory and interface files", async () => {
    applyProjectEntries({
      revision: 1,
      root: "C:/project",
      entries: [
        { path: "base", name: "base", kind: "directory" },
        { path: "base/pipeline.json", name: "pipeline.json", kind: "file" },
        { path: "other", name: "other", kind: "directory" },
        { path: "other/note.txt", name: "note.txt", kind: "file" },
        { path: "interface.json", name: "interface.json", kind: "file", documentKind: "interface" },
        { path: "shared.json", name: "shared.json", kind: "file", documentKind: "interface" },
      ],
    });
    useResourceStore.setState({
      resourceBundles: [
        {
          abs_path: "C:/project/base",
          rel_path: "base",
          name: "base",
          has_pipeline: true,
          has_image: false,
          has_model: false,
          has_default_pipeline: false,
          image_dir: "",
          pipeline_path: "base",
          sources: [{ kind: "resource", name: "main" }],
        },
      ],
    });
    renderSidebar();

    fireEvent.click(
      screen.getByRole("button", { name: "筛选项目文件" }),
    );
    fireEvent.click(await screen.findByRole("menuitem", { name: "base" }));

    expect(screen.getAllByText("base")).toHaveLength(2);
    expect(screen.queryByText("other")).not.toBeInTheDocument();
    expect(screen.queryByText("interface.json")).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("menuitem", { name: "Interface / import 文件" }),
    );

    expect(screen.getByText("interface.json")).toBeInTheDocument();
    expect(screen.getByText("shared.json")).toBeInTheDocument();
    expect(screen.queryByText("other")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("menuitem", { name: "全部文件" }));

    expect(screen.getByText("other")).toBeInTheDocument();
  });
});
