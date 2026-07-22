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
import { useProjectSidebarStore } from "../../../stores/projectSidebarStore";
import { useProjectSessionStore } from "../../../stores/projectSessionStore";
import { useDocumentStore } from "../../../stores/documentStore";
import { getCapability } from "../../../features/project-storage/ProjectStorageAdapter";
import { asDocumentId } from "../../../features/project-session/types";
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
  const activeDocumentId = useProjectSessionStore(
    (state) => state.activeDocumentId,
  );
  const entriesById = useProjectSessionStore((state) => state.entriesById);
  const capabilities = useProjectSessionStore((state) => state.capabilities);
  const adapterKind = useProjectSessionStore((state) => state.adapterKind);
  const reorderTab = useProjectSessionStore((state) => state.reorderTab);
  const openedDocuments = useDocumentStore((state) => state.opened);
  const sidebarVisible = useProjectSidebarStore((state) => state.visible);
  const toggleSidebar = useProjectSidebarStore((state) => state.toggle);
  const [fileNameState, setFileNameState] = useState<
    "" | "warning" | "error" | undefined
  >("");
  const activeTab = tabs.find(
    (tab) => tab.documentId === activeDocumentId,
  );
  const activeEntry = activeTab ? entriesById[activeTab.documentId] : undefined;
  const activeDocument = activeTab
    ? openedDocuments[activeTab.documentId]
    : undefined;
  const sidebarAvailable =
    adapterKind === "browser" || getCapability(capabilities, "list").available;
  const sidebarShown = sidebarAvailable && sidebarVisible;

  const items = useMemo(
    () =>
      tabs.map((tab) => {
        const entry = entriesById[tab.documentId];
        const pipeline =
          entry?.kind === "pipeline"
            ? files.find((file) => file.documentId === tab.documentId)
            : undefined;
        const document = openedDocuments[tab.documentId]?.descriptor;
        const dirty = pipeline?.saveState.dirty ?? openedDocuments[tab.documentId]?.dirty;
        const label =
          (entry && "path" in entry ? entry.name : undefined) ??
          pipeline?.fileName ??
          document?.name ??
          entry?.name ??
          tab.documentId;
        return {
          key: tab.documentId,
          closable: true,
          label: (
            <span className={style.tabLabel}>
              <span className={style.tabName}>{label}</span>
              {dirty && <span className={style.dirtyDot} aria-label="未保存" />}
            </span>
          ),
        };
      }),
    [entriesById, files, openedDocuments, tabs],
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
        .tabs.find((item) => item.documentId === asDocumentId(key));
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
        .tabs.find((item) => item.documentId === asDocumentId(String(key)));
      if (tab) void closeEditorTab(tab);
    },
    [],
  );

  const onDragEnd = useCallback(
    ({ active, over }: DragEndEvent) => {
      if (over && active.id !== over.id) {
        reorderTab(asDocumentId(String(active.id)), asDocumentId(String(over.id)));
      }
    },
    [reorderTab],
  );

  return (
    <div className={style.panel}>
      <div className={style.fileControls}>
        <Tooltip
          title={
            sidebarAvailable
              ? sidebarShown
                ? "收起项目侧栏"
                : "展开项目侧栏"
              : getCapability(capabilities, "list").reason ?? "项目列表不可用"
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
          value={
            activeTab
              ? "path" in (activeEntry ?? {})
                ? activeEntry.path
                : activeDocument?.path ?? fileName
              : ""
          }
          disabled={!activeTab}
          readOnly={Boolean(activeEntry && "path" in activeEntry)}
          status={activeTab && !(activeEntry && "path" in activeEntry) ? fileNameState : undefined}
          onChange={activeEntry && "path" in activeEntry ? undefined : onLabelChange}
        />
      </div>
      <Tabs
        className={style.tabs}
        type="editable-card"
        hideAdd
        items={items}
        activeKey={activeDocumentId ?? undefined}
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
