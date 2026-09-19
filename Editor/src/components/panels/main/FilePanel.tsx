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
import { Tabs, Input, Button, Tooltip, theme } from "antd";
import { HomeOutlined, FileAddOutlined } from "@ant-design/icons";
import { useWorkspaceStore } from "@/stores/ui/workspaceStore";
import { useFileStore } from "@/stores/project/fileStore";
import { useConfigStore } from "@/stores/app/configStore";
import { useEmbedMode } from "../../../hooks/useEmbedMode";

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
  const { isEmbed } = useEmbedMode();
  const { token } = theme.useToken();
  const home = useWorkspaceStore(s => s.view === "home");
  const showCanvas = useWorkspaceStore(s => s.showCanvas);

  // 当前文件名
  const files = useFileStore((state) => state.files);
  const fileName = useFileStore((state) => state.currentFile.fileName);
  const setFileName = useFileStore((state) => state.setFileName);
  const switchFile = useFileStore((state) => state.switchFile);
  const setStatus = useConfigStore((state) => state.setStatus);

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
    showCanvas();
    const newKey = switchFile(key);
    if (newKey) setActiveKey(newKey);
  }, [switchFile, showCanvas]);
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
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        {home ? <span className={style.filename}>项目首页</span> : <Input
          className={style.filename}
          placeholder="文件名"
          value={fileName}
          status={fileNameState}
          onChange={onLabelChange}
        />}
        {!isEmbed && (
          <Tooltip title="本地文件" placement="bottom">
            <Button
              type="primary"
              icon={<FileAddOutlined />}
              size="small"
              onClick={() => {
                setStatus("showLocalFilePanel", true);
              }}
            />
          </Tooltip>
        )}
      </div>
      <Tabs
        className={style.tabs}
        tabBarExtraContent={!isEmbed ? {
          left: (
            <Tooltip title="项目首页" placement="bottom">
              <button
                type="button"
                className={style.interfaceTab}
                aria-label="Interface 项目首页"
                aria-pressed={home}
                style={{
                  "--interface-tab-color": token.colorText,
                  "--interface-tab-primary": token.colorPrimary,
                  "--interface-tab-active-bg": token.colorFillQuaternary,
                  height: token.controlHeightLG,
                  fontSize: token.fontSize,
                  borderRadius: `${token.borderRadiusLG}px ${token.borderRadiusLG}px 0 0`,
                } as React.CSSProperties}
                onClick={() => useWorkspaceStore.getState().showHome()}
              >
                <HomeOutlined />
                <span>Interface</span>
              </button>
            </Tooltip>
          ),
        } : undefined}
        type="editable-card"
        hideAdd={isEmbed}
        items={tabs}
        activeKey={home ? "__project_home__" : activeKey}
        onChange={onTabChange}
        onTabClick={onTabChange}
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
