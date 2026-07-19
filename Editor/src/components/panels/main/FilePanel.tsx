import { CSS } from "@dnd-kit/utilities";
import style from "../../../styles/panels/FilePanel.module.less";

import React, { useState, memo, useMemo, useCallback } from "react";
import {
  closestCenter,
  DndContext,
  PointerSensor,
  useSensor,
} from "@dnd-kit/core";
import {
  horizontalListSortingStrategy,
  SortableContext,
  useSortable,
} from "@dnd-kit/sortable";
import { Tabs, Input, Button, Tooltip } from "antd";
import { MenuFoldOutlined, MenuUnfoldOutlined } from "@ant-design/icons";
import { useFileStore } from "../../../stores/fileStore";
import { useEmbedMode } from "../../../hooks/useEmbedMode";
import { useProjectSidebarStore } from "../../../stores/projectSidebarStore";
import { useWSStore } from "../../../stores/wsStore";

interface DraggableTabPaneProps extends React.HTMLAttributes<HTMLDivElement> {
  "data-node-key": string;
}

const DraggableTabNode: React.FC<Readonly<DraggableTabPaneProps>> = memo(
  ({ ...props }) => {
    const { attributes, listeners, setNodeRef, transform, transition } =
      useSortable({
        id: props["data-node-key"],
      });

    const style: React.CSSProperties = {
      ...props.style,
      transform: CSS.Translate.toString(transform),
      transition,
      cursor: "move",
    };

    return React.cloneElement(props.children as React.ReactElement, {
      ref: setNodeRef,
      style,
      ...attributes,
      ...listeners,
    });
  },
);

function FilePanel() {
  // 当前文件名
  const files = useFileStore((state) => state.files);
  const fileName = useFileStore((state) => state.currentFile.fileName);
  const setFileName = useFileStore((state) => state.setFileName);
  const switchFile = useFileStore((state) => state.switchFile);
  const sidebarVisible = useProjectSidebarStore((state) => state.visible);
  const toggleSidebar = useProjectSidebarStore((state) => state.toggle);
  const wsConnected = useWSStore((state) => state.connected);
  const { isEmbed } = useEmbedMode();
  const sidebarAvailable = wsConnected && !isEmbed;
  const sidebarShown = sidebarAvailable && sidebarVisible;

  // 文件名状态
  const [fileNameState, setFileNameState] = useState<
    "" | "warning" | "error" | undefined
  >("");

  // 文件列表
  const [activeKey, setActiveKey] = useState("");
  const tabs = useMemo(() => {
    setActiveKey(fileName);
    return files.map((file) => ({
      key: file.fileName,
      label: file.fileName,
    }));
  }, [files, fileName]);
  // 变化监测
  const sensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 10 },
  });
  const onLabelChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const key = e.target.value;
    const isValid = setFileName(key);
    setFileNameState(isValid ? "" : "error");
    if (isValid) setActiveKey(key);
  }, [setFileName]);
  const onTabChange = useCallback((key: string) => {
    const newKey = switchFile(key);
    if (newKey) setActiveKey(newKey);
  }, [switchFile]);
  const onDragEnd = useFileStore((state) => state.onDragEnd);
  const addFile = useFileStore((state) => state.addFile);
  const removeFile = useFileStore((state) => state.removeFile);
  const onEdit = useCallback(
    (
      key: React.MouseEvent | React.KeyboardEvent | string,
      action: "add" | "remove",
    ) => {
      let newKey;
      switch (action) {
        case "add":
          newKey = addFile();
          break;
        case "remove":
          newKey = removeFile(key as string);
          break;
      }
      if (newKey) setActiveKey(newKey);
    },
    [addFile, removeFile],
  );

  // 渲染
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
          placement="bottom"
        >
          <span>
            <Button
              type={sidebarShown ? "primary" : "default"}
              icon={
                sidebarShown ? <MenuFoldOutlined /> : <MenuUnfoldOutlined />
              }
              size="small"
              disabled={!sidebarAvailable}
              aria-label={sidebarShown ? "收起项目侧栏" : "展开项目侧栏"}
              onClick={toggleSidebar}
            />
          </span>
        </Tooltip>
        <Input
          className={style.filename}
          placeholder="文件名"
          value={fileName}
          status={fileNameState}
          onChange={onLabelChange}
        />
      </div>
      <Tabs
        className={style.tabs}
        type="editable-card"
        items={tabs}
        activeKey={activeKey}
        onChange={onTabChange}
        onEdit={onEdit}
        renderTabBar={(tabBarProps, DefaultTabBar) => (
          <DndContext
            sensors={[sensor]}
            onDragEnd={onDragEnd}
            collisionDetection={closestCenter}
          >
            <SortableContext
              items={tabs.map((i) => i.key)}
              strategy={horizontalListSortingStrategy}
            >
              <DefaultTabBar {...tabBarProps}>
                {(node) => (
                  <DraggableTabNode
                    {...(node as React.ReactElement<DraggableTabPaneProps>)
                      .props}
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
