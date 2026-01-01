import { CSS } from "@dnd-kit/utilities";
import style from "../../../styles/FilePanel.module.less";

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
import { FileAddOutlined } from "@ant-design/icons";
import { useFileStore } from "../../../stores/fileStore";
import { useConfigStore } from "../../../stores/configStore";

interface DraggableTabPaneProps extends React.HTMLAttributes<HTMLDivElement> {
  "data-node-key": string;
}

const DraggableTabNode: React.FC<Readonly<DraggableTabPaneProps>> = memo(
  ({ className, ...props }) => {
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

    return React.cloneElement(props.children as React.ReactElement<any>, {
      ref: setNodeRef,
      style,
      ...attributes,
      ...listeners,
    });
  }
);

function FilePanel() {
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
  const onLabelChange = useCallback((e: any) => {
    const key = e.target.value;
    const isValid = setFileName(key);
    setFileNameState(isValid ? "" : "error");
    if (isValid) setActiveKey(key);
  }, []);
  const onTabChange = useCallback((key: string) => {
    const newKey = switchFile(key);
    if (newKey) setActiveKey(newKey);
  }, []);
  const onDragEnd = useFileStore((state) => state.onDragEnd);
  const addFile = useFileStore((state) => state.addFile);
  const removeFile = useFileStore((state) => state.removeFile);
  const onEdit = useCallback(
    (
      key: React.MouseEvent | React.KeyboardEvent | string,
      action: "add" | "remove"
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
    []
  );

  // 渲染
  return (
    <div className={style.panel}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <Input
          className={style.filename}
          placeholder="文件名"
          value={fileName}
          status={fileNameState}
          onChange={onLabelChange}
        />
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
