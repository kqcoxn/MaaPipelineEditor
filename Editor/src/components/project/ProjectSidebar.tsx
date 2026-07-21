import {
  CaretDownOutlined,
  CodeOutlined,
  DeleteOutlined,
  EditOutlined,
  FileAddOutlined,
  FileOutlined,
  FileImageOutlined,
  FileMarkdownOutlined,
  FileTextOutlined,
  FileUnknownOutlined,
  FolderOpenOutlined,
  FolderOutlined,
} from "@ant-design/icons";
import {
  App,
  Button,
  ConfigProvider,
  Dropdown,
  Tooltip,
  Tree,
  type MenuProps,
} from "antd";
import {
  type Key,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import classNames from "classnames";

import style from "../../styles/layout/ProjectSidebar.module.less";
import {
  openDesktopProject,
  isDesktopEnvironment,
} from "../../services/desktopProject";
import { fileProtocol } from "../../services/server";
import { useLocalFileStore } from "../../stores/localFileStore";
import { activateEditorTab } from "../../services/projectSessionActions";
import { useProjectSessionStore } from "../../stores/projectSessionStore";
import { useDocumentStore } from "../../stores/documentStore";
import {
  PROJECT_SIDEBAR_MAX_WIDTH,
  PROJECT_SIDEBAR_MIN_WIDTH,
  clampProjectSidebarWidth,
  useProjectSidebarStore,
} from "../../stores/projectSidebarStore";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import {
  PROJECT_TREE_ROOT_KEY,
  buildProjectTree,
  getSelectedProjectTreeKeys,
  preserveExpandedProjectTreeKeys,
  type ProjectTreeNode,
  withCreateFileDraft,
} from "./projectTree";
import {
  CreateFileTreeInput,
  getDirectoryPath,
  RenameTreeEntryInput,
  type CreateFileTarget,
  type RenameEntryTarget,
} from "./ProjectFileNameInput";

const { DirectoryTree } = Tree;
const RESIZE_STEP = 10;
const PROJECT_TREE_THEME = {
  token: {
    colorBgContainer: "#fff",
    colorText: "#262626",
    fontSize: 15,
    borderRadius: 4,
    paddingXS: 4,
    motionDurationFast: "0.08s",
    motionDurationMid: "0.1s",
    motionDurationSlow: "0.12s",
  },
  components: {
    Tree: {
      indentSize: 16,
      switcherSize: 18,
      titleHeight: 28,
      nodeHoverBg: "transparent",
      nodeSelectedBg: "transparent",
      nodeSelectedColor: "#1677ff",
      directoryNodeSelectedBg: "transparent",
      directoryNodeSelectedColor: "#1677ff",
    },
  },
};

function ModeLabel({ chinese, english }: { chinese: string; english: string }) {
  return (
    <span className={style.modeLabel}>
      <span>{chinese}</span>
      <span className={style.modeEnglish}>{english}</span>
    </span>
  );
}

function ActiveModeLabel() {
  return (
    <span className={style.activeModeLabel}>
      <span className={style.activeModeTitle}>
        <span>MPE</span>
        <span className={style.modeEnglish}>Elaborator</span>
      </span>
      <span className={style.activeModeDescription}>
        查阅、编辑并构建 MaaFW 项目
      </span>
    </span>
  );
}

const modeItems: MenuProps["items"] = [
  {
    key: "elaborator",
    icon: <EditOutlined />,
    label: <ModeLabel chinese="编辑器" english="Elaborator" />,
  },
  {
    key: "embodier",
    disabled: true,
    label: <ModeLabel chinese="运行器" english="Embodier" />,
  },
  {
    key: "erranter",
    disabled: true,
    label: <ModeLabel chinese="智能体" english="Erranter" />,
  },
];

function ProjectDirectoryTree() {
  const { message, modal } = App.useApp();
  const root = useWorkspaceStore((state) => state.treeRoot || state.root);
  const entries = useWorkspaceStore((state) => state.treeEntries);
  const treeRevision = useWorkspaceStore((state) => state.treeRevision);
  const documentIndex = useDocumentStore((state) => state.documents);
  const documents = useMemo(
    () => Object.values(documentIndex),
    [documentIndex],
  );
  const pipelineFiles = useLocalFileStore((state) => state.files);
  const activeTab = useProjectSessionStore((state) =>
    state.tabs.find((tab) => tab.key === state.activeKey),
  );
  const capabilities = useMemo(
    () =>
      documents.length
        ? documents
        : pipelineFiles.map((file) => file.file_path),
    [documents, pipelineFiles],
  );
  const tree = useMemo(
    () => buildProjectTree(root, entries, capabilities),
    [capabilities, entries, root],
  );
  const [expandedKeys, setExpandedKeys] = useState<Key[]>([
    PROJECT_TREE_ROOT_KEY,
  ]);
  const [createTarget, setCreateTarget] = useState<CreateFileTarget | null>(null);
  const [renameTarget, setRenameTarget] = useState<RenameEntryTarget | null>(null);

  const renderedTree = useMemo(
    () =>
      createTarget ? withCreateFileDraft(tree, createTarget.path) : tree,
    [createTarget, tree],
  );

  useEffect(() => {
    setExpandedKeys((current) => {
      return preserveExpandedProjectTreeKeys(current, tree);
    });
  }, [tree, treeRevision]);

  const selectedKeys = useMemo(
    () => getSelectedProjectTreeKeys(activeTab?.path, capabilities),
    [activeTab?.path, capabilities],
  );

  const beginCreateFile = useCallback((node: ProjectTreeNode) => {
    const target = {
      key: node.key,
      label: node.title,
      path: node.path,
    };
    setRenameTarget(null);
    setCreateTarget(target);
    setExpandedKeys((current) =>
      current.includes(target.key) ? current : [...current, target.key],
    );
  }, []);

  const beginRenameEntry = useCallback((node: ProjectTreeNode) => {
    setCreateTarget(null);
    setRenameTarget({
      label: node.title,
      path: node.path,
      directoryPath: getDirectoryPath(node.path),
      kind: node.kind === "directory" ? "directory" : "file",
    });
  }, []);

  const confirmDeleteFile = useCallback(
    (node: ProjectTreeNode) => {
      setCreateTarget(null);
      setRenameTarget(null);
      modal.confirm({
        title: "删除文件",
        content: `确定删除“${node.title}”吗？此操作无法撤销。`,
        okText: "删除",
        cancelText: "取消",
        okButtonProps: { danger: true },
        onOk: async () => {
          try {
            const deleted = await fileProtocol.requestDeleteFile(node.path);
            if (!deleted) throw new Error("文件删除失败");
            message.success(`文件已删除：${node.title}`);
          } catch (deleteError) {
            message.error(
              deleteError instanceof Error
                ? deleteError.message
                : "文件删除失败",
            );
            throw deleteError;
          }
        },
      });
    },
    [message, modal],
  );

  const handleSelect = useCallback(
    (_keys: Key[], info: { node: unknown }) => {
      const node = info.node as ProjectTreeNode;
      if (node.kind !== "file" || !node.selectable) return;
      const isPipeline =
        node.document?.kind === "pipeline" ||
        (!documents.length && node.selectable);
      const tab = isPipeline
        ? {
            kind: "pipeline" as const,
            path: node.path,
            key: `pipeline:${node.path}`,
          }
        : {
            kind: "document" as const,
            path: node.path,
            key: `document:${node.path}`,
          };
      void activateEditorTab(tab).then((success) => {
        if (!success) message.error("打开项目文件请求发送失败");
      });
    },
    [documents.length, message],
  );

  return (
    <div className={style.treeViewport}>
      <ConfigProvider theme={PROJECT_TREE_THEME}>
        <DirectoryTree
          blockNode
          showIcon={false}
          classNames={{
            root: style.projectTree,
            item: style.treeItem,
            itemTitle: style.treeItemTitle,
            itemSwitcher: style.treeItemSwitcher,
          }}
          treeData={[renderedTree]}
          expandedKeys={expandedKeys}
          selectedKeys={selectedKeys}
          switcherIcon={({ isLeaf, expanded }) => {
            if (isLeaf) return null;
            return (
              <span
                aria-hidden="true"
                className={`${style.treeChevron} ${
                  expanded ? style.treeChevronExpanded : ""
                }`}
              />
            );
          }}
          onExpand={(keys) => setExpandedKeys(keys)}
          onSelect={handleSelect}
          titleRender={(node) => {
            const projectNode = node as ProjectTreeNode;
            if (projectNode.kind === "draft" && createTarget) {
              return (
                <CreateFileTreeInput
                  target={createTarget}
                  entries={entries}
                  onFinish={() => setCreateTarget(null)}
                />
              );
            }
            if (
              (projectNode.kind === "file" || projectNode.kind === "directory") &&
              renameTarget?.path === projectNode.path
            ) {
              return (
                <RenameTreeEntryInput
                  target={renameTarget}
                  entries={entries}
                  onFinish={() => setRenameTarget(null)}
                />
              );
            }
            const iconClassName = `${style.treeNodeIcon} ${
              projectNode.selectable ? style.pipelineIcon : ""
            }`;
            const nameClassName = `${style.treeName} ${
              projectNode.kind === "root" ? style.treeRootName : ""
            }`;
            const title = (
              <span className={style.treeTitle}>
                {projectNode.kind === "file" ? (
                  fileIcon(projectNode, iconClassName)
                ) : (
                  <FolderOutlined className={iconClassName} />
                )}
                <span className={nameClassName}>{projectNode.title}</span>
              </span>
            );
            const isFile = projectNode.kind === "file";
            const isDirectory = projectNode.kind === "directory";
            return (
              <Dropdown
                trigger={["contextMenu"]}
                menu={{
                  items: isFile
                    ? [
                        {
                          key: "rename-entry",
                          icon: <EditOutlined />,
                          label: "重命名",
                        },
                        {
                          key: "delete-file",
                          icon: <DeleteOutlined />,
                          label: "删除",
                          danger: true,
                        },
                      ]
                    : [
                        {
                          key: "create-file",
                          icon: <FileAddOutlined />,
                          label: "新建文件",
                        },
                        ...(isDirectory
                          ? [
                              {
                                key: "rename-entry",
                                icon: <EditOutlined />,
                                label: "重命名",
                              },
                            ]
                          : []),
                      ],
                  onClick: ({ key, domEvent }) => {
                    domEvent.preventDefault();
                    domEvent.stopPropagation();
                    if (key === "create-file") beginCreateFile(projectNode);
                    else if (key === "rename-entry") beginRenameEntry(projectNode);
                    else if (key === "delete-file") confirmDeleteFile(projectNode);
                  },
                }}
              >
                {title}
              </Dropdown>
            );
          }}
        />
      </ConfigProvider>
    </div>
  );
}

function fileIcon(node: ProjectTreeNode, className: string) {
  switch (node.document?.kind) {
    case "image":
      return <FileImageOutlined className={className} />;
    case "markdown":
      return <FileMarkdownOutlined className={className} />;
    case "interface":
    case "json":
      return <CodeOutlined className={className} />;
    case "text":
      return <FileTextOutlined className={className} />;
    case "binary":
      return <FileUnknownOutlined className={className} />;
    default:
      return <FileOutlined className={className} />;
  }
}

function applySidebarPreviewWidth(
  sidebar: HTMLElement | null,
  handle: HTMLDivElement | null,
  width: number,
) {
  if (sidebar) {
    const cssWidth = `${width}px`;
    sidebar.style.width = cssWidth;
    sidebar.style.flexBasis = cssWidth;
  }
  handle?.setAttribute("aria-valuenow", String(width));
}

function SidebarResizeHandle({
  sidebarRef,
  visible,
}: {
  sidebarRef: RefObject<HTMLElement | null>;
  visible: boolean;
}) {
  const width = useProjectSidebarStore((state) => state.width);
  const setWidth = useProjectSidebarStore((state) => state.setWidth);
  const cleanupRef = useRef<(() => void) | undefined>(undefined);

  useEffect(() => () => cleanupRef.current?.(), []);

  const startResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button > 0 || cleanupRef.current) return;
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = width;
    const handle = event.currentTarget;
    const sidebar = sidebarRef.current;
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    let latestWidth = startWidth;
    let frameId: number | undefined;
    let finished = false;

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    handle.dataset.resizing = "true";
    if (sidebar) sidebar.dataset.resizing = "true";

    const flushPreview = () => {
      if (frameId !== undefined) {
        window.cancelAnimationFrame(frameId);
        frameId = undefined;
      }
      applySidebarPreviewWidth(sidebarRef.current, handle, latestWidth);
    };

    const schedulePreview = () => {
      if (frameId !== undefined) return;
      frameId = window.requestAnimationFrame(() => {
        frameId = undefined;
        applySidebarPreviewWidth(sidebarRef.current, handle, latestWidth);
      });
    };

    const updatePreview = (clientX: number) => {
      latestWidth = clampProjectSidebarWidth(startWidth + clientX - startX);
      schedulePreview();
    };

    const handleMove = (moveEvent: PointerEvent) => {
      updatePreview(moveEvent.clientX);
    };

    const cleanup = () => {
      if (frameId !== undefined) window.cancelAnimationFrame(frameId);
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerCancel);
      window.removeEventListener("blur", handleWindowBlur);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      delete handle.dataset.resizing;
      if (sidebar) delete sidebar.dataset.resizing;
      if (cleanupRef.current === cleanup) cleanupRef.current = undefined;
    };

    const finishResize = (clientX?: number) => {
      if (finished) return;
      finished = true;
      if (clientX !== undefined) updatePreview(clientX);
      flushPreview();
      cleanup();
      setWidth(latestWidth);
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      finishResize(upEvent.clientX);
    };
    const handlePointerCancel = () => finishResize();
    const handleWindowBlur = () => finishResize();

    cleanupRef.current = cleanup;
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerCancel);
    window.addEventListener("blur", handleWindowBlur);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? RESIZE_STEP * 2 : RESIZE_STEP;
    if (event.key === "ArrowLeft") setWidth(width - step);
    else if (event.key === "ArrowRight") setWidth(width + step);
    else if (event.key === "Home") setWidth(PROJECT_SIDEBAR_MIN_WIDTH);
    else if (event.key === "End") setWidth(PROJECT_SIDEBAR_MAX_WIDTH);
    else return;
    event.preventDefault();
  };

  return (
    <div
      className={classNames(style.resizeHandle, {
        [style.resizeHandleCollapsed]: !visible,
      })}
      role="separator"
      aria-label="调整项目侧栏宽度"
      aria-hidden={!visible}
      aria-orientation="vertical"
      aria-valuemin={PROJECT_SIDEBAR_MIN_WIDTH}
      aria-valuemax={PROJECT_SIDEBAR_MAX_WIDTH}
      aria-valuenow={width}
      tabIndex={visible ? 0 : -1}
      onPointerDown={startResize}
      onKeyDown={handleKeyDown}
    />
  );
}

export function ProjectSidebar() {
  const { message } = App.useApp();
  const width = useProjectSidebarStore((state) => state.width);
  const visible = useProjectSidebarStore((state) => state.visible);
  const currentInterface = useWorkspaceStore((state) => state.currentInterface);
  const sidebarRef = useRef<HTMLElement | null>(null);
  const [opening, setOpening] = useState(false);
  const desktop = isDesktopEnvironment();
  const projectName =
    currentInterface?.label || currentInterface?.name || "项目树";

  const handleOpenProject = async () => {
    if (!desktop || opening) return;
    setOpening(true);
    try {
      const result = await openDesktopProject();
      if (result.status === "failed") {
        message.error(
          result.error instanceof Error
            ? result.error.message
            : `项目切换失败: ${String(result.error)}`,
        );
      }
    } finally {
      setOpening(false);
    }
  };

  return (
    <>
      <aside
        ref={sidebarRef}
        className={classNames(style.sidebar, {
          [style.sidebarCollapsed]: !visible,
        })}
        style={{
          width: visible ? width : 0,
          flexBasis: visible ? width : 0,
        }}
        aria-label="项目侧栏"
        aria-hidden={!visible}
        inert={!visible}
      >
        <div className={style.modeSection}>
          <Dropdown
            menu={{ items: modeItems }}
            placement="bottomLeft"
            trigger={["click"]}
          >
            <Button type="text" size="small" className={style.modeButton}>
              <ActiveModeLabel />
              <CaretDownOutlined
                aria-hidden="true"
                className={style.modeCaret}
              />
            </Button>
          </Dropdown>
        </div>

        <div className={style.toolbarSection}>
          <Tooltip
            title={
              desktop
                ? "选择 MaaFramework 项目目录"
                : "仅 Desktop 支持更改项目根目录"
            }
          >
            <span className={style.toolbarButtonWrapper}>
              <Button
                type="text"
                size="small"
                icon={<FolderOpenOutlined />}
                disabled={!desktop}
                loading={opening}
                onClick={() => void handleOpenProject()}
              >
                打开项目
              </Button>
            </span>
          </Tooltip>
        </div>

        <ProjectDirectoryTree />

        <footer className={style.footer}>
          <span className={style.footerName}>{projectName}</span>
        </footer>
      </aside>
      <SidebarResizeHandle sidebarRef={sidebarRef} visible={visible} />
    </>
  );
}
