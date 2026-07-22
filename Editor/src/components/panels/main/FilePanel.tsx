import { CSS } from "@dnd-kit/utilities";
import style from "../../../styles/panels/FilePanel.module.less";

import React, { memo, useCallback, useMemo, useState } from "react";
import {
  closestCenter,
  DndContext,
  PointerSensor,
  useSensor,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  horizontalListSortingStrategy,
  SortableContext,
  useSortable,
} from "@dnd-kit/sortable";
import { Button, Input, Tabs, Tooltip } from "antd";
import { MenuFoldOutlined, MenuUnfoldOutlined } from "@ant-design/icons";

import { useFileStore } from "../../../stores/fileStore";
import { useEmbedMode } from "../../../hooks/useEmbedMode";
import { useProjectSidebarStore } from "../../../stores/projectSidebarStore";
import { useWSStore } from "../../../stores/wsStore";
import { useProjectSessionStore } from "../../../stores/projectSessionStore";
import { useDocumentStore } from "../../../stores/documentStore";
import {
  activateEditorTab,
  closeEditorTab,
} from "../../../services/projectSessionActions";

interface DraggableTabPaneProps extends React.HTMLAttributes<HTMLDivElement> {
  "data-node-key": string;
}

const DraggableTabNode: React.FC<Readonly<DraggableTabPaneProps>> = memo(
  ({ ...props }) => {
    const { attributes, listeners, setNodeRef, transform, transition } =
      useSortable({ id: props["data-node-key"] });
    const tabStyle: React.CSSProperties = {
      ...props.style,
      transform: CSS.Translate.toString(transform),
      transition,
      cursor: "move",
    };
    const child = props.children as React.ReactElement<
      React.HTMLAttributes<HTMLElement> & React.RefAttributes<HTMLElement>
    >;
    return React.cloneElement(child, {
      ref: setNodeRef,
      style: tabStyle,
      ...attributes,
      ...listeners,
    });
  },
);

function FilePanel() {
  const files = useFileStore((state) => state.files);
  const fileName = useFileStore((state) => state.currentFile.fileName);
  const setFileName = useFileStore((state) => state.setFileName);
  const tabs = useProjectSessionStore((state) => state.tabs);
  const activeKey = useProjectSessionStore((state) => state.activeKey);
  const reorderTab = useProjectSessionStore((state) => state.reorderTab);
  const openedDocuments = useDocumentStore((state) => state.opened);
  const documentIndex = useDocumentStore((state) => state.documents);
  const sidebarVisible = useProjectSidebarStore((state) => state.visible);
  const toggleSidebar = useProjectSidebarStore((state) => state.toggle);
  const wsConnected = useWSStore((state) => state.connected);
  const { isEmbed } = useEmbedMode();
  const [fileNameState, setFileNameState] = useState<
    "" | "warning" | "error" | undefined
  >("");
  const activeTab = tabs.find((tab) => tab.key === activeKey);
  const activeDocument =
    activeTab?.kind === "document" ? openedDocuments[activeTab.path] : undefined;
  const sidebarAvailable = wsConnected && !isEmbed;
  const sidebarShown = sidebarAvailable && sidebarVisible;

  const items = useMemo(
    () =>
      tabs.map((tab) => {
        const pipeline =
          tab.kind === "pipeline"
            ? files.find(
                (file) =>
                  file.config.filePath === tab.path || file.fileName === tab.path,
              )
            : undefined;
        const document =
          tab.kind === "document"
            ? openedDocuments[tab.path]?.descriptor ?? documentIndex[tab.path]
            : undefined;
        const dirty =
          tab.kind === "pipeline"
            ? pipeline?.saveState.dirty
            : openedDocuments[tab.path]?.dirty;
        const label = pipeline?.fileName ?? document?.name ?? tab.path;
        return {
          key: tab.key,
          closable: true,
          label: (
            <span className={style.tabLabel}>
              <span className={style.tabName}>{label}</span>
              {dirty && <span className={style.dirtyDot} aria-label="未保存" />}
            </span>
          ),
        };
      }),
    [documentIndex, files, openedDocuments, tabs],
  );

  const sensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 8 },
  });

  const onLabelChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const nextName = event.target.value;
      const isValid = setFileName(nextName);
      setFileNameState(isValid ? "" : "error");
    },
    [setFileName],
  );

  const onTabChange = useCallback(
    (key: string) => {
      const tab = useProjectSessionStore
        .getState()
        .tabs.find((item) => item.key === key);
      if (tab) void activateEditorTab(tab);
    },
    [],
  );

  const onEdit = useCallback(
    (
      key: React.MouseEvent | React.KeyboardEvent | string,
      action: "add" | "remove",
    ) => {
      if (action !== "remove") return;
      const tab = useProjectSessionStore
        .getState()
        .tabs.find((item) => item.key === String(key));
      if (tab) void closeEditorTab(tab);
    },
    [],
  );

  const onDragEnd = useCallback(
    ({ active, over }: DragEndEvent) => {
      if (over && active.id !== over.id) {
        reorderTab(String(active.id), String(over.id));
      }
    },
    [reorderTab],
  );

  return (
    <div className={style.panel}>
      <div className={style.fileControls}>
        <Tooltip
          title={
            isEmbed
              ? "嵌入模式不显示项目侧栏"
              : wsConnected
                ? sidebarShown
                  ? "收起项目侧栏"
                  : "展开项目侧栏"
                : "连接 LocalBridge 后可用"
          }
          placement="right"
        >
          <span>
            <Button
              type={sidebarShown ? "primary" : "default"}
              icon={sidebarShown ? <MenuFoldOutlined /> : <MenuUnfoldOutlined />}
              size="small"
              disabled={!sidebarAvailable}
              aria-label={sidebarShown ? "收起项目侧栏" : "展开项目侧栏"}
              onClick={toggleSidebar}
            />
          </span>
        </Tooltip>
        <Input
          className={style.filename}
          placeholder={activeTab ? "文件名" : "未打开文件"}
          value={activeTab ? (activeDocument ? activeDocument.path : fileName) : ""}
          disabled={!activeTab}
          readOnly={Boolean(activeDocument)}
          status={activeTab && !activeDocument ? fileNameState : undefined}
          onChange={activeDocument ? undefined : onLabelChange}
        />
      </div>
      <Tabs
        className={style.tabs}
        type="editable-card"
        hideAdd
        items={items}
        activeKey={activeKey ?? undefined}
        onChange={onTabChange}
        onEdit={onEdit}
        renderTabBar={(tabBarProps, DefaultTabBar) => (
          <DndContext
            sensors={[sensor]}
            onDragEnd={onDragEnd}
            collisionDetection={closestCenter}
          >
            <SortableContext
              items={items.map((item) => item.key)}
              strategy={horizontalListSortingStrategy}
            >
              <DefaultTabBar {...tabBarProps}>
                {(node) => (
                  <DraggableTabNode
                    {...(node as React.ReactElement<DraggableTabPaneProps>).props}
                    key={node.key}
                  >
                    {node}
                  </DraggableTabNode>
                )}
              </DefaultTabBar>
            </SortableContext>
          </DndContext>
        )}
      />
    </div>
  );
}

export default memo(FilePanel);
