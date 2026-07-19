import {
  CaretDownOutlined,
  CodeOutlined,
  EditOutlined,
  FileOutlined,
  FileImageOutlined,
  FileMarkdownOutlined,
  FileTextOutlined,
  FileUnknownOutlined,
  FolderOpenOutlined,
  FolderOutlined,
} from "@ant-design/icons";
import {
  Button,
  ConfigProvider,
  Dropdown,
  message,
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

import style from "../../styles/layout/ProjectSidebar.module.less";
import {
  openDesktopProject,
  isDesktopEnvironment,
} from "../../services/desktopProject";
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
} from "./projectTree";

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

  useEffect(() => {
    setExpandedKeys((current) => {
      return preserveExpandedProjectTreeKeys(current, tree);
    });
  }, [tree, treeRevision]);

  const selectedKeys = useMemo(
    () => getSelectedProjectTreeKeys(activeTab?.path, capabilities),
    [activeTab?.path, capabilities],
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
    [documents.length],
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
          treeData={[tree]}
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
            const iconClassName = `${style.treeNodeIcon} ${
              projectNode.selectable ? style.pipelineIcon : ""
            }`;
            const nameClassName = `${style.treeName} ${
              projectNode.kind === "root" ? style.treeRootName : ""
            }`;
            return (
              <span className={style.treeTitle}>
                {projectNode.kind === "file" ? (
                  fileIcon(projectNode, iconClassName)
                ) : (
                  <FolderOutlined className={iconClassName} />
                )}
                <span className={nameClassName}>{projectNode.title}</span>
              </span>
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
}: {
  sidebarRef: RefObject<HTMLElement | null>;
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
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    let latestWidth = startWidth;
    let frameId: number | undefined;
    let finished = false;

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    handle.dataset.resizing = "true";

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
      className={style.resizeHandle}
      role="separator"
      aria-label="调整项目侧栏宽度"
      aria-orientation="vertical"
      aria-valuemin={PROJECT_SIDEBAR_MIN_WIDTH}
      aria-valuemax={PROJECT_SIDEBAR_MAX_WIDTH}
      aria-valuenow={width}
      tabIndex={0}
      onPointerDown={startResize}
      onKeyDown={handleKeyDown}
    />
  );
}

export function ProjectSidebar() {
  const width = useProjectSidebarStore((state) => state.width);
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
        className={style.sidebar}
        style={{ width, flexBasis: width }}
        aria-label="项目侧栏"
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
      <SidebarResizeHandle sidebarRef={sidebarRef} />
    </>
  );
}
